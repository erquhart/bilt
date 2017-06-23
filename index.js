const path = require('path');
const fs = require('fs-extra');
const argv = require('yargs').argv;
const _ = require('lodash');
const opn = require('opn');
const flatten = require('lodash/flatten');
const walk = require('klaw-sync');
const cheerio = require('cheerio');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackDevServer = require('webpack-dev-server');

const opts = {
  developmentMode: argv.dev,
  srcDir: argv.src || 'src',
  destDir: argv.dest || 'dest',
  tempDir: argv.temp || 'tmp',
};

const { developmentMode, srcDir, destDir, tempDir } = opts;

fs.removeSync(destDir);
fs.removeSync(tempDir);

if (!fs.existsSync(opts.srcDir)) {
  console.log('Expected source directory ' + opts.srcDir + ' does not exist.');
  process.exit(1);
} else {
  console.log('Using ' + opts.srcDir + ' as source.');
}

const paths = walk(srcDir, { nodir: true }).map(file => file.path);
const copyPaths = paths.filter(p => !['.html', '.css', '.scss', '.less', '.js'].includes(path.extname(p)));
const htmlPaths = paths.filter(p => path.extname(p) === '.html');
const htmlFiles = htmlPaths.map(p => ({
  ch: cheerio.load(fs.readFileSync(p, 'utf8')),
  htmlPath: p,
  htmlDir: path.dirname(p),
  htmlName: path.basename(p, '.html'),
  assetAbsoluteWebDir: path.relative(path.join(process.cwd(), srcDir), path.dirname(p)),
}));
const outputScripts = [];

const transformedHtmlFiles = htmlFiles.map(file => {
  const stylesheetElements = file.ch('link[rel="stylesheet"]');
  const styles = stylesheetElements.map((i, el) => {
    const assetPath = file.ch(el).attr('href');
    const ext = path.extname(assetPath);
    const name = path.basename(assetPath, ext);
    const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
    const base = path.relative(path.join(process.cwd(), tempDir, relativeBase), file.htmlDir);
    const importPath = path.join(base, assetPath);
    return Object.assign({}, file, {
      assetPath: assetPath.startsWith('/') ? assetPath.slice(1) : assetPath,
      importPath,
      ext,
      name,
      el,
    });
  }).get();

  const scriptElements = file.ch('script');
  const scripts = scriptElements.map((i, el) => {
    const assetPath = file.ch(el).attr('src');
    const ext = path.extname(assetPath);
    const name = path.basename(assetPath, ext);
    const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
    const base = path.relative(path.join(process.cwd(), tempDir, relativeBase), file.htmlDir);
    const importPath = path.join(base, assetPath);
    return Object.assign({}, file, {
      assetPath: assetPath.startsWith('/') ? assetPath.slice(1) : assetPath,
      importPath,
      ext,
      name,
      el,
    });
  }).get();

  if (styles.length) {
    const styleGroups = [];
    styles.forEach(style => {
      if (file.ch(style.el).prev().is('link[rel=stylesheet]')) {
        _.last(styleGroups).push(style);
      } else {
        styleGroups.push([style]);
      }
    });


    styleGroups.forEach((styleGroup, index) => {
      const importContent = styleGroup.map(style => `import '${style.importPath}';`).join('\n');
      const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
      const base = path.join(process.cwd(), tempDir, relativeBase);
      const assetPath = path.join(base, `${file.htmlName}-styles.js`);
      const entryPointName = path.join(file.assetAbsoluteWebDir, path.basename(assetPath, '.js'));

      if (developmentMode) {
        const origAssetPath = path.join('/', file.assetAbsoluteWebDir, `${file.htmlName}-styles.js`);
        file.ch(styleGroup[0].el).replaceWith(`<script src="${origAssetPath}"></script>`);
      } else {
        const origAssetPath = path.join('/', file.assetAbsoluteWebDir, `${file.htmlName}-styles.css`);
        file.ch(styleGroup[0].el).replaceWith(`<link rel="stylesheet" href="${origAssetPath}"/>`);
      }

      fs.outputFileSync(assetPath, importContent);
      outputScripts.push(Object.assign({}, file, { assetPath, entryPointName }));
    });
  }

  if (scripts.length) {
    const scriptGroups = [];
    scripts.forEach(script => {
      if (file.ch(script.el).prev().is('script')) {
        _.last(scriptGroups).push(script);
      } else {
        scriptGroups.push([script]);
      }
    });

    scriptGroups.forEach((scriptGroup, index) => {
      const importContent = scriptGroup.map(script => `import '${script.importPath}';`).join('\n');
      const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
      const base = path.join(process.cwd(), tempDir, relativeBase);
      const assetPath = path.join(base, `${file.htmlName}-scripts${index || ''}.js`);
      const entryPointName = path.join(file.assetAbsoluteWebDir, path.basename(assetPath, '.js'));
      const origAssetPath = path.join('/', file.assetAbsoluteWebDir, `${file.htmlName}-scripts.js`);
      file.ch(scriptGroup[0].el).replaceWith(`<script src="${origAssetPath}"></script>`);
      _.tail(scriptGroup).forEach(script => file.ch(script.el).remove());
      fs.outputFileSync(assetPath, importContent);
      outputScripts.push(Object.assign({}, file, { assetPath, entryPointName }));
    });
  }

  return {
    htmlPath: file.htmlPath,
    content: file.ch.html(),
  };
});

