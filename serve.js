const path = require('path');
const WebpackDevServer = require('webpack-dev-server');
const opn = require('opn');

module.exports = ({ compiler, destDir }) => {
  const server = new WebpackDevServer(compiler, {
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

  server.listen(8080, '127.0.0.1', () => {
    console.log('Starting server on http://localhost:8080');
  });
  opn('http://localhost:8080');
};
