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
    },
    extra: {
        describe: 'Attach extra info',
        type: 'boolean',
        default: false
    }
};

module.exports.handler = function test (argv) {
    argv._handled = true;
    console.log('Run Smappi Test Server...');
    doctap(cwd(argv.entrypoint, 'api.js'), argv.extra);
    setTimeout(() => process.exit(0), 2000);
};
