var multistream = require('multistream')
var query = require('querystring').stringify
var https = require('https')
var url = require('url')

var decoder = require('pull-utf8-decoder')
var filter = require('pull-stream/throughs/filter')
var map = require('pull-stream/throughs/map')
var pull = require('pull-stream')
var source = require('stream-to-pull-stream').source
var split = require('pull-split')

module.exports = function (options) {
  var since = options.since || 0
  var limit = options.limit || 8
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
          include_docs: 'true',
          feed: 'continuous'
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
    map(function (chunk) {
      chunk = JSON.parse(chunk)
      if (chunk.hasOwnProperty('last_seq')) {
        since = chunk.last_seq
        return null
      } else {
        return transform ? transform(chunk) : chunk
      }
    }),
    filter(function (chunk) {
      return chunk !== null
    })
  )
}
