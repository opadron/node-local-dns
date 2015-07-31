
"use strict";

module.exports = (function() {


var nedb = require("nedb");
var Promise = require("bluebird");

function PromisifiedNedb() {
    return Promise.promisifyAll(new nedb(arguments[0]));
}


return PromisifiedNedb })();

