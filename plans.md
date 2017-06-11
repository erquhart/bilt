- walk directory
- parse html files w/ cheerio
- read script src and link href attrs into an array:
  - { value, requiree (path) }
- rewrite value to compiled extension
- for each requiree, write temporary entry point js file that requires all required files
- copy every file that isn't a supported file to dist (html, template, js, css, or precompiled version of
  these)
- create webpack config with temporary entry point path(s)
- run webpack
