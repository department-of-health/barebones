const express = require('express')
const path = require('path')
const nunjucks = require('nunjucks')

const app = express()

// Middleware to serve static assets
app.use('/', express.static(path.join(__dirname, '/public')))

// Application settings
app.set('view engine', 'html')

var env = nunjucks.configure('./app/views', {
    autoescape: true,
    express: app,
    noCache: true
});

app.get('/', (req, res) => res.render('index.html'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))
