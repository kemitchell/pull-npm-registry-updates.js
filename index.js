var multistream = require('multistream')
var query = require('querystring').stringify
var https = require('https')
var url = require('url')

var decoder = require('pull-utf8-decoder')
var filter = require('pull-stream/throughs/filter')
var pull = require('pull-stream')
var source = require('stream-to-pull-stream').source
var split = require('pull-split')
var through = require('pull-through')

module.exports = function (options) {
  options = options || {}
  var since = options.since || 0
  var limit = options.limit || 8
  var docs = options.include_docs || true
  var registry = url.parse(
    options.registry || 'https://replicate.npmjs.com'
  )
  var transform = options.transform

  return pull(
    source(multistream(function generator (callback) {
      https.request({
        method: 'GET',
        hostname: registry.hostname,
        path: '/_changes?' + query({
          since: since,
          limit: limit,
          include_docs: docs ? 'true' : 'false',
          feed: 'normal'
        })
      }, function (response) {
        var statusCode = response.statusCode
        if (statusCode !== 200) {
          callback(new Error('Server responded ' + statusCode))
        } else {
          callback(null, response)
        }
      })
        .once('error', function (error) {
          callback(error)
        })
        .end()
    })),
    decoder(),
    split(),
    through(
      function (line) {
        // CouchDB 2.0 responds to GET /{db}/_changes?feed=normal like:
        //
        //     {"results":[ // Skip.
        //     {"seq":2,"id":"...","changes":[...],"doc":{...}},
        //     {"seq":3,"id":"...","changes":[...],"doc":{...}},
        //     {"seq":4,"id":"...","changes":[...],"doc":{...}},
        //     {"seq":5,"id":"...","changes":[...],"doc":{...}}
        //     ],
        //     "last_seq":...}
        if (line.indexOf('{"seq":') === 0) {
          if (line.lastIndexOf(',') === line.length - 1) {
            line = line.slice(0, -1)
          }
          var update = JSON.parse(line)
          this.queue(transform ? transform(update) : update)
          since++
        }
      },
      function (end) {
        this.queue(null)
      }
    ),
    filter(function (chunk) {
      return chunk !== null
    })
  )
}
