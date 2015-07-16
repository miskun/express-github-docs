var fs = require('fs'),
    path = require('path'),
    fm = require('front-matter'),
    marked = require('marked'),
    cheerio = require('cheerio');

function Toc(dir){
    this.dir = dir;
    this.tocFileName = 'index.toc';
    this.children = [];
    this.class = "";
    return this;
}

Toc.prototype.get = function(callback){
    var self = this;
    this.load(function(loadErr, loadRes){
        if(loadErr){
            self.update(callback);
            return;
        }
        callback(null, loadRes);
    });
};

Toc.prototype.sort = function(){

    this.children.sort(function(a, b){
        return a.order-b.order
    });

    for(var i=0; i<this.children.length; i++){
        this.children[i].sort();
    }

};

Toc.prototype.update = function(callback) {
    var self = this;
    this.generate(function(genErr, genRes){
        if(genErr) {
            callback(genErr);
            return;
        }
        self.save(function(saveErr, saveRes){
            if(saveErr) {
                callback(seveErr);
                return;
            }
            callback(null, self);
        });
    });
};

Toc.prototype.load = function(callback){
    var tocFilePath = path.join(this.dir, this.tocFileName);
    var self = this;
    fs.readFile(tocFilePath, 'utf8', function(err, rawToc){
        if(err) {
            callback(err);
            return;
        }

        try{
            var objToc = JSON.parse(rawToc);
        } catch(e){
            // not JSON file
            callback(e);
            return;
        }

        self.class = objToc.class || "";

        for(var i=0; i<objToc.children.length; i++){
            var item = objToc.children[i];
            self.addItem(item);
        }

        callback(null, self);
    });
};

Toc.prototype.save = function(callback){
    var tocFilePath = path.join(this.dir, this.tocFileName);

    var self = this;
    var data = JSON.parse(JSON.stringify(this));
    delete data.dir;
    delete data.tocFileName;

    fs.writeFile(tocFilePath, JSON.stringify(data), function(saveErr){
        if(saveErr){
            callback(saveErr);
            return;
        }
        callback(null, self);
    });
};

Toc.prototype.generate = function(callback){

    var childs = fs.readdirSync(this.dir);
    for(var i=0; i<childs.length; i++){

        // we are only interested in .md files and directories
        if((childs[i].length > 3) && (childs[i].substr(-3).toLowerCase() == ".md")){
            this.addItem({
                path: path.join(this.dir, childs[i]),
                rootPath: this.dir
            })
        } else if(fs.statSync(path.join(this.dir, childs[i])).isDirectory()){
            this.addItem({
                path: path.join(this.dir, childs[i]),
                rootPath: this.dir
            })
        }

    }

    this.sort();

    callback(null, this);
};

Toc.prototype.addItem = function(o){
    this.children.push(new TocItem(o));
};

Toc.prototype.toHTML = function(opts){
    opts = opts || {};

    opts.title = (typeof opts.title == "undefined") ? "Navigation" : opts.title;
    opts.class = opts.class || "egd-toc";
    // opts.selected = opts.selected;
    opts.rebasePath = opts.rebasePath || "";

    var s = "";

    if(this.children.length > 0){

        s += '<ul class="'+opts.class+'">';

        if(opts.title && (opts.title !== false)){
            s += '<li class="' + opts.class + '-title">' + opts.title;

            // group all toc items without sub items under the title
            var subItems = "";
            for(var i=0; i<this.children.length; i++){
                if(this.children[i].children.length == 0) subItems += this.children[i].toHTML(opts);
            }

            if(subItems != ""){
                s += '<ul class="'+opts.class + '-root">' + subItems + '</ul>';
            }

            s += '</li>';

            for(var i=0; i<this.children.length; i++){
                if(this.children[i].children.length > 0) s += this.children[i].toHTML(opts);
            }

        } else {

            for(var i=0; i<this.children.length; i++){
                s += this.children[i].toHTML(opts);
            }

        }

        s += '</ul>';
    }

    return s;
};


function TocItem(o){

    // defaults
    o = o || {};
    this.title = o.title || "";
    this.link = o.link || "";
    this.isLink = (typeof o.isLink == "undefined") ? false : o.isLink;
    this.order = o.order || 1000;
    this.class = o.class || "";
    this.hidden = (typeof o.hidden == "undefined") ? false : o.hidden;
    this.children = [];

    if(o.children && (o.children.length > 0)){
        for(var i=0; i<o.children.length; i++){
            this.addItem(o.children[i]);
        }
    }

    // if path information is given, resolve from path
    if(o.path && o.rootPath){
        this.fromFile(o.path, o.rootPath);
    }

}

TocItem.prototype.sort = function(){

    this.children.sort(function(a, b){
        return a.order-b.order
    });

    for(var i=0; i<this.children.length; i++){
        this.children[i].sort();
    }

};

