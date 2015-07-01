---
title: Overview
toc_order: 1
---

# Express Github Docs

> The documentation is still a work in progress, so any feedback and requests are welcome. If you feel like something is missing, please [open an issue](https://github.com/miskun/express-github-docs/issues) at GitHub.

Welcome to Express Github Docs! Express Github Docs is [Express](http://expressjs.com/) middleware for generating documentation from GitHub repository.

## How Does It Work?

Express Github Docs is making it easy for developers to maintain documentation sites for their projects. It can fetch any directory from GitHub repository and serve the directory contents. It will automatically rebase all documentation page links to ensure they will work outside from GitHub context. The idea in short:

* Use GitHub repository to host all project documentation
* Typically, project documentation is stored in `/docs` directory at repository root. Naturally, the documentation must be accessible and usable through GitHub website repository browser. In addition, the contents of this documentation should be accessible from project specific documentation website.
* Automatically synchronize documentation data stored in GitHub with the web server hosting the documentation website.
* Naturally, support [markdown formatting](https://help.github.com/articles/markdown-basics/).
* Additional customization for documentation site rendering via [front matter](http://jekyllrb.com/docs/frontmatter/)

## Installation

Express Github Docs can be installed with NPM.

```sh
$ npm install express-github-docs
```

## Simple Usage

This is a simple usage example. It will serve files from `docs` directory.

```javascript
var express = require('express');
var docs = require('express-github-docs');

var app = express();

app.use(docs('docs', {
    'ghUser': 'miskun',
    'ghRepo': 'express-github-docs',
    'ghDir': 'docs'
}));

app.listen(3000);
```

For more advanced usage instructions, please see [Complete Reference Guide](usage/api-reference.md).
