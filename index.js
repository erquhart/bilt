const path = require('path');
const fs = require('fs');
const walk = require('klaw-sync');
const cheerio = require('cheerio');

const paths = walk('./example/').map(file => file.path);
const html = paths.filter(p => path.extname(p) === '.html').map(p => {
  const file = fs.readFileSync(p, 'utf8');
  const dom = cheerio.load(file);
  const jsSources = dom('script').map((i, el) => {
    return dom(el).attr('src');
  }).get();
  console.log(jsSources);
});