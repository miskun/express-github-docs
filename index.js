/*!
 * express-github-docs
 * Copyright(c) 2015 Miska Kaipiainen
 * MIT Licensed
 */

var path = require('path'),
    marked = require('marked'),
    fm = require('front-matter'),
    fs = require('fs-extended'),
    url = require('url'),
    ghPuller = require('node-gh-repo-puller'),
    cheerio = require('cheerio'),
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

    // sanitize sync url; ensure leading "/" and remove trailing "/"
    if((o.syncUrl.length > 0) && (o.syncUrl[0] != "/")) o.syncUrl = "/" + o.syncUrl;
    if((o.syncUrl.length > 0) && (o.syncUrl[o.syncUrl.length-1] == "/")) o.syncUrl = o.syncUrl.substr(-1);

    // init static files server
    var serveStatic = ServeStatic(o.root);

    // rebase links
    var rebaseLinksPath = "";

    // initialize marked renderer
    var renderer = new marked.Renderer();
    renderer.link = function (href, title, text) {

        var localUrl = rebaseLink(rebaseLinksPath, href, o);

        var out = '<a href="' + localUrl + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '>' + text + '</a>';
        return out;

    };
    renderer.image = function(href, title, text){

        var localUrl = rebaseLink(rebaseLinksPath, href, o);

        var out = '<img src="' + localUrl + '" alt="' + text + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += '/>';
        return out;

    };
    marked.setOptions({
        renderer: renderer,
        gfm: true,
        tables: true,
        breaks: false,
        pedantic: false,
        sanitize: true,
        smartLists: true,
        smartypants: false
    });

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

        // set rebase link path
        rebaseLinksPath = req.baseUrl;

        // resolve filepath
        var filePath = path.join(o.root, req.url);

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
        } else if(fs.existsSync(filePath + path.sep + "readme.md")){

            // just to preserve relative paths in .md files
            if(req.originalUrl[req.originalUrl.length-1] !== "/" ){
                res.redirect(req.originalUrl + "/");
                return;
            }

            filePath = filePath + path.sep + "readme.md"

        } else {
            serveStatic(req, res, next);
            return;
        }

        // get the file contents
        var rawFile = fs.readFileSync(filePath, 'utf8');

        // parse front matter
        req.gh = fm(rawFile);

        // parse content
        if(req.gh && req.gh.body){
            req.gh.content = marked(req.gh.body);
        } else {
            req.gh.content = "";
        }

        // render
        if(o.render && req.gh && (typeof req.gh.content !== 'undefined')){

            // expose front matter attributes to template
            var attr = req.gh.attributes || {};
            attr.content = req.gh.content;

            // if no layout or template, use defaults
            if(!attr.layout) attr.layout = o.defaultLayout;
            if(!attr.template) attr.template = o.defaultTemplate;

            res.render(attr.template, attr);

        } else {

            next();

        }
    };

};

function rebaseLink(rebaseRoot, href, o){

    o = o || {};

    var pUrl = url.parse(href);
    var localUrl = pUrl.path;

    // rebase absolute URLs if the host is github.com
    if(pUrl.host){

        if(o.ghUser && o.ghRepo && ((pUrl.host == "github.com") || (pUrl.host == "raw.githubusercontent.com"))) {

            // ONLY rebase matching absolute GitHub links
            var ghTreeLink = "/" + [o.ghUser, o.ghRepo, "tree", o.ghBranch, o.ghDir].join("/");
            var ghBlobLink = "/" + [o.ghUser, o.ghRepo, "blob", o.ghBranch, o.ghDir].join("/");
            var ghRawLink = "/" + [o.ghUser, o.ghRepo, o.ghBranch, o.ghDir].join("/");

            if (pUrl.path.indexOf(ghTreeLink) == 0) {
                localUrl = rebaseRoot + pUrl.path.substring(ghTreeLink.length);
            } else if (pUrl.path.indexOf(ghBlobLink) == 0) {
                localUrl = rebaseRoot + pUrl.path.substring(ghBlobLink.length);
            } else if(pUrl.path.indexOf(ghRawLink) == 0) {
                localUrl = rebaseRoot + pUrl.path.substring(ghRawLink.length);
            } else {

                // cannot rebase anything
                return href;

            }

        } else {

            // cannot rebase anything
            return href;

        }

        // rebase any other absolute URLs
    } else if((localUrl.length > 0) && (localUrl[0] == "/")){

        localUrl = rebaseRoot + localUrl;

    }

    // remove readme.md && .md
    if((localUrl.length > 3) && (localUrl.substr(-3) == ".md")){

        // remove .md
        localUrl = localUrl.substr(0, localUrl.length-3);

        // remove readme
        if((localUrl.length > 6) && (localUrl.substr(-6).toLowerCase() == "readme")){
            localUrl = localUrl.substr(0, localUrl.length-6);
        }
    }

    // remove trailing slash
    if((localUrl.length > 1) && (localUrl.substr(-1) == "/")){
        localUrl = localUrl.substr(0, localUrl.length-1);
    }

    return localUrl;
}

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
    }, function(ghError){
        if(!ghError){
            getToc(o.root, function(tocError, toc){
                if(!tocError){
                    console.log(tocError, toc);
                }
                callback(tocError, toc);
            });
        } else {
            callback(ghError);
        }
    });
}

function getToc(dir, callback){

    var filesCount = 0;
    var toc = {};

    function getTocEntry(fileItem){
        var filePath = path.join(dir, fileItem);

        // we only care about .md files
        if(fileItem.substr(-3) != ".md"){

            filesCount--;
            if(filesCount <= 0){
                callback(null, toc);
            }

            return;
        }

        fs.readFile(filePath, 'utf8', function(err, rawFile){

            function gotTitle(title){
                // only add files with proper title
                if(title != "")
                    toc[fileItem] = title;

                // check if we have processed everything?
                filesCount--;
                if(filesCount <= 0){
                    callback(null, toc);
                }
            }

            if(!err){

                // parse title, default to fileItem
                var defaultTitle = fileItem;
                var fmFile = fm(rawFile);
                if(fmFile.attributes.toc_title){
                    gotTitle(fmFile.attributes.toc_title);
                    return;
                }
                if(fmFile.attributes.title){
                    gotTitle(fmFile.attributes.title);
                    return;
                }
                if(fmFile.attributes.toc_hide){
                    gotTitle("");
                    return;
                }
                console.log(fmFile);
                var mdFile = marked(fmFile.body);
                var $ = cheerio.load(mdFile);

                var $h = $('h1');
                if($h.length > 0) {
                    console.log($h.first().text());
                    defaultTitle = $h.first().text();
                }
                gotTitle(defaultTitle);
                return;

            } else {
                // should never happen...
                // check if we have processed everything?
                filesCount--;
                if(filesCount <= 0){
                    callback(null, toc);
                }

            }
        });

    }

    fs.listAll(dir, { recursive: true }, function (err, files) {

        if(!err){
            if(files.length == 0){
                callback(null, toc);
            } else {
                filesCount = files.length;
                for(var i=0; i<files.length; i++){
                    getTocEntry(files[i]);
                }
            }
        } else {
            callback(err);
        }
    })

}

module.exports = expressgh;