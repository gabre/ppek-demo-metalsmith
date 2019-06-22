var Metalsmith  = require('metalsmith');
var collections = require('metalsmith-collections');
var layouts     = require('metalsmith-layouts');
var markdown    = require('metalsmith-markdown');
var permalinks  = require('metalsmith-permalinks');
var debuglog    = require('metalsmith-debug');
var copy        = require('metalsmith-copy');
var tags        = require('metalsmith-tags')
var debug       = require('debug')('metalsmith-PPEK-MAIN');

// marked will be downloaded as a dependency by metalsmith-markdown
const marked    = require("marked");


// --------------------------------------------------------------------------------

const contentDir    = "content"
const booksInDir    = "books"
const booksOutDir   = "konyvek"
const authorsOutDir = "szerzok"

// --------------------------------------------------------------------------------
// Custom renderer to append specific css to markdown

const pureCssRenderer = () => {
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

function addPathsToContent(select) {
    return function(files, metalsmith, done){
      setImmediate(done);
      debug("Files:")
      Object.keys(files).forEach(function(filepath){
        addPathsToContentForRef({f: files[filepath], fp: filepath})
      });
      debug("Metadata:")
      select(metalsmith).forEach(function(elem) {
        debug(elem)
        addPathsToContentForRef({f: elem, fp: elem.path + "/index.html"})
      });
    };

    function addPathsToContentForRef(reference) {
        if (reference.fp.startsWith(contentDir)) {
            debug("Processing " + reference.fp)
            // For contentDir/some.html, contentDir/some/dirs/some.html:
            // segments - contentDir - the file itself
            // For contentDir, contentDir/some/dirs:
            // segments - contentDir
            var segmentsToRemove = 1
            if (reference.fp.endsWith(".html")) {
                segmentsToRemove = 2
            }
            const segments = reference.fp.split(/[\\/]/)
            const moveBackThisMany = segments.length - segmentsToRemove
            const rootRelativePath = "../".repeat(moveBackThisMany) + '.'
            const ownRelativePathFromRoot = segments.slice(1).join("/")
            debug("Relative path to root of content is " + rootRelativePath)
            debug("Relative path from root of content is " + ownRelativePathFromRoot)

            reference.f.rootRelativePath = rootRelativePath;
            reference.f.ownRelativePathFromRoot = ownRelativePathFromRoot
        }
    }
}

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

function sortCollectionTaxonomies(metadata, collectionName, taxonomyName) {
    debug("Processing taxonomy: " + taxonomyName)
    metadata.collections[collectionName].forEach(function(collectionElem) {
        collectionElem[taxonomyName].sort()
    })
}

// Unused but left here for later usage, even if it is a bad practice
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

// --------------------

function pathWithoutFirstFolder(file) {
    return file.split(/[\\/]/).slice(1).join("/")
}

// --------------------------------------------------------------------------------
// Main Metalsmith call

Metalsmith(__dirname)         // __dirname defined by node.js:
                              // name of current working directory
  .metadata({                 // add any variable you want
                              // use them in layout-files
    sitename: "Pázmány Péter Elekntronikus Könyvtár",
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
  .use(collections({
    books: contentDir + '/' + booksOutDir + '/*.md'
  }))
  .use(transformCollections(sortCollectionTaxonomies, {
    books: ["authors"]
  }))
  .use(markdown({
    renderer: pureCssRenderer()
  }))
  .use(permalinks({
    relative: false
  }))
  .use(addPathsToContent(function(metalsmith) {
      return metalsmith.metadata().collections.books
  }))
  .use(tags({
    handle: 'authors',
    path: contentDir + '/' + authorsOutDir + '/:tag.html',
    layout:'author-book-list.njk',
    sortBy: 'title',
    reverse: false,
    skipMetadata: false,
    metadataKey: "authors",
    slug: {mode: 'rfc3986'}
  }))
.use(function(f, m, d) {
    debug(m.metadata().books)
    // debug(f)
    d()
})
  .use(layouts({
    default: 'layout.njk',
    pattern: contentDir + "/**/*"
  }))
  // Remove uneeded top-level folders: content, static
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
  .build(function(err) {
    if (err) throw err;
  });