transformedHtmlFiles.forEach(file => {
  const newPath = path.relative(path.join(process.cwd(), srcDir), file.htmlPath);
  fs.outputFileSync(path.join(destDir, newPath), file.content);
});

copyPaths.forEach(p => {
  const newPath = path.relative(path.join(process.cwd(), srcDir), p);
  fs.copySync(p, path.join(destDir, newPath));
});

const entryPoints = outputScripts.reduce((acc, { assetPath, entryPointName }) => {
  acc[entryPointName] = [ assetPath ];

  if (developmentMode) {
    acc[entryPointName] = [
      'webpack-dev-server/client?http://localhost:8080',
      'webpack/hot/dev-server',
    ].concat(acc[entryPointName]);
  }
  return acc;
}, {});

const devCompiler = webpack({
  entry: entryPoints,
  output: {
    path: path.resolve(process.cwd(), destDir),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['react', 'es2015'],
            plugins: [
              require('babel-plugin-transform-object-rest-spread'),
              require('babel-plugin-transform-class-properties'),
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test:/\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
        loader: 'file-loader',
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.less$/,
        use: ['style-loader', 'css-loader', 'less-loader'],
      },
    ],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
  ],
});

const prodCompiler = webpack({
  entry: entryPoints,
  output: {
    path: path.resolve(process.cwd(), destDir),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['react', 'es2015'],
            plugins: [
              require('babel-plugin-transform-object-rest-spread'),
              require('babel-plugin-transform-class-properties'),
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader',
        }),
      },
      {
        test:/\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
        loader: 'file-loader',
        query: {
          useRelativePath: true,
        },
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [{
            loader: 'css-loader',
          }, {
            loader: 'sass-loader',
          }],
        }),
      },
      {
        test: /\.less$/,
        use: ExtractTextPlugin.extract({
          use: [{
            loader: 'css-loader',
          }, {
            loader: 'less-loader',
          }],
        }),
      },
    ],
  },
  plugins: [
    new ExtractTextPlugin('[name].css'),
  ],
});

if (developmentMode) {
  const server = new WebpackDevServer(devCompiler, {
    contentBase: path.join(process.cwd(), destDir),
    watchContentBase: true,
    hot: true,
    compress: true,
    stats: {
      colors: true,
    },
    staticOptions: {
      extensions: ['html'],
    },
  });

  server.listen(8080, '127.0.0.1', () => console.log('Starting server on http://localhost:8080'));
  opn('http://localhost:8080');
} else {
  prodCompiler.run((err, stats) => {
    if (err) {
      console.error(err.stack || err);
      if (err.details) {
        console.error(err.details);
      }
      return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
      console.error(info.errors);
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings)
    }
  });
}