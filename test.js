var registry = require('./')

var stream = registry({
  transform: function stripProperties (chunk) {
    delete chunk.changes
    var doc = chunk.doc
    if (doc) {
      Object.keys(doc).forEach(function (key) {
        if (key !== 'versions' && key !== 'name') {
          delete doc[key]
        }
      })
      var versions = doc.versions
      if (versions) {
        Object.keys(versions).forEach(function (version) {
          versions[version] = {
            dependencies: versions[version].dependencies
          }
        })
      }
    }
    return chunk
  }
})
var counter = 100

function pull () {
  stream(false, function (_, chunk) {
    counter--
    console.log('%s %s is %j', 'chunk', 100 - counter, chunk)
    if (counter > 0) {
      pull()
    }
  })
}

pull()
