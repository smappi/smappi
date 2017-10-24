'use strict';

module.exports.command = 'run [input..]';
module.exports.description = 'Run Http Server (default: http://localhost:8000)';
module.exports.builder = {
    port: {
        describe: 'preferred port for the local server',
        type: 'number',
        default: 8000
    }
};

module.exports.handler = function run (argv) {
    argv._handled = true;
    console.log(argv.port);
};