TocItem.prototype.fromFile = function(filePath, rootPath){

    var attr = {};

    if(filePath.indexOf(rootPath) != 0)
        throw "ERROR! filePath must be relative to rootPath";

    try{
        var stats = fs.statSync(filePath);
    } catch(e){
        throw e;
    }

    var mdPath = filePath;
    if(stats.isDirectory()) {

        // check if there is readme.md file in this directory
        var dirFiles = fs.readdirSync(filePath);

        for(var i=0; i<dirFiles.length; i++) {
            if(dirFiles[i].toLowerCase() == 'readme.md') mdPath = path.join(filePath, dirFiles[i]);
        }
    }

    try{
        var mdFile = fs.readFileSync(mdPath, 'utf8');
    } catch(e){
        if(e.code == "ENOENT"){
            mdFile = null;
        }
    }

    if(mdFile == null){
        attr = getTocItemInfoFromFilePath(filePath);
    } else {
        attr = getTocItemInfoFromMdFile(mdFile);

        // if no title in md file, get it from file path
        if(attr.title == "") attr.title = getTocItemInfoFromFilePath(filePath).title;
    }

    this.title = attr.title;
    this.isLink = attr.isLink;
    this.link = getRelativeUrl(filePath, rootPath);
    this.order = attr.order;
    this.class = attr.class;
    this.hidden = attr.hidden;

    if(stats.isDirectory()) {

        var childs = fs.readdirSync(filePath);
        for(var i=0; i<childs.length; i++){

            // skip readme.md files
            if(childs[i].toLowerCase() != "readme.md"){

                // we are only interested in .md files and directories
                if((childs[i].length > 3) && (childs[i].substr(-3).toLowerCase() == ".md")){
                    this.addItem({
                        path: path.join(filePath, childs[i]),
                        rootPath: rootPath
                    })
                } else if(fs.statSync(path.join(filePath, childs[i])).isDirectory()){
                    this.addItem({
                        path: path.join(filePath, childs[i]),
                        rootPath: rootPath
                    })
                }

            }
        }

    }

};

TocItem.prototype.addItem = function(o){
    this.children.push(new TocItem(o));
};

TocItem.prototype.toHTML = function(opts){
    opts = opts || {};

    opts.title = (typeof opts.title == "undefined") ? "Navigation" : opts.title;
    opts.class = opts.class || "egd-toc";
    // opts.selected = opts.selected;
    opts.rebasePath = opts.rebasePath || "";

    var s = "";

    if(!this.hidden){

        if(opts.selected && (this.link == opts.selected)){
            s += '<li class="';

            if(this.hidden) s += 'hidden';

            if(opts.selected && (this.link == opts.selected)) {
                if(this.hidden) s += ' ';
                s += ' selected';
            }

            s += '">';
        } else {
            s += '<li>';
        }

        if(this.isLink){
            s += '<a href="'+opts.rebasePath+this.link+'">'+this.title+'</a>';
        } else {
            s += this.title;
        }

        if(this.children.length > 0){
            s += '<ul>';

            for(var i=0; i<this.children.length; i++){
                s += this.children[i].toHTML(opts);
            }

            s += '</ul>';
        }

        s += '</li>';

    }

    return s;
};

function getTocItemInfoFromFilePath(filePath){

    var info = {};

    // resolve title
    var titleParts = filePath.split(path.sep);
    info.title = titleParts[titleParts.length - 1];

    // convert "-" and "_" to spaces
    if(info.title.length > 0){
        info.title = info.title.replace(/-/g, ' '); // convert "-" to spaces
        info.title = info.title.replace(/_/g, ' '); // convert "_" to spaces
        info.title = info.title.replace(/\s+/g, ' '); // convert multiple white spaces to single
    }

    // capitalize words
    info.title = info.title.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });

    info.isLink = false;
    info.link = "TODO";
    info.order = 1000;
    info.class = "";
    info.hidden = false;

    return info;
}

function getTocItemInfoFromMdFile(readmeFile){
    var info = {};

    // get info from front matter attributes
    var fmFile = fm(readmeFile);
    info.hidden = (typeof fmFile.attributes.toc_hide == "undefined") ? false : fmFile.attributes.toc_hide;
    info.order = (typeof fmFile.attributes.toc_order == "undefined") ? 1000 : fmFile.attributes.toc_order;
    info.class = (typeof fmFile.attributes.toc_class == "undefined") ? "" : fmFile.attributes.toc_class;
    info.isLink = (typeof fmFile.attributes.toc_link == "undefined") ? true : fmFile.attributes.toc_link;

    // get title
    if(fmFile.attributes.toc_title){
        info.title = fmFile.attributes.toc_title;
    } else if(fmFile.attributes.title){
        info.title = fmFile.attributes.title;
    } else {
        var mdFile = marked(fmFile.body);
        var $ = cheerio.load(mdFile);

        var $h = $('h1');
        if($h.length > 0) {
            info.title = $h.first().text();
        } else {
            info.title = "";
        }
    }

    return info;
}

function getRelativeUrl(filePath, rootPath){
    // file path must be relative to root path
    if(filePath.indexOf(rootPath) != 0)
        return "";

    var relativeUrl = filePath.substr(rootPath.length).replace(/\\/g, '/');
    if((relativeUrl.length == 0) || (relativeUrl[0] != "/")) relativeUrl = "/" + relativeUrl;
    if((relativeUrl.length > 3) && (relativeUrl.substr(-3).toLowerCase() == ".md")){
        relativeUrl = relativeUrl.substr(0, relativeUrl.length-3);
        if((relativeUrl.length > 6) && (relativeUrl.substr(-6).toLowerCase() == "readme"))
            relativeUrl = relativeUrl.substr(0, relativeUrl.length-6);

    } else {
        if(relativeUrl[relativeUrl.length-1] != "/")
            relativeUrl += "/";
    }

    return relativeUrl;
}

module.exports = Toc;