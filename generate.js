var Metalsmith  = require('metalsmith');
var collections = require('metalsmith-collections');
var layouts     = require('metalsmith-layouts');
var markdown    = require('metalsmith-markdown');
var permalinks  = require('metalsmith-permalinks');
var debug       = require('metalsmith-debug');

Metalsmith(__dirname)         // __dirname defined by node.js:
                              // name of current working directory
  .metadata({                 // add any variable you want
                              // use them in layout-files
    sitename: "PPEK",
    siteurl: "http://ppek.hu/",
    description: "Elektronikus könyvtár",
    generatorname: "Metalsmith",
    generatorurl: "http://metalsmith.io/"
  })
  .source('./src')            // source directory
  .destination('./build')     // destination directory
  .clean(true)                // clean destination before
  .use(collections({          // group all blog posts by internally
    posts: 'books/*.md'       // adding key 'collections':'books'
  }))                         // use `collections.posts` in layouts
  .use(markdown())            // transpile all md into html (in internal representation)
  .use(permalinks({           // change URLs to permalink URLs
    relative: false
  }))
  .use(debug())
  .use(layouts({
    default: 'layout.njk',
    pattern: "**/*"
  }))
  .build(function(err) {      // build process
    if (err) throw err;       // error handling is required
  });