'use strict';

const fs = require('fs'),
      http = require('http'),
      { Caches } = require('../cache'),
      { handleRequest } = require('../handle'),
      { logger } = require('../logging');

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
    function createServer () {
        delete require.cache[require.resolve(cwd('api'))];
        var api;
        try {
            api = require(cwd('api'));
        } catch (err) {
            logger.error(err.stack || err);  // wait of flush...
        }
        return http.createServer(function (req, res) {
            var data = '';
            req.on('data', function (chunk) {
                data += chunk;
            });
            req.on('end', function () {
                req.body = data;
                // Website you wish to allow to connect
                res.setHeader('Access-Control-Allow-Origin', '*');
                // Request methods you wish to allow
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
                // Request headers you wish to allow
                res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
                res.setHeader('Access-Control-Allow-Headers', 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Content-Range,Range');
                res.setHeader('Access-Control-Expose-Headers', 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Content-Range,Range');
                // Set to true if you need the website to include cookies in the requests sent
                // to the API (e.g. in case you use sessions)
                res.setHeader('Access-Control-Allow-Credentials', true);
                if (api === undefined) {
                    // wait when logger is flush data and kill process here
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end('The "api.js" file has errors, check Logger tab for this project');
                    process.exit(2);  // SyntaxError in api.js
                } else {
                    handleRequest(req, res, api, caches);
                }
            });
        }).listen(port, host);
    }
    var server = createServer();
    var apiWatchedTimer = 0, m;
    fs.watch(cwd('api.js'), function () {
        // Hack for fs.watch :-(
        m = Math.round(new Date().getTime() / 1000);
        if ((m - apiWatchedTimer) < 3) return;
        apiWatchedTimer = m;
        // Restart
        server.close();
        server = createServer();
        console.log('Restart Smappi Server...')
    });
    console.log('Smappi Server running at http://' + host + ':' + port  + '/');
};
