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
    console.log('Run Smappi Test Server...');
    doctap(cwd(entrypoint, 'api.js'));
    setTimeout(() => process.exit(0), 2000);
};
