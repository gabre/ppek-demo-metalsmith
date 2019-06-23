var Metalsmith  = require('metalsmith');
var collections = require('metalsmith-collections');
var layouts     = require('metalsmith-layouts');
var markdown    = require('metalsmith-markdown');
var permalinks  = require('metalsmith-permalinks');
var debuglog    = require('metalsmith-debug');
var copy        = require('metalsmith-copy');
var debug       = require('debug')('metalsmith-PPEK-MAIN');

var slug        = require('slug');
// marked will be downloaded as a dependency by metalsmith-markdown
const marked    = require("marked");


// --------------------------------------------------------------------------------

const contentDir    = "content"
const booksInDir    = "books"
const booksOutDir   = "konyvek"
const authorsOutDir = "szerzok"

// --------------------------------------------------------------------------------

// Custom renderer to append specific css classes to markdown
const pureCssMarkdownRenderer = () => {
    let renderer = new marked.Renderer({
        "smartypants": true,
        "smartLists": true,
        "gfm": true,
        "tables": true,
        "breaks": false,
        "sanitize": false
    });
    // As it is not possible to generate custom classes, it is necessary
    // to pass a PureCSS Blockquote renderer (https://git.io/vwD7Z)
    renderer.blockquote = function(quote) {
        return '<blockquote class="content-quote">\n' + quote + '</blockquote>\n';
        };
    return renderer;
}

// --------------------------------------------------------------------------------

// Add root's relative path and file's own relative path
function addPathsToContent() {
    return function(files, _metalsmith, done){
      setImmediate(done);
      Object.keys(files).forEach(function(filepath){
        if (filepath.startsWith(contentDir)) {
            debug("Processing " + filepath)
            // For contentDir/some.html, contentDir/some/dirs/some.html:
            // segments - contentDir - the file itself
            // For contentDir, contentDir/some/dirs:
            // segments - contentDir
            var segmentsToRemove = 1
            if (filepath.endsWith(".html")) {
                segmentsToRemove = 2
            }
            const segments = filepath.split(/[\\/]/)
            const moveBackThisMany = segments.length - segmentsToRemove
            const rootRelativePath = "../".repeat(moveBackThisMany) + '.'
            const ownRelativePathFromRoot = segments.slice(1).join("/")
            debug("Relative path to root of content is " + rootRelativePath)
            debug("Relative path from root of content is " + ownRelativePathFromRoot)

            files[filepath].rootRelativePath = rootRelativePath;
            files[filepath].ownRelativePathFromRoot = ownRelativePathFromRoot
        }
      });
    };
}

// Generic collection transformer function
function transformCollections(transform, opts) {
    var collectionsToTransform = Object.keys(opts);
    return function(files, metalsmith, done){
        var metadata = metalsmith.metadata();
        setImmediate(done);
        collectionsToTransform.forEach(function(collectionName) {
            var taxonomyNames = opts[collectionName]
            debug("Processing: " + collectionName)
            taxonomyNames.forEach(function(taxonomyName) {
                transform(metadata, collectionName, taxonomyName)
            })
        })
        debug(metadata.collections)
    };
}

// Sort a taxonomy (property with multiple values) of a collection
function sortCollectionTaxonomies(metadata, collectionName, taxonomyName) {
    debug("Processing taxonomy: " + taxonomyName)
    metadata.collections[collectionName].forEach(function(collectionElem) {
        collectionElem[taxonomyName].sort()
    })
}

// Create their own collections from taxonomies (properties of collections with multiple values)
function createTaxonomyCollections(metadata, collectionName, taxonomyName) {
    debug("Processing taxonomy: " + taxonomyName)
    metadata.collections[taxonomyName] = metadata.collections[taxonomyName] || {};
    metadata.collections[collectionName].forEach(function(collectionElem) {
        collectionElem[taxonomyName].forEach(function(taxonomyValue) {
            debug("Adding " + collectionElem.title + " to " + taxonomyName + "/" + taxonomyValue)
            metadata.collections[taxonomyName][taxonomyValue] = metadata.collections[taxonomyName][taxonomyValue] || []
            metadata.collections[taxonomyName][taxonomyValue].push(collectionElem)
        })
    })
}

// Generate list pages for taxonomyName - taxonomyValue pairs (for a given taxonomyName)
function createTaxonomyValuePages(taxonomyName, outputDir, layout) {
    return function(files, metalsmith, done){
        setImmediate(done)
        var metadata = metalsmith.metadata()
        Object.keys(metadata.collections[taxonomyName]).forEach(function(taxonomyValue) {
            const path = contentDir + "/" + outputDir + "/" + slug(taxonomyValue, {mode: 'rfc3986'}) + ".md";
            var page = {
                layout: layout,
                contents: '',
                taxonomyName: taxonomyName,
                taxonomyValue: taxonomyValue,
            }
            files[path] = page
            var taxonomyValueData = metadata.collections[taxonomyName][taxonomyValue]
            taxonomyValueData["file"] = page
            metadata.collections[taxonomyName][taxonomyValue] = taxonomyValueData
        })
    }
}

// Remove first (parent) folder of a path
function pathWithoutFirstFolder(file) {
    return file.split(/[\\/]/).slice(1).join("/")
}

// --------------------------------------------------------------------------------
// Main Metalsmith call

Metalsmith(__dirname)         // __dirname defined by node.js:
                              // name of current working directory
  .metadata({                 // add any variable you want
                              // use them in layout-files
    sitename: "Pázmány Péter Elektronikus Könyvtár",
    siteurl: "http://ppek.hu/",
    description: "Elektronikus könyvtár",
    generatorname: "Metalsmith",
    generatorurl: "http://metalsmith.io/",

    booksOutDir: booksOutDir,
    authorsOutDir: authorsOutDir
  })
  .source('./src')
  .destination('./build')
  .clean(true)
  .use(debuglog())
  // Renaming for user-friendliness
  .use(copy({
    pattern: contentDir + '/**/*',
    transform: function (file) {
        return file.replace(booksInDir, booksOutDir)
                    .replace("authors", authorsOutDir)
    },
    move: true
    }))
  // Definition of collection: books
  .use(collections({
    books: contentDir + '/' + booksOutDir + '/*.md'
  }))
  // Sort collection's taxonomies
  .use(transformCollections(sortCollectionTaxonomies, {
    books: ["authors"]
  }))
  // Create their own collections for taxonomies
  .use(transformCollections(createTaxonomyCollections, {
    books: ["authors"]
  }))
  // Create taxonomz value list pages
  .use(createTaxonomyValuePages("authors", authorsOutDir, "author-book-list.njk"))
  // Convert markdown to html
  .use(markdown({
    renderer: pureCssMarkdownRenderer()
  }))
  // Create permalinks (some.html -> some/index.html)
  .use(permalinks({
    relative: false
  }))
  // Add relative root path, own relative path
  .use(addPathsToContent())
  // Use Nunjucks html-templates
  .use(layouts({
    default: 'book.njk',
    pattern: contentDir + "/**/*"
  }))
  // Remove uneeded top-level folders: static, content
  .use(copy({
    pattern: 'static/**/*',
    transform: function (file) {
        return pathWithoutFirstFolder(file);
      },
    move: true
  }))
  .use(copy({
    pattern: contentDir + '/**/*',
    transform: function (file) {
        return pathWithoutFirstFolder(file);
      },
    move: true
  }))
  // Build, error logging
  .build(function(err) {
    if (err) throw err;
  });