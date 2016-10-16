'use strict';

const async = require('async');
const pngquant = require('pngquant-bin');
const execFile = require('child_process').execFile;
const util = require('util');
const path = require('path');

function compress(from, to, done) {
    if (['.png'].indexOf(path.extname(from)) < 0) return done();
    execFile(pngquant, ['--speed', 1, '-o', from, to, '--force'], done);
}


function PnguantProcessor(config) {
    config = config || {};
    var target = config.target || 'dest';
    return function(data, next) {
        if (! target) return next();
        if (! data[target]) return next();

        var file = data[target];
        if (util.isArray(file))
        {
            return async.eachSeries(file, function(f, done){
                return compress(file, file, done);
            }, next);
        }

        if (typeof(file) == 'object')
        {
            if (Object.keys(file).length == 0) return next();
            return async.eachSeries(Object.keys(file), function(key, done){
                return compress(file[key], file[key], done);
            }, next)
        }

        return compress(file, file, next);
    }
}

module.exports = PnguantProcessor;