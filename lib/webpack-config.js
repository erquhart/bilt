const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const merge = require('webpack-merge');
const { devMode, destDir } = require('./config');

const baseConfig = {
  output: {
    publicPath: '/',
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
            cacheDirectory: true,
          },
        },
      },
      {
        test: /\.(png|jpg|jpeg|gif|webp|svg|eot|ttf|woff|woff2)(\?.*)?$/i,
        loader: 'file-loader',
      },
    ],
  },
};

const devConfig = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
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
};

const prodConfig = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader'],
        }),
      },
      {
        test: /\.(png|jpg|jpeg|gif|webp|svg|eot|ttf|woff|woff2)(\?.*)?$/i,
        loader: 'file-loader',
        query: {
          useRelativePath: true,
        },
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: ['css-loader', 'sass-loader'],
        }),
      },
      {
        test: /\.less$/,
        use: ExtractTextPlugin.extract({
          use: ['css-loader', 'less-loader'],
        }),
      },
    ],
  },
  plugins: [
    new ExtractTextPlugin('[name].css'),
  ],
};

module.exports = (entryPoints) => {
  const config = merge(baseConfig, devMode ? devConfig : prodConfig);
  config.entry = entryPoints;
  config.output.path = path.resolve(process.cwd(), destDir);

  return config;
};
