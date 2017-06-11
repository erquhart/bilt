const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackDevServer = require('webpack-dev-server');
const gulp = require('gulp');

gulp.task

/*
const compiler = webpack({
  entry: './example/index',
  output: {
    path: path.resolve(__dirname, 'dist'),
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
        test: /\.html$/,
        use: [ 'file-loader?name=[path][name].[ext]!extract-loader!html-loader' ]
      },
    ],
  },
});
*/

/*
const server = new WebpackDevServer(compiler, {
  contentBase: path.join(__dirname, 'dist'),
  compress: true,
  stats: {
    colors: true,
  },
});

server.listen(8080, '127.0.0.1', () => console.log('Starting server on http://localhost:8080'));
*/

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