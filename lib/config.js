const argv = require('yargs').argv;

const opts = {
  devMode: argv.dev,
  srcDir: argv.src || 'src',
  destDir: argv.dest || 'dest',
  tempDir: argv.temp || 'tmp',
};

module.exports = Object.assign({}, opts);
