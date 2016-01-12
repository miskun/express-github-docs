var marked = require('marked'),
    fm = require('front-matter'),
    url = require('url'),

    // private vars
    rebaseLinksPath = "",
    ghUser = "",
    ghRepo = "",
    ghBranch = "",
    ghDir = "";

// initialize marked renderer
var renderer = new marked.Renderer();
renderer.link = function (href, title, text) {

    var localUrl = rebaseLink(rebaseLinksPath, href);

    var out = '<a href="' + localUrl + '"';
    if (title) {
        out += ' title="' + title + '"';
    }
    out += '>' + text + '</a>';
    return out;

};
renderer.image = function(href, title, text){

    var localUrl = rebaseLink(rebaseLinksPath, href);

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

function rebaseLink(rebaseRoot, href){

    var pUrl = url.parse(href);
    var localUrl = pUrl.path;

    console.log(pUrl);

    // rebase absolute URLs if the host is github.com
    if(pUrl.host){

        if(ghUser && ghRepo && ((pUrl.host == "github.com") || (pUrl.host == "raw.githubusercontent.com"))) {

            // ONLY rebase matching absolute GitHub links
            var ghTreeLink = "/" + [ghUser, ghRepo, "tree", ghBranch, ghDir].join("/");
            var ghBlobLink = "/" + [ghUser, ghRepo, "blob", ghBranch, ghDir].join("/");
            var ghRawLink = "/" + [ghUser, ghRepo, ghBranch, ghDir].join("/");

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
    } else if(localUrl && (localUrl.length > 0) && (localUrl[0] == "/")){

        localUrl = rebaseRoot + localUrl;

    }

    // remove readme.md && .md
    if(localUrl && (localUrl.length > 3) && (localUrl.substr(-3) == ".md")){

        // remove .md
        localUrl = localUrl.substr(0, localUrl.length-3);

        // remove readme
        if((localUrl.length > 6) && (localUrl.substr(-6).toLowerCase() == "readme")){
            localUrl = localUrl.substr(0, localUrl.length-6);
        }
    }

    // remove trailing slash
    if(localUrl && (localUrl.length > 1) && (localUrl.substr(-1) == "/")){
        localUrl = localUrl.substr(0, localUrl.length-1);
    }

    // add hash
    if(pUrl.hash){
        if(!localUrl) localUrl = '';
        localUrl += pUrl.hash;
    }

    return localUrl;
}

function mdParser(rawFile, opts){
    
    // expose private vars
    rebaseLinksPath = opts.rebasePath || "";
    ghUser = opts.ghUser || "";
    ghRepo = opts.ghRepo || "";
    ghBranch = opts.ghBranch || "master";
    ghDir = opts.ghDir || "docs";

    // parse front matter
    var data = fm(rawFile);

    // parse content
    if(data && data.body){
        data.content = marked(data.body);
    } else {
        data.content = "";
    }

    return data;
}

module.exports = mdParser;