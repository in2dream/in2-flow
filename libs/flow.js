'use strict';

var recursive = require('recursive-readdir');
var async = require('async');
var path = require('path');
var util = require('util');

/**
 *
 * @param params
 * @constructor
 */
function Flow(params)
{
    this.params = params || {};
    this.src = this.params.src;
    this.filters = [];

    this.middlewares = [];
}

/**
 * set the destination
 *
 * @param dir
 * @returns {Flow}
 */
Flow.prototype.dest = function(dir) {
    this.dest = dir;
    return this;
}

/**
 * process
 *
 * @param {function} func
 * @returns {Flow}
 */
Flow.prototype.process = function(func) {
    if (typeof(func) != 'function') return this;
    this.middlewares.push(func);
    return this;
}

/**
 *
 * @param {array} f
 * @returns {Flow}
 */
Flow.prototype.filter = function(f) {
    if (util.isArray(f)) {
        this.filters = this.filters.concat(f);
        return this;
    }
    this.filters.push(f);
    return this;
}

/**
 *
 * @param {function} done
 */
Flow.prototype.run = function(done) {
    var self = this;

    // recursive readdir
    recursive(self.src, (self.filters.length > 0 ? self.filters : ['.*']), function(err, files){
        if (err) return done(err);

        // process files
        async.eachSeries(files, function(file, next){

            // init data
            var data = {
                src: file,
                dest: path.join(self.dest, path.relative(self.src, file)),
                file: path.relative(self.src, file),
                destDir: self.dest,
                srcDir: self.src
            };

            // apply all middleware
            async.eachSeries(self.middlewares, function(m, done) {
                m(data, done, function(){
                    next();
                });
            }, next);
        }, done);
    });
}


module.exports = Flow;