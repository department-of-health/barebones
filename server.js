const express = require('express')
const path = require('path')
const nunjucks = require('nunjucks')

const app = express()

// Application settings
app.set('view engine', 'html')

var env = nunjucks.configure('./app/views', {
    autoescape: true,
    express: app,
    noCache: true
});

// Middleware to serve static assets
app.use('/', express.static(path.join(__dirname, '/public')))

// Disallow search index
app.use(function (req, res, next) {
  // Setting headers stops pages being indexed even if indexed pages link to them.
  res.setHeader('X-Robots-Tag', 'noindex')
  next()
})

app.get('/', (req, res) => res.render('index.html'))

// No robots plz
app.get('/robots.txt', function (req, res) {
  res.type('text/plain')
  res.send('User-agent: *\nDisallow: /')
})

app.listen(3000, () => console.log('Example app listening on port 3000!'))
