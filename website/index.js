var express = require('express')
var fs = require('fs')
var https = require('https')
var app = express()

app.use(express.static('public'))

https.createServer({
  key: fs.readFileSync('localhost-keys/localhost.key'),
  cert: fs.readFileSync('localhost-keys/localhost.crt')
}, app)
.listen(4000, function () {
  console.log('Weblog using https on port 4000')
})

