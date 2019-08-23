var Metalsmith  = require('metalsmith');
var collections = require('metalsmith-collections');
var layouts     = require('metalsmith-layouts');
var markdown    = require('metalsmith-markdown');
var permalinks  = require('metalsmith-permalinks');
var debuglog    = require('metalsmith-debug');
var copy        = require('metalsmith-copy');
var debug       = require('debug')('metalsmith-PPEK-MAIN');

var slug        = require('slug');
const marked    = require("marked");

// --------------------------------------------------------------------------------

const contentDir    = "content"
const booksInDir    = "books"
const booksOutDir   = "konyvek"
const authorsOutDir = "szerzok"
const titlesOutDir  = "cimek"
const aboutOutDir   = "informaciok"

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

// Function that deletes different characters used as quotation marks
function deleteQuoteMarks(s) { 
  return s.replace(new RegExp("[,\"„”']", "gm"), "")
}

// A "Hungarian" sort
// It can sort by an attribute
// It can look for another attribute that takes priority if exists
function sortAccented(arr, reversed, sortingAttr, prioritizedSortingAttr) {
  let copiedArr = [...arr];

  copiedArr.sort((a, b) => {
    let x = ((sortingAttr) ?
               ((prioritizedSortingAttr && a[prioritizedSortingAttr]) ?
                   a[prioritizedSortingAttr]
                 : a[sortingAttr])
             : a);
    let y = ((sortingAttr) ?
             ((prioritizedSortingAttr && b[prioritizedSortingAttr]) ?
                 b[prioritizedSortingAttr]
               : b[sortingAttr])
           : b);
           
    if (typeof(x) === 'string') {
      x = deleteQuoteMarks(x.toLowerCase());
      y = deleteQuoteMarks(y.toLowerCase());
    } else {
      x = x.sort(Intl.Collator('hu').compare).join("")
      y = y.sort(Intl.Collator('hu').compare).join("")
    }
    return x.localeCompare(y, "hu") * (reversed ? -1 : 1)    
  });

  return copiedArr;
}

// A "Hungarian" dictionary sort that can sort by key, (whole) value or some attribute
// If the attribute does not exist, it falls back to the key
function dictsortAccented(val, by, attribute) {
  let newArray = [];
  // deliberately include properties from the object's prototype
  for (let k in val) { // eslint-disable-line guard-for-in, no-restricted-syntax
    let keyVal = [k, val[k]];
    if (by === 'attribute' && attribute != undefined) {
      let otherSortAttribute = val[k][attribute];
      if (otherSortAttribute === undefined) {
        otherSortAttribute = k;
      }
      keyVal.push(otherSortAttribute);
    }
    newArray.push(keyVal);
  }

  let sortIndex;
  if (by === undefined || by === 'key') {
    sortIndex = 0;
  } else if (by === 'value') {
    sortIndex = 1;
  } else if (by === 'attribute') {
    sortIndex = 2;
  } else {
    throw new Error(
      'dictsortAccented filter: You can only sort by either key or value');
  }

  newArray.sort((t1, t2) => {
    // We assume that these are strings. If not, then...
    var a = deleteQuoteMarks(t1[sortIndex].toUpperCase());
    var b = deleteQuoteMarks(t2[sortIndex].toUpperCase());
    return a.localeCompare(b, 'hu') // eslint-disable-line no-nested-ternary
  });

  return newArray;
}

// Nunjucks options
const nunjucksRendererOptions = {
  filters: { sortAccented: sortAccented, dictsortAccented: dictsortAccented }
};

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
    return function(_files, metalsmith, done){
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

// Taxonomy = property of a collection element containing
// objects that look like: { name: "taxonomyValue", sortingName: "taxonomyValueForSorting" }

// Note that the TAXONOMY ITEM's structure (obj. with name, sortingName) is not isomorph to
// the structure of the taxonomy-collections' items!!!

// Sort a taxonomy of a collection
function sortCollectionTaxonomies(metadata, collectionName, taxonomyName) {
    debug("[SORT] Processing taxonomy: " + taxonomyName)
    metadata.collections[collectionName].forEach(function(collectionElem) {
        collectionElem[taxonomyName] =
            sortAccented(collectionElem[taxonomyName], false, "name", "sortingName");
    })
}

// Create their own collections from taxonomies (properties of collections with multiple values)
function createTaxonomyCollections(metadata, collectionName, taxonomyName) {
    debug("[OWN-COLLECTIONS] Processing taxonomy: " + taxonomyName)
    metadata.collections[taxonomyName] = metadata.collections[taxonomyName] || {};
    metadata.collections[collectionName].forEach(function(collectionElem) {
        collectionElem[taxonomyName].forEach(function(taxonomyValueObj) {
            debug("[OWN-COLLECTIONS] Adding " + collectionElem.title + " to " + taxonomyName + "/" + taxonomyValueObj)
            let taxonomyValue = taxonomyValueObj["name"]
            let sortingName = taxonomyValueObj["sortingName"]
            // if (typeof(taxonomyValue) != 'string' && Object.keys(taxonomyValue).length == 1) {
            //   value = Object.keys(taxonomyValue)[0]
            //   sortingName = taxonomyValue[value]
            // }
            metadata.collections[taxonomyName][taxonomyValue] = metadata.collections[taxonomyName][taxonomyValue] || []
            metadata.collections[taxonomyName][taxonomyValue]["sortingName"] = sortingName
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
            // TODO is this really this complicated??
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
    authorsOutDir: authorsOutDir,
    titlesOutDir: titlesOutDir,
    aboutOutDir: aboutOutDir
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
                   .replace("titles", titlesOutDir)
                   .replace("about", aboutOutDir)
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
  // Create taxonomy value list pages
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
    pattern: contentDir + "/**/*",
    engineOptions: nunjucksRendererOptions
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