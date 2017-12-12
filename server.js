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

// Grab environment variables specified in Procfile or as Heroku config vars
var username = process.env.USERNAME
var password = process.env.PASSWORD
var appEnvironment = process.env.NODE_ENV || 'development'
var useAuth = process.env.USE_AUTH || config.useAuth
var useHttps = process.env.USE_HTTPS || config.useHttps

appEnvironment = appEnvironment.toLowerCase()
useAuth = useAuth.toLowerCase()
useHttps = useHttps.toLowerCase()

// Force HTTPs on production connections
if (appEnvironment === 'production' && useHttps === 'true') {
  app.use(utils.forceHttps)
}

// Authenticate against the environment-provided credentials, if running
// the app in production (Heroku, effectively)
if (appEnvironment === 'production' && useAuth === 'true') {
  app.use(utils.basicAuth(username, password))
}

// Application settings
app.set('view engine', 'html')

var env = nunjucks.configure('./app/views', {
    autoescape: true,
    express: app,
    noCache: true
})
env.addFilter('date', dateFilter)

// Support session data
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: Math.round(Math.random() * 100000).toString()
}))

var myLogger = function (req, res, next) {
  console.log(req.session);
  next()
}
app.use(myLogger)

// Disallow search index
app.use(function (req, res, next) {
  // Setting headers stops pages being indexed even if indexed pages link to them.
  res.setHeader('X-Robots-Tag', 'noindex')
  next()
})

// Add variables that are available in all views
app.use(function (req, res, next) {
  res.locals.serviceName = config.serviceName
  res.locals.jsNow = moment().format()
  next()
})

// Handle form POSTS
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}))

// Middleware to serve static assets
app.use('/', express.static(path.join(__dirname, '/public')))

app.get('/', function(req, res) {
  req.session.destroy()
  res.render('index')
})

app.get('/start', function(req, res) {
  var creation = new moment()
  req.session.caseCreated = creation
  req.session.modificationTimestamp = creation
  req.session.caseRef = config.caseRef
  req.session.caseStatus = 'new'
  req.session.contacts = 0
  res.render('start', {
    session: req.session
  })
})

app.get('/case-overview', function(req, res) {
  res.render('case-overview', {
    session: req.session
  })
})

