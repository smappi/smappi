'use strict';

const http = require('http'),
      { Caches } = require('../cache'),
      { handleRequest } = require('../handle');

module.exports.command = 'run [input..]';
module.exports.description = 'Run Http Server (default: http://localhost:8000)\n\n' +
    'Examples:\n' +
    'smappi run --host 127.0.0.1 --port 8000\n' +
    'smappi run localhost 8000\n' +
    'smappi run localhost:8000\n' +
    'smappi run 127.0.0.1\n' +
    'smappi run 8000';
module.exports.builder = {
    host: {
        describe: 'preferred host for the local server',
        type: 'string',
        default: 'localhost'
    },
    port: {
        describe: 'preferred port for the local server',
        type: 'number',
        default: 8000
    },
    entrypoint: {
        describe: 'entrypoint to api.js',
        type: 'string',
        default: '.'
    }
};

module.exports.handler = function run (argv) {
    argv._handled = true;
    // Parse options
    let host = argv.host;
    let port = argv.port;
    let entrypoint = argv.entrypoint;
    if (argv.input.length) {
        let first = argv.input[0];
        if (typeof(first) == 'number') {
            port = first;
        } else if (first.indexOf(':') !== -1) {
            [host, port] = first.split(':');
        } else if (first.indexOf('/') !== -1) {
            entrypoint = first;
        } else {
            host = first;
            port = argv.input[1] || port;
        }
    }
    function cwd (path) {
        return [process.cwd(), entrypoint, path].join('/').replace(/\/\//g, '/');
    }
    var caches = new Caches(cwd('caches.txt'));
    // Run HTTP Server
    http.createServer(function (req, res) {
        var data = '';
        req.on('data', function (chunk) {
            data += chunk;
        });
        req.on('end', function () {
            req.body = data;
            handleRequest(req, res, cwd, caches);
        });
    }).listen(port, host);
    console.log('Smappi Server running at http://' + host + ':' + port  + '/');
};
