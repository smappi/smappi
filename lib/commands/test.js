'use strict';

const doctap = require('../doctap'),
      { cwd } = require('../utils');

module.exports.command = 'test';
module.exports.description = 'Run all doctests'
module.exports.builder = {
    entrypoint: {
        describe: 'entrypoint to api.js',
        type: 'string',
        default: '.'
    }
};

module.exports.handler = function test (argv) {
    argv._handled = true;
    let entrypoint = argv.entrypoint;
    doctap(cwd(entrypoint, 'api.js'));
    // tap-parser --json=4 > doctest.json
    console.log('Run Smappi Test Server...');
};
