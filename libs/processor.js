'use strict';

var im = require('imagemagick');
var path = require('path');
var colors = require('colors');
var async = require('async');
var md5File = require('md5-file');
var fs = require('fs-extra');

module.exports = {
    /**
     * {
     *    sizes: {
     *        name: {
     *             dest: 'path/to/output'|{function},
     *             prefix: '',
     *             suffix: '',
     *             option: {
     *                  width:200
     *             }
     *        }
     *    }
     * }
     * @param config
     * @returns {Function}
     */
    resize: function(config) {
        config = config || {};
        var sizes = config.sizes || {};
        var callback = config.callback || null;

        return function(data, next) {
            // only process image files
            if (['.png', '.jpg', '.jpeg'].indexOf(path.extname(data.file)) < 0) return next();

            // init resizes param
            data.resizes = data.resizes || {};

            // resizing
            async.eachSeries(Object.keys(sizes), function(key, done) {
                var size = sizes[key];
                var o = size.option || {};
                var src = data.src;
                var dest = size.dest ? (typeof(size.dest) == 'function' ? size.dest(data.file) : size.dest) : data.dest;

                if (size.suffix) dest = path.join(path.dirname(dest), path.basename(dest, path.extname(dest)) + size.suffix + path.extname(dest));
                if (size.prefix) dest = path.join(path.dirname(dest), size.prefix + path.basename(dest, path.extname(dest)) + path.extname(dest));

                o.srcPath = src;
                o.dstPath = dest;
                im.resize(o, function (err) {
                    if (err) return next(err);
                    if (callback) callback(key, o);
                    data.resizes[key] = dest;
                    done();
                });
            }, next);
        }
    },

    unique: function(config) {
        config = config || {};
        var tempPath = config.tempPath || '/var/tmp';
        var callback = config.callback || null;
        var lazy = config.lazy || false;
        var hashTable = {};
        var base = config.base || '/';
        var ignore = config.ignore || false; // set to true if you want to forced doing something
        var pretty = config.pretty || true;

        if (lazy && fs.existsSync(path.join(tempPath, '.hashTable'))) {
            hashTable = JSON.parse(fs.readFileSync(path.join(tempPath, '.hashTable')));
        }


        function compare(data, hash, file, next, skip) {
            md5File(file, function(err, hash2){
                if (err) return next(err);
                if (hash == hash2) {
                    if (callback) callback(true, data);
                    return skip();
                }
                if (callback) callback(false, data);
                return next();
            })
        }

        function doCompare(data, hash, file, next, skip) {
            var key = path.relative(base, file);
            if (lazy)
            {
                if (! ignore && (hashTable[key] && hashTable[key] == hash)) {
                    if (callback) callback(true, data);
                    return skip();
                } else {
                    md5File(file, function (err, md5) {
                        if (err) return next(err);
                        hashTable[key] = md5;
                        var c = pretty ? JSON.stringify(hashTable, null, 4) : JSON.stringify(hashTable);
                        fs.writeFile(path.join(tempPath, '.hashTable'), c, function (err) {
                            if (err) return next(err);
                            if (callback) callback(false, data);
                            return next();
                        });
                    });
                }
            } else {
                fs.exists(file, function (ok) {
                    if (! ok) {
                        return fs.copy(data.src, file, function (err) {
                            if (err) return next(err);
                            if (callback) callback(true, data);
                            return next();
                        });
                    }
                    return compare(data, hash, file, next, skip);
                })
            }
        }

        return function(data, next, skip) {
            if (! tempPath) return next();
            md5File(data.src, function(err, hash1){
                if (err) return next(err);
                var cache = lazy ? data.src : path.join(tempPath, data.file);
                doCompare(data, hash1, cache, next, skip);
            })
        }
    },

    destMap: function(config) {
        config = config || {};
        var map = config.map || {};
        return function(data, next) {
            if (Object.keys(map).length == 0) return next();
            async.eachSeries(Object.keys(map), function(pattern, done){
                var p = new RegExp(pattern);
                if (p.test(data.dest))
                {
                    data.dest = map[pattern](data.dest, data.dest.match(p));
                    return next();
                }
                return done();
            }, next);
        }
    },
    copy: function(config) {
        config = config || {};
        var callback = config.callback || null;
        return function(data, next) {
            fs.ensureDir(path.dirname(data.dest), function(err){
                if (err) return next(err);
                fs.copy(data.src, data.dest, function(err){
                    if (err) return next(err);
                    if (callback) callback(data.dest);
                    return next();
                });
            });
        }
    }
};