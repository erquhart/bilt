const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackDevServer = require('webpack-dev-server');

const compiler = webpack({
  entry: './example/index',
  output: {
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [new HtmlWebpackPlugin],
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
});

const server = new WebpackDevServer(compiler, {
  contentBase: path.join(__dirname, 'dist'),
  compress: true,
  port: 9000,
  watchContentBase: true,
  stats: {
    colors: true,
  },
});

server.listen(8080, '127.0.0.1', () => console.log('Starting server on http://localhost:8080'));