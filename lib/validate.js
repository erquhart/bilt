const fs = require('fs-extra');
const { srcDir } = require('./config');

module.exports = () => {
  if (!fs.existsSync(srcDir)) {
    console.log(`Expected source directory "${srcDir}" does not exist.`);
    process.exit(1);
  } else {
    console.log(`Using "${srcDir}" as source.`);
  }
};
