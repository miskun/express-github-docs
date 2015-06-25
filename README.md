# Express GitHub Docs

Express Middleware for Generating Documentation from GitHub Repository.

## Install

```sh
npm install express-github-docs
```

## Usage

This is a simple usage example. It will serve files from `docs` directory.

```javascript
var express = require('express');
var docs = require('express-github-docs');

var app = express();

app.use('/docs', docs('docs', {
    'ghUser': 'miskun',
    'ghRepo': 'express-github-docs',
    'ghDir': 'docs'
}));

app.listen(3000);
```
