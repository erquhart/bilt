const path = require('path');
const fs = require('fs-extra');
const opn = require('opn');
const flatten = require('lodash/flatten');
const walk = require('klaw-sync');
const cheerio = require('cheerio');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackDevServer = require('webpack-dev-server');

const outputDir = 'dest';
const tempDir = 'tmp';
fs.removeSync(outputDir);
fs.removeSync(tempDir);

const paths = walk('./example/').map(file => file.path);
const copyPaths = paths.filter(p => !['.html', '.css', '.js'].includes(path.extname(p)));
const htmlPaths = paths.filter(p => path.extname(p) === '.html');
const htmlFiles = htmlPaths.map(p => ({
  ch: cheerio.load(fs.readFileSync(p, 'utf8')),
  htmlPath: p,
  htmlDir: path.dirname(p),
  htmlName: path.basename(p, '.html'),
}));
const scripts = flatten(htmlFiles.map(file => {
  return file.ch('script').map((i, el) => (Object.assign({}, file, {
    assetPath: path.join(file.htmlDir, file.ch(el).attr('src')),
  }))).get();
}));

const transformedHtmlFiles = htmlFiles.map(file => {
  const stylesheetElements = file.ch('link[rel="stylesheet"]');
  const styles = stylesheetElements.map((i, el) => {
    const assetPath = file.ch(el).attr('href');
    const ext = path.extname(assetPath);
    return Object.assign({}, file, {
      assetPath: assetPath.startsWith('/') ? assetPath.slice(1) : assetPath,
      ext,
      name: path.basename(assetPath, ext),
    });
  }).get();

  if (styles.length) {
    stylesheetElements.remove();
    file.ch('head').append(`<link rel="stylesheet" href="${file.htmlName}-styles.css"/>`);
    const importContent = styles.map(style => `import '../example/${style.assetPath}';`).join('\n');
    const relativeBase = path.relative(path.join(__dirname, 'example'), file.htmlDir);
    const base = path.join(__dirname, relativeBase);
    const assetPath = path.join(base, tempDir, `${file.htmlName}-styles.js`);
    fs.outputFileSync(assetPath, importContent);
    scripts.push(Object.assign({}, file, { assetPath }));
  }

  return {
    htmlPath: file.htmlPath,
    content: file.ch.html(),
  };
});

transformedHtmlFiles.forEach(file => {
  const newPath = path.relative(path.join(__dirname, 'example'), file.htmlPath);
  fs.outputFileSync(path.join('dest', newPath), file.content);
});

copyPaths.forEach(p => {
  const newPath = path.relative(path.join(__dirname, 'example'), p);
  fs.copySync(p, path.join('dest', newPath));
});

const entryPoints = scripts.reduce((acc, script) => {
  const name = path.basename(script.assetPath, '.js');
  acc[name] = [
    /*
    'webpack-dev-server/client?http://localhost:8080',
    'webpack/hot/dev-server',
    */
    script.assetPath,
  ];
  return acc;
}, {});

const compiler = webpack({
  entry: entryPoints,
  output: {
    path: path.resolve(__dirname, 'dest'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['react', 'es2015']
          },
        },
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          /*
          fallback: 'style-loader',
          */
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
      /*
      {
        test: /\.(sass|scss)$/,
        use: new ExtractTextPlugin().extract({
          use: [{
            loader: 'css-loader',
          }, {
            loader: 'sass-loader',
          }],
        }),
      },
      */
    ],
  },
  plugins: [
    new ExtractTextPlugin('[name].css'),
    /*
    new webpack.HotModuleReplacementPlugin(),
    */
  ],
});

/*
const server = new WebpackDevServer(compiler, {
  contentBase: path.join(__dirname, 'dest'),
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
*/

compiler.run((err, stats) => {
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