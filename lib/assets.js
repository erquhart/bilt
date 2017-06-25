const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const flatten = require('lodash/flatten');
const walk = require('klaw-sync');
const cheerio = require('cheerio');
const webpack = require('webpack');
const { devMode, srcDir, destDir, tempDir } = require('./config');

module.exports = () => {
  let outputScripts = [];
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

  const transformedHtmlFiles = htmlFiles.map(file => {
    const getResourceElements = (selector, srcAttr) => {
      return file.ch(selector).map((i, el) => {
        const assetPath = file.ch(el).attr(srcAttr);
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
    };

    const getResourceElementGroups = (resourceElements, selector) => {
      return resourceElements.reduce((acc, resourceElement) => {
        if (file.ch(resourceElement.el).prev().is(selector)) {
          _.last(acc).push(resourceElement);
        } else {
          acc.push([resourceElement]);
        }
        return acc;
      }, []);
    };

    const bundleGroup = ({ group, index, filenameSuffix, fileExt, templateFn }) => {
      const importContent = group.map(resource => `import '${resource.importPath}';`).join('\n');
      const relativeBase = path.relative(path.join(process.cwd(), srcDir), file.htmlDir);
      const base = path.join(process.cwd(), tempDir, relativeBase);
      const name = `${file.htmlName}-${filenameSuffix}${index ? `-${index}` : ''}`;
      const assetPath = path.join(base, `${name}.js`);
      const entryPointName = path.join(file.assetAbsoluteWebDir, path.basename(assetPath, '.js'));
      const origAssetPath = path.join('/', file.assetAbsoluteWebDir, `${name}${fileExt}`);
      file.ch(group[0].el).replaceWith(templateFn(origAssetPath));
      fs.outputFileSync(assetPath, importContent);
      return Object.assign({}, file, { assetPath, entryPointName });
    };

    const styleElementSelector = 'link[rel="stylesheet"]';
    const styles = getResourceElements(styleElementSelector, 'href');
    const scriptElementSelector = 'script';
    const scripts = getResourceElements(scriptElementSelector, 'src');

    if (styles.length) {
      const styleGroups = getResourceElementGroups(styles, styleElementSelector);
      const styleBundles = styleGroups.map((group, index) => {
        const fileExt = devMode ? '.js' : '.css';
        const devTemplateFn = assetPath => `<script src="${assetPath}"></script>`;
        const prodTemplateFn = assetPath => `<link rel="stylesheet" href="${assetPath}"/>`;
        const templateFn = devMode ? devTemplateFn : prodTemplateFn;
        return bundleGroup({ group, index, filenameSuffix: 'styles', fileExt, templateFn });
      });
      outputScripts = outputScripts.concat(styleBundles);
    }

    if (scripts.length) {
      const scriptGroups = getResourceElementGroups(scripts, scriptElementSelector);
      const templateFn = assetPath => `<script src="${assetPath}"></script>`;
      const scriptBundles = scriptGroups.map((group, index) => {
        return bundleGroup({ group, index, filenameSuffix: 'scripts', fileExt: '.js', templateFn });
      });
      outputScripts = outputScripts.concat(scriptBundles);
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

  return outputScripts;
};