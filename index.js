/*!
 * express-github-docs
 * Copyright(c) 2015 Miska Kaipiainen
 * MIT Licensed
 */

var path = require('path'),
    fs = require('fs'),
    url = require('url'),
    Toc = require('./lib/toc.js'),
    mdParser = require('./lib/md-parser.js'),
    ghPuller = require('node-gh-repo-puller'),
    ServeStatic = require('serve-static');

var expressgh = function(root, options){
    if (!root) {
        throw new TypeError('root path required')
    }

    if (typeof root !== 'string') {
        throw new TypeError('root path must be a string')
    }

    // defaults
    var o = options || {};
    o.ghUser = o.ghUser || "";
    o.ghRepo = o.ghRepo || "";
    o.ghBranch = o.ghBranch || "master";
    o.ghDir = o.ghDir || "";
    o.render = o.render || true;
    o.defaultLayout = o.defaultLayout || "docs";
    o.defaultTemplate = o.defaultTemplate || "docs";
    o.syncUrl = o.syncUrl || "_sync";
    o.syncOnStart = o.syncOnStart || false;
    o.root = path.resolve(root);
    o.title = o.title || undefined;

    // sanitize sync url; ensure leading "/" and remove trailing "/"
    if((o.syncUrl.length > 0) && (o.syncUrl[0] != "/")) o.syncUrl = "/" + o.syncUrl;
    if((o.syncUrl.length > 0) && (o.syncUrl[o.syncUrl.length-1] == "/")) o.syncUrl = o.syncUrl.substr(-1);

    // init static files server
    var serveStatic = ServeStatic(o.root);

    if(o.syncOnStart){
        syncGithub(o, function(e){
            if(!e){
                console.log("Sync with GitHub repository ["+ o.ghUser + "/" + o.ghRepo + "] done!");
            } else {
                console.log("Unable to sync with GitHub repository ["+ o.ghUser + "/" + o.ghRepo + "]!");
                console.log(e);
            }
        });
    }

    return function expressgh(req, res, next) {

        // resolve filepath
        var filePath = path.join(o.root, url.parse(req.url).pathname);

        // remove trailing slash
        if(filePath[filePath.length-1] === path.sep) filePath = filePath.slice(0,-1);

        // is sync url?
        if(req.url == o.syncUrl){
            syncGithub(o, function(e){
                if(!e){
                    res.send("Sync with GitHub repository ["+ o.ghUser + "/" + o.ghRepo + "] done!");
                } else {
                    res.send("Unable to sync with GitHub repository ["+ o.ghUser + "/" + o.ghRepo + "]!");
                }
            });
            return;
        }

        // lookup for the .md file, else serve static file
        if(fs.existsSync(filePath + ".md")){

            filePath = filePath + ".md";

        } else if(fs.existsSync(filePath + path.sep + "README.md")){

            // just to preserve relative paths in .md files
            var foo = url.parse(req.originalUrl).pathname;
            if(foo[foo.length-1] !== "/" ){

                foo += "/";

                var redirectTo = foo;
                if(url.parse(req.originalUrl).search){
                    redirectTo = foo + "?" + url.parse(req.originalUrl).search;
                }

                res.redirect(redirectTo);
                return;

            }

            filePath = filePath + path.sep + "README.md";

        } else {

            serveStatic(req, res, next);
            return;

        }

        // get the file contents
        var rawFile = fs.readFileSync(filePath, 'utf8');

        // parse the file
        req.egd = mdParser(rawFile, {
            rebasePath: req.baseUrl,
            ghUser: o.ghUser,
            ghRepo: o.ghRepo,
            ghBranch: o.ghBranch,
            ghDir: o.ghDir
        });

        // get table of contents
        var toc = new Toc(o.root);
        toc.get(function(tocErr, tocRes){

            // expose front matter attributes to template
            var attr = req.egd.attributes || {};
            attr.content = req.egd.content;

            // add table of contents
            attr.egdtoc = "";
            if(!tocErr){
                attr.egdtoc = tocRes.toHTML({
                    title: o.title,
                    rebasePath: req.baseUrl,
                    selected: req.url
                });
            }

            // render
            if(o.render && req.egd && (typeof req.egd.content !== 'undefined')){

                // if no layout or template, use defaults
                if(!attr.layout) attr.layout = o.defaultLayout;
                if(!attr.template) attr.template = o.defaultTemplate;

                res.render(attr.template, attr);

            } else {

                next();

            }

        });
    };
};

function syncGithub(o, callback){
    if((o.ghUser == "") || (o.ghRepo == "")){
        callback("Can not sync with GitHub! Invalid GitHub user/repo name!");
        return;
    }

    ghPuller({
        user: o.ghUser,
        repo: o.ghRepo,
        dir: o.ghDir,
        branch: o.ghBranch,
        target: o.root
    }, function(pullerErr, pullerSuccess){

        if(pullerErr){
            callback(pullerErr);
            return;
        }

        var toc = new Toc(o.root);
        toc.update(callback);

    });

}

module.exports = expressgh;