app.post('/rename-case', function(req, res) {
  req.session.modificationTimestamp = new moment() // POST indicates modifcation (a bit weak but prototype)
  req.session.caseRef = req.body['name']
  res.redirect('/case-overview');
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

app.post('/edit-cause-of-death', function(req, res) {
  req.session.modificationTimestamp = new moment() // POST indicates modifcation (a bit weak but prototype)
  req.session.cause = req.body
  res.redirect('/details-deceased');
})

// a post with NO slug is a new contact
app.post('/edit-contact-examination', function(req, res) {
  req.session.modificationTimestamp = new moment()
  if (typeof req.session['contacts-examination'] === 'undefined') {
    req.session['contacts-examination'] = []
  }
  // let's build up the 'contact' object
  var contact = {}
  contact['name'] = req.body['name']
  var urlName = req.body['name'].toLowerCase().replace(/ /g, '-')
  contact['url-name'] = urlName
  contact['role'] = req.body['role']
  contact['profession'] = req.body['profession']
  contact['gmc-code'] = req.body['gmc-code']  // UID
  contact['primary-channel'] = req.body['primary-channel']
  contact.methods = []
  contact.methods.push({ name: 'tel-primary', title: 'telephone', value: req.body['tel-primary'] })
  contact.methods.push({ name: 'tel-secondary', title: 'telephone', value: req.body['tel-secondary'] })
  contact.methods.push({ name: 'tel-pager', title: 'pager', value: req.body['tel-pager'] })
  contact.methods.push({ name: 'email', title: 'email', value: req.body['email'] })
  contact.methods.push({
    name: 'address',
    title: 'address',
    value: [
      req.body['address-1'],
      req.body['address-2'],
      req.body['address-3'],
      req.body['address-4'],
      req.body['postcode']
    ]
  })
  contact.notes = req.body['notes']
  req.session['contacts-examination'].push(contact)
  req.session.contacts++
  res.redirect('/details-contact-examination/' + urlName);
})

// a post with NO slug is a new contact
app.post('/edit-contact-deceased', function(req, res) {
  req.session.modificationTimestamp = new moment()
  if (typeof req.session['contacts-deceased'] === 'undefined') {
    req.session['contacts-deceased'] = []
  }
  // let's build up the 'contact' object
  var contact = {}
  contact['name'] = req.body['name']
  var urlName = req.body['name'].toLowerCase().replace(/ /g, '-')
  contact['url-name'] = urlName
  contact['relationship'] = req.body['relationship']
  contact['present-at-death'] = req.body['present-at-death']
  contact['informant'] = req.body['informant']
  contact['primary-channel'] = req.body['primary-channel']
  contact.methods = []
  contact.methods.push({ name: 'tel-primary', title: 'telephone', value: req.body['tel-primary'] })
  contact.methods.push({ name: 'tel-secondary', title: 'telephone', value: req.body['tel-secondary'] })
  contact.methods.push({ name: 'tel-pager', title: 'pager', value: req.body['tel-pager'] })
  contact.methods.push({ name: 'email', title: 'email', value: req.body['email'] })
  contact.methods.push({
    name: 'address',
    title: 'address',
    value: [
      req.body['address-1'],
      req.body['address-2'],
      req.body['address-3'],
      req.body['address-4'],
      req.body['postcode']
    ]
  })
  contact.notes = req.body['notes']
  req.session['contacts-deceased'].push(contact);
  req.session.contacts++
  res.redirect('/details-contact-deceased/' + urlName);
})

// return contact details - professional
app.get('/details-contact-examination/:contactId', function(req, res) {
  var contact = req.params['contactId']
  var contacts = req.session['contacts-examination']
  for (var c = 0; c < contacts.length; c++) {
    if (contacts[c]['url-name'] === contact) {
      var plucked = contacts[c]
      break;
    }
  }
  res.render('details-contact-examination', {
    details: plucked,
    session: req.session
  });
})

// return contact details - citizen
app.get('/details-contact-deceased/:contactId', function(req, res) {
  var contact = req.params['contactId']
  var contacts = req.session['contacts-deceased']
  for (var c = 0; c < contacts.length; c++) {
    if (contacts[c]['url-name'] === contact) {
      var plucked = contacts[c]
      break;
    }
  }
  res.render('details-contact-deceased', {
    details: plucked,
    session: req.session
  });
})

// Edit a contact
app.get('/edit-contact-examination/:contactId', function(req, res) {
  var contact = req.params['contactId']
  var contacts = req.session['contacts-examination']
  for (var c = 0; c < contacts.length; c++) {
    if (contacts[c]['url-name'] === contact) {
      var plucked = contacts[c]
      break;
    }
  }
  res.render('edit-contact-examination', {
    edit: true,
    details: plucked,
    session: req.session
  });
})

app.get('/edit-contact-deceased/:contactId', function(req, res) {
  var contact = req.params['contactId']
  var contacts = req.session['contacts-deceased']
  for (var c = 0; c < contacts.length; c++) {
    if (contacts[c]['url-name'] === contact) {
      var plucked = contacts[c]
      break;
    }
  }
  res.render('edit-contact-deceased', {
    edit: true,
    details: plucked,
    session: req.session
  });
})

// a post WITH a slug is an edit
app.post('/edit-contact-examination/:contactId', function(req, res) {
  req.session.modificationTimestamp = new moment()
  // build a new 'contact' object
  var contact = {}
  contact['name'] = req.body['name']
  var urlName = req.body['name'].toLowerCase().replace(/ /g, '-')
  contact['url-name'] = urlName
  contact['role'] = req.body['role']
  contact['profession'] = req.body['profession']
  contact['gmc-code'] = req.body['gmc-code']  // UID
  contact['primary-channel'] = req.body['primary-channel']
  contact.methods = []
  contact.methods.push({ name: 'tel-primary', title: 'telephone', value: req.body['tel-primary'] })
  contact.methods.push({ name: 'tel-secondary', title: 'telephone', value: req.body['tel-secondary'] })
  contact.methods.push({ name: 'tel-pager', title: 'pager', value: req.body['tel-pager'] })
  contact.methods.push({ name: 'email', title: 'email', value: req.body['email'] })
  contact.methods.push({
    name: 'address',
    title: 'address',
    value: [
      req.body['address-1'],
      req.body['address-2'],
      req.body['address-3'],
      req.body['address-4'],
      req.body['postcode']
    ]
  })
  contact.notes = req.body['notes']

  // Get the right contact to edit
  var target = req.params['contactId']
  for (var c = 0; c < req.session['contacts-examination'].length; c++) {
    if (req.session['contacts-examination'][c]['url-name'] === target) {
      req.session['contacts-examination'][c] = contact
      break;
    }
  }
  res.redirect('/details-contact-examination/' + urlName);
})

app.post('/edit-contact-deceased/:contactId', function(req, res) {
  req.session.modificationTimestamp = new moment()
  // build a new 'contact' object
  var contact = {}
  contact['name'] = req.body['name']
  var urlName = req.body['name'].toLowerCase().replace(/ /g, '-')
  contact['url-name'] = urlName
  contact['relationship'] = req.body['relationship']
  contact['present-at-death'] = req.body['present-at-death']
  contact['informant'] = req.body['informant']
  contact['primary-channel'] = req.body['primary-channel']
  contact.methods = []
  contact.methods.push({ name: 'tel-primary', title: 'telephone', value: req.body['tel-primary'] })
  contact.methods.push({ name: 'tel-secondary', title: 'telephone', value: req.body['tel-secondary'] })
  contact.methods.push({ name: 'tel-pager', title: 'pager', value: req.body['tel-pager'] })
  contact.methods.push({ name: 'email', title: 'email', value: req.body['email'] })
  contact.methods.push({
    name: 'address',
    title: 'address',
    value: [
      req.body['address-1'],
      req.body['address-2'],
      req.body['address-3'],
      req.body['address-4'],
      req.body['postcode']
    ]
  })
  contact.notes = req.body['notes']

  // Get the right contact to edit
  var target = req.params['contactId']
  for (var c = 0; c < req.session['contacts-deceased'].length; c++) {
    if (req.session['contacts-deceased'][c]['url-name'] === target) {
      req.session['contacts-deceased'][c] = contact
      break;
    }
  }
  res.redirect('/details-contact-deceased/' + urlName);
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
