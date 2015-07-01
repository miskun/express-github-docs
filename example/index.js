var express = require('express'),
    expresshbs  = require('express-handlebars'),
    path = require('path'),
    docs = require('../index.js');

var app = express();

// express middleware
app.engine('hbs', expresshbs({
    defaultLayout: 'main',
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(docs('docs', {
    'ghUser': 'miskun',
    'ghRepo': 'express-github-docs',
    'ghDir': 'docs',
    'syncOnStart': false
}));

app.listen(3000);
console.log('Open browser at: http://localhost:3000');