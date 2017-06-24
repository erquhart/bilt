const path = require('path');
const fs = require('fs-extra');
const argv = require('yargs').argv;
const _ = require('lodash');
const flatten = require('lodash/flatten');
const walk = require('klaw-sync');
const cheerio = require('cheerio');
const webpack = require('webpack');
const getWebpackConfig = require('./lib/webpack-config');
const runDevServer = require('./lib/serve');
const runBuild = require('./lib/build');

const opts = {
  devMode: argv.dev,
  srcDir: argv.src || 'src',
  destDir: argv.dest || 'dest',
  tempDir: argv.temp || 'tmp',
};

const { devMode, srcDir, destDir, tempDir } = opts;

fs.removeSync(destDir);
fs.removeSync(tempDir);

if (!fs.existsSync(opts.srcDir)) {
  console.log(`Expected source directory "${opts.srcDir}" does not exist.`);
  process.exit(1);
} else {
  console.log(`Using "${opts.srcDir}" as source.`);
}

const paths = walk(srcDir, { nodir: true }).map(file => file.path);
const copyPaths = paths.filter(p => !['.html', '.css', '.scss', '.less', '.js'].includes(path.extname(p)));
const htmlPaths = paths.filter(p => path.extname(p) === '.html');
const htmlFiles = htmlPaths.map(p => ({
  ch: cheerio.load(fs.readFileSync(p, 'utf8')),
  htmlPath: p,
  htmlDir: path.dirname(p),
  htmlName: path.basename(p, '.html'),
  assetAbsoluteWebDir: path.relative(path.join(process.cwd(), srcDir), path.dirname(p)),
}));
const outputScripts = [];

const transformedHtmlFiles = htmlFiles.map(file => {
  const stylesheetElements = file.ch('link[rel="stylesheet"]');
  const styles = stylesheetElements.map((i, el) => {
    const assetPath = file.ch(el).attr('href');
    const ext = path.extname(assetPath);
    const name = path.basename(assetPath, ext);
    const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
    const base = path.relative(path.join(process.cwd(), tempDir, relativeBase), file.htmlDir);
    const importPath = path.join(base, assetPath);
    return Object.assign({}, file, {
      assetPath: assetPath.startsWith('/') ? assetPath.slice(1) : assetPath,
      importPath,
      ext,
      name,
      el,
    });
  }).get();

  const scriptElements = file.ch('script');
  const scripts = scriptElements.map((i, el) => {
    const assetPath = file.ch(el).attr('src');
    const ext = path.extname(assetPath);
    const name = path.basename(assetPath, ext);
    const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
    const base = path.relative(path.join(process.cwd(), tempDir, relativeBase), file.htmlDir);
    const importPath = path.join(base, assetPath);
    return Object.assign({}, file, {
      assetPath: assetPath.startsWith('/') ? assetPath.slice(1) : assetPath,
      importPath,
      ext,
      name,
      el,
    });
  }).get();

  if (styles.length) {
    const styleGroups = [];
    styles.forEach(style => {
      if (file.ch(style.el).prev().is('link[rel=stylesheet]')) {
        _.last(styleGroups).push(style);
      } else {
        styleGroups.push([style]);
      }
    });


    styleGroups.forEach((styleGroup, index) => {
      const importContent = styleGroup.map(style => `import '${style.importPath}';`).join('\n');
      const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
      const base = path.join(process.cwd(), tempDir, relativeBase);
      const name = `${file.htmlName}-styles${index ? `-${index}` : ''}`;
      const assetPath = path.join(base, `${name}.js`);
      const entryPointName = path.join(file.assetAbsoluteWebDir, path.basename(assetPath, '.js'));

      if (devMode) {
        const origAssetPath = path.join('/', file.assetAbsoluteWebDir, `${name}.js`);
        file.ch(styleGroup[0].el).replaceWith(`<script src="${origAssetPath}"></script>`);
      } else {
        const origAssetPath = path.join('/', file.assetAbsoluteWebDir, `${name}.css`);
        file.ch(styleGroup[0].el).replaceWith(`<link rel="stylesheet" href="${origAssetPath}"/>`);
      }

      fs.outputFileSync(assetPath, importContent);
      outputScripts.push(Object.assign({}, file, { assetPath, entryPointName }));
    });
  }

  if (scripts.length) {
    const scriptGroups = [];
    scripts.forEach(script => {
      if (file.ch(script.el).prev().is('script')) {
        _.last(scriptGroups).push(script);
      } else {
        scriptGroups.push([script]);
      }
    });

    scriptGroups.forEach((scriptGroup, index) => {
      const importContent = scriptGroup.map(script => `import '${script.importPath}';`).join('\n');
      const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
      const base = path.join(process.cwd(), tempDir, relativeBase);
      const name = `${file.htmlName}-scripts${index ? `-${index}` : ''}.js`;
      const assetPath = path.join(base, name);
      const entryPointName = path.join(file.assetAbsoluteWebDir, path.basename(assetPath, '.js'));
      const origAssetPath = path.join('/', file.assetAbsoluteWebDir, name);
      file.ch(scriptGroup[0].el).replaceWith(`<script src="${origAssetPath}"></script>`);
      _.tail(scriptGroup).forEach(script => file.ch(script.el).remove());
      fs.outputFileSync(assetPath, importContent);
      outputScripts.push(Object.assign({}, file, { assetPath, entryPointName }));
    });
  }

  return {
    htmlPath: file.htmlPath,
    content: file.ch.html(),
  };
});

transformedHtmlFiles.forEach(file => {
  const newPath = path.relative(path.join(process.cwd(), srcDir), file.htmlPath);
  fs.outputFileSync(path.join(destDir, newPath), file.content);
});

copyPaths.forEach(p => {
  const newPath = path.relative(path.join(process.cwd(), srcDir), p);
  fs.copySync(p, path.join(destDir, newPath));
});

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

const compiler = webpack(getWebpackConfig({ devMode, entryPoints, destDir }));

if (devMode) {
  runDevServer({ compiler, destDir });
} else {
  runBuild({ compiler });
}