var linkRelParser = require('link-rel-parser')
var parseEmail = require('email-addresses').parseOneAddress
var URI = require('URIjs')
var http = require('http')
var url = require('url')
var ecstatic = require('ecstatic')
var path = require('path')

function indiefinger (principal, cb) {
  var type = detectType(principal)
  switch(type) {
    case 'url':
      return linkRelParser(principal, function (e, links) {
        if (e) { return cb(e) }
        var jrd = {
          subject: principal,
          links: Object.keys(links).reduce(function (flat, rel) {
            var nextLinks = links[rel].map(function (href) {
              return {
                rel: rel,
                href: href
              }
            })
            return flat.concat(nextLinks)
          }, [])
        }
        cb(e, jrd)
      })

    case 'email':
      var email = parseEmail(principal)
      console.log(email)
      principal = new URI('https://' + email.domain)
        .directory('~' + email.local)
        .href()
      return indiefinger(principal, cb)

    case 'default':
      return cb(Error('invalid principal: ' + principal))
  }
}


function detectType(x) {
  return ~x.indexOf('@') ? 'email' : 'url'
}
module.exports = indiefinger

if (process.env.PORT) {

  var static = ecstatic({root: path.join(__dirname, 'public')})

  http.createServer(function (req, res) {

    var requrl = url.parse(req.url, true) 
    console.log(requrl)
    if (requrl.pathname !== '/.well-known/webfinger') {
      return static(req, res)
    }

    var qs = requrl.query
    console.log(qs)

    if (!qs.resource) {
      res.statusCode = 400
      return res.end('missing required parameter resource')
    }

    indiefinger(qs.resource, function (e, jrd) {
      if (e) {
        res.statusCode = 500
        console.error(e)
        return res.end('an error occurred')
      }

      if (qs.rel) {
        // filter to only requested rels
        var rels = [].concat(qs.rel)
        jrd.links = jrd.links.filter(function (link) {
          return ~rels.indexOf(link.rel)
        })
      }

      res.setHeader('content-type','application/jrd+json')
      res.setHeader('access-control-allow-origin','*')
      res.end(JSON.stringify(jrd))
    })

  }).listen(process.env.PORT, function (e) {
    if (e) { return console.error(e) }
    console.log('listening on ' + process.env.PORT)
  })
}

// e.g.
// indiefinger('http://jden.us', function (e, l) {
//   console.log(e, l)
// })