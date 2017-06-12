- walk directory
- parse html files w/ cheerio
- read script src and link href attrs into an array:
  - { value, requiree (path) }
- for each entry point (one per group of parallel scripts, one for all styles, per html file), write temporary entry point js file that requires all required files
- copy every file that isn't a supported file to dist (html, template, js, css, or precompiled version of
  these)
- create webpack config with temporary entry point path(s)
- run webpack
