const path = require('path');
const fs = require('fs-extra');
const flatten = require('lodash/flatten');
const walk = require('klaw-sync');
const cheerio = require('cheerio');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');

const outputDir = 'dest';
fs.removeSync(outputDir);

const paths = walk('./example/').map(file => file.path);
const copyPaths = paths.filter(p => !['.css', '.js'].includes(path.extname(p)));
const htmlPaths = copyPaths.filter(p => path.extname(p) === '.html');
const scripts = htmlPaths.map(p => {
  const file = fs.readFileSync(p, 'utf8');
  const ch = cheerio.load(file);
  const scripts = ch('script');
  return scripts.map((i, el) => ({
    assetPath: ch(el).attr('src'),
    htmlPath: p,
    htmlDir: path.dirname(p),
  })).get();
});

const flattenedScripts = flatten(scripts);

copyPaths.forEach(p => {
  const newPath = path.relative(path.join(__dirname, 'example'), p);
  fs.copySync(p, path.join('dest', newPath));
});

const entryPoints = flattenedScripts.reduce((acc, script) => {
  const name = path.basename(script.assetPath, '.js');
  acc[name] = [
    'webpack-dev-server/client?http://localhost:8080',
    'webpack/hot/dev-server',
    path.join(script.htmlDir, script.assetPath),
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
    ],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
});

const server = new WebpackDevServer(compiler, {
  contentBase: path.join(__dirname, 'dest'),
  watchContentBase: true,
  hot: true,
  compress: true,
  stats: {
    colors: true,
  },
  staticOptions: {
    extensions: ['html', 'htm'],
  },
});

server.listen(8080, '127.0.0.1', () => console.log('Starting server on http://localhost:8080'));

/*
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
*/