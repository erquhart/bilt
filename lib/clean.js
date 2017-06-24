const fs = require('fs-extra');
const { destDir, tempDir } = require('./config');

module.exports = () => [destDir, tempDir].forEach(dir => fs.removeSync(dir));
