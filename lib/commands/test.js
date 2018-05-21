'use strict';

const doctap = require('../doctap'),
      { cwd } = require('../utils');

module.exports.command = 'test';
module.exports.description = 'Run all doctests'
module.exports.builder = {};

module.exports.handler = function test (argv) {
    argv._handled = true;
    doctap(cwd('.', 'api.js'));
    // tap-parser --json=4 > doctest.json
    console.log('Run Smappi Test Server...');
};
