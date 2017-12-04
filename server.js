var path = require('path')
var express = require('express')
var session = require('express-session')
var bodyParser = require('body-parser')
var nunjucks = require('nunjucks')
var moment = require('moment')
var dateFilter = require('nunjucks-date-filter')
var config = require('./config.js')
var utils = require('./lib/utils.js')

var app = express()

//moment().format()

// Application settings
app.set('view engine', 'html')

var env = nunjucks.configure('./app/views', {
    autoescape: true,
    express: app,
    noCache: true
})
env.addFilter('date', dateFilter)

// Middleware to serve static assets
app.use('/', express.static(path.join(__dirname, '/public')))

// Disallow search index
app.use(function (req, res, next) {
  // Setting headers stops pages being indexed even if indexed pages link to them.
  res.setHeader('X-Robots-Tag', 'noindex')
  next()
})

// Support session data
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: Math.round(Math.random() * 100000).toString()
}))

// Add variables that are available in all views
app.use(function (req, res, next) {
  res.locals.serviceName = config.serviceName
  res.locals.jsNow = moment().format()
  next()
})

var myLogger = function (req, res, next) {
  console.log(req.session);
  next()
}
app.use(myLogger)

// Handle form POSTS
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}))

app.get('/', function(req, res) {
  req.session.destroy()
  res.render('index.html')
})

app.get('/start', function(req, res) {
  var creation = new moment()
  req.session.starting = true
  req.session.caseCreated = creation
  req.session.modificationTimestamp = creation
  req.session.caseRef = config.caseRef
  req.session.caseStatus = 'new'
  res.render('start.html', {
    session: req.session
  })
})

app.post('/rename-case', function(req, res) {
  req.session.modificationTimestamp = new moment() // POST indicates modifcation (a bit weak but prototype)
  req.session.caseRef = req.body['name']
  res.redirect('/case-overview');
})

app.get('/details-deceased', function(req, res) {
  res.render('details-deceased.html', {
    session: req.session
  })
  if (req.session.starting = true) {
    req.session.starting = false
  }
})

app.get('/edit-deceased', function(req, res) {
  res.render('edit-deceased.html', {
    session: req.session
  })
})
app.post('/edit-deceased', function(req, res) {
  req.session.modificationTimestamp = new moment() // POST indicates modifcation (a bit weak but prototype)
  req.session.deceased = req.body
  // make sure multiple choice elements are always arrays
  if (typeof req.body['communicable-infections'] === 'string') {
    var arr = new Array(req.body['communicable-infections'])
    req.session.deceased['communicable-infections'] = arr
  }
  if (typeof req.body['acdp'] === 'string') {
    var arr = new Array(req.body['acdp'])
    req.session.deceased['acdp'] = arr
  }
  // formatting and calculations
  // is the dod (at least) present?
  if (req.body['dod-year'] !== '' && req.body['dod-month'] !== '' && req.body['dod-day'] !== '') {
    if (req.body['tod-hour'] !== '' && req.body['tod-mins'] !== '') {
      var timeStr = ' ' + req.body['tod-hour'] + ':' + req.body['tod-mins'] + ':00'
    }
    var death = moment(
      req.body['dod-year'] + '-' +
      req.body['dod-month'] + '-' +
      req.body['dod-day'] +
      timeStr
    )
    req.session.deceased.deathTimestamp = death
  }
  // is dob present?
  if (req.body['dob-year'] !== '' && req.body['dob-month'] !== '' && req.body['dob-day'] !== '') {
    var birth = moment(req.body['dob-year'] + '-' + req.body['dob-month'] + '-' + req.body['dob-day'])
    req.session.deceased.birth = birth
  }
  if (typeof death !== 'undefined' && typeof birth !== 'undefined' ) {
    var age = death.diff(birth, 'years')
    req.session.deceased.age = age
  }
  res.redirect('/details-deceased');
})

// auto render any view that exists
app.get(/^\/([^.]+)$/, function (req, res) {
  var path = (req.params[0])
  res.render(path, { session: req.session }, function (err, html) {
    if (err) {
      res.render(path + '/index', function (err2, html) {
        if (err2) {
          console.log(err)
          res.status(404).send(err + '<br>' + err2)
        } else {
          res.end(html)
        }
      })
    } else {
      res.end(html)
    }
  })
})

// No robots plz
app.get('/robots.txt', function (req, res) {
  res.type('text/plain')
  res.send('User-agent: *\nDisallow: /')
})

// start the app
utils.findAvailablePort(app, function (port) {
  console.log('Listening on port ' + port + '   url: http://localhost:' + port)
  app.listen(port)
})
