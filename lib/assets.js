const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const flatten = require('lodash/flatten');
const walk = require('klaw-sync');
const cheerio = require('cheerio');
const webpack = require('webpack');
const { devMode, srcDir, destDir, tempDir } = require('./config');

const styleElementSelector = 'link[rel="stylesheet"]';
const scriptElementSelector = 'script';
let outputScripts = [];

module.exports = () => {
  const paths = walk(srcDir, { nodir: true }).map(file => file.path);
  const copyPaths = paths.filter(p => !['.html', '.css', '.scss', '.less', '.js'].includes(path.extname(p)));
  const htmlPaths = paths.filter(p => path.extname(p) === '.html');
  const htmlFiles = getHtmlFiles(htmlPaths);
  const transformedHtmlFiles = transformHtmlFiles(htmlFiles);
  outputHtml(transformedHtmlFiles);
  outputAssets(copyPaths);
  return outputScripts;
};

function transformHtmlFiles(files) {
  return files.map(file => {
    generateAssetBundles(file);

    return {
      htmlPath: file.htmlPath,
      content: file.ch.html(),
    };
  });
}

function generateAssetBundles(htmlFile) {
  const styles = getResourceElements(htmlFile, styleElementSelector, 'href');
  const scripts = getResourceElements(htmlFile, scriptElementSelector, 'src');

  if (styles.length) {
    const styleGroups = getResourceElementGroups(htmlFile, styles, styleElementSelector, 'href');
    const styleBundles = getStyleBundles(htmlFile, styleGroups);
    outputScripts = outputScripts.concat(styleBundles);
  }

  if (scripts.length) {
    const scriptGroups = getResourceElementGroups(htmlFile, scripts, scriptElementSelector, 'src');
    const scriptBundles = getScriptBundles(htmlFile, scriptGroups);
    outputScripts = outputScripts.concat(scriptBundles);
  }
}

function isUrl(str) {
  return str && str.search(/^(https?:)?\/\//) >= 0;
}

function toBrowserPath(p) {
  return path.sep === '/' ? p : p.replace(path.sep, '/');
}

function getResourceElements(htmlFile, selector, srcAttr) {
  return htmlFile.ch(selector).map((i, el) => {
    const assetPath = htmlFile.ch(el).attr(srcAttr);
    if (!assetPath || isUrl(assetPath)) {
      return;
    }
    const ext = path.extname(assetPath);
    const name = path.basename(assetPath, ext);
    const relativeBase = path.relative(path.join(process.cwd(), srcDir), htmlFile.htmlDir);
    const base = path.relative(path.join(process.cwd(), tempDir, relativeBase), htmlFile.htmlDir);
    const importPath = toBrowserPath(path.join(base, assetPath));
    return Object.assign({}, htmlFile, {
      assetPath: assetPath.startsWith('/') ? assetPath.slice(1) : assetPath,
      importPath,
      ext,
      name,
      el,
    });
  }).get();
}

function getResourceElementGroups(htmlFile, resourceElements, selector, srcAttr) {
  return resourceElements.reduce((acc, resourceElement) => {
    const prev = htmlFile.ch(resourceElement.el).prev();
    if (prev.is(selector) && prev.is((i, el) => !isUrl(_.get(el, ['attribs', srcAttr])))) {
      _.last(acc).push(resourceElement);
    } else {
      acc.push([resourceElement]);
    }
    return acc;
  }, []);
}

function bundleGroup({ htmlFile, group, index, filenameSuffix, fileExt, templateFn }) {
  const importContent = group.map(resource => `import '${resource.importPath}';`).join('\n');
  const relativeBase = path.relative(path.join(process.cwd(), srcDir), htmlFile.htmlDir);
  const base = path.join(process.cwd(), tempDir, relativeBase);
  const name = `${htmlFile.htmlName}-${filenameSuffix}${index ? `-${index}` : ''}`;
  const assetPath = path.join(base, `${name}.js`);
  const entryPointName = path.join(htmlFile.assetAbsoluteWebDir, path.basename(assetPath, '.js'));
  const origAssetPath = toBrowserPath(path.join('/', htmlFile.assetAbsoluteWebDir, `${name}${fileExt}`));
  group.forEach((resource, index) => {
    // Replace the first group element with the new bundle element, remove the rest.
    const { el } = resource;
    index ? htmlFile.ch(el).remove() : htmlFile.ch(el).replaceWith(templateFn(origAssetPath));
  });
  fs.outputFileSync(assetPath, importContent);
  return Object.assign({}, htmlFile, { assetPath, entryPointName });
}

function getStyleBundles(htmlFile, styleGroups) {
  return styleGroups.map((group, index) => {
    const fileExt = devMode ? '.js' : '.css';
    const devTemplateFn = assetPath => `<script src="${assetPath}"></script>`;
    const prodTemplateFn = assetPath => `<link rel="stylesheet" href="${assetPath}"/>`;
    const templateFn = devMode ? devTemplateFn : prodTemplateFn;
    return bundleGroup({ htmlFile, group, index, filenameSuffix: 'styles', fileExt, templateFn });
  });
}

function getScriptBundles(htmlFile, scriptGroups) {
  const templateFn = assetPath => `<script src="${assetPath}"></script>`;
  return scriptGroups.map((group, index) => {
    return bundleGroup({ htmlFile, group, index, filenameSuffix: 'scripts', fileExt: '.js', templateFn });
  });
}

function getHtmlFiles(paths) {
  return paths.map(p => ({
    ch: cheerio.load(fs.readFileSync(p, 'utf8')),
    htmlPath: p,
    htmlDir: path.dirname(p),
    htmlName: path.basename(p, '.html'),
    assetAbsoluteWebDir: path.relative(path.join(process.cwd(), srcDir), path.dirname(p)),
  }));
}

function outputHtml(files) {
  files.forEach(file => {
    const newPath = path.relative(path.join(process.cwd(), srcDir), file.htmlPath);
    fs.outputFileSync(path.join(destDir, newPath), file.content);
  });
}

function outputAssets(paths) {
  paths.forEach(p => {
    const newPath = path.relative(path.join(process.cwd(), srcDir), p);
    fs.copySync(p, path.join(destDir, newPath));
  });
}