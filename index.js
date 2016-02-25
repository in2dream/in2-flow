'use strict';

var Flow = require('./libs/flow');

module.exports = {

    src: function(dir) {
        return new Flow({
            src: dir
        })
    }

}