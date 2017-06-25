const webpack = require('webpack');
const { devMode } = require('./lib/config');
const getWebpackConfig = require('./lib/webpack-config');
const runClean = require('./lib/clean');
const buildAssets = require('./lib/assets');
const runDevServer = require('./lib/serve');
const runBuild = require('./lib/build');

runClean();

const outputScripts = buildAssets();

const entryPoints = outputScripts.reduce((acc, { assetPath, entryPointName }) => {
  acc[entryPointName] = [ assetPath ];

  if (devMode) {
    acc[entryPointName] = [
      'webpack-dev-server/client?http://localhost:8080',
      'webpack/hot/dev-server',
    ].concat(acc[entryPointName]);
  }
  return acc;
}, {});

const compiler = webpack(getWebpackConfig(entryPoints));

if (devMode) {
  runDevServer(compiler);
} else {
  runBuild(compiler);
}