'use strict';

const cwd = process.cwd();
const cachesRulesfile = cwd + '/caches.txt';
const http = require('http'),
      fs = require('fs'),
      qs = require('querystring'),
      url = require('url'),
      xml2js = require('xml2js'),
      api = require(cwd + '/api'),
      { Caches } = require('../cache'),
      { parseArgs } = require('../parser');

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
    }
};

module.exports.handler = function run (argv) {
    argv._handled = true;
    // Parse options
    let host = argv.host;
    let port = argv.port;
    if (argv.input.length) {
        let first = argv.input[0];
        if (typeof(first) == 'number') {
            port = first;
        } else if (first.indexOf(':') !== -1) {
            [host, port] = first.split(':');
        } else {
            host = first;
            port = argv.input[1] || port;
        }
    }
    // Start Cache
    var caches = new Caches(cachesRulesfile);
    // Run HTTP Server
    http.createServer(function (req, res) {
        let data = url.parse(req.url)
        let funcName = data.pathname.replace(/\//g, '');
        switch (funcName) {
        case 'favicon.ico':
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('Not found');
            return;
        case 'caches.txt':
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(fs.readFileSync(cachesRulesfile, 'utf8'));
            return;
        }
        let fmt = 'json';
        let args = [];
        let chunks = funcName.split('.');
        let func = api[chunks[0]];
        for (let i in chunks) {
            if (['function', 'undefined'].indexOf(typeof(func)) > -1) break;
            func = func[chunks[++i]];
        }
        if (typeof(func) == 'function') {
            if (data.query) {
                let qs_data = qs.parse(data.query);
                args = parseArgs(decodeURI(qs_data.args));
                fmt = qs_data['_smappi_fmt_type'] || fmt;
            }
            let cache_tbl = func + '_' + fmt;
            res.writeHead(200, {'Content-Type': 'application/json'});
            if (args === null) {
                res.end('Wrong args, use quotes. \nExample: ?args="First\\nmessage","something else",42')
                return;
            }
            let cached_out = caches.resolve(cache_tbl, args);
            console.log('Function:', funcName, '[', data.query, ']')
            if (cached_out) {
                console.log('Cached out', );
                res.end(cached_out);
            } else {
                let out = func(...args);
                switch (fmt) {
                case 'xml':
                    let builder = new xml2js.Builder();
                    out = builder.buildObject(out);
                    break;
                default:
                    fmt = 'json';
                    out = JSON.stringify(out);
                    break;
                }
                console.log('Format:', fmt)
                caches.save(cache_tbl, args, out);
                res.end(out);
            }
        } else {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('Function "' + funcName + '" not found!');
        }
    }).listen(port, host);
    console.log('Smappi Server running at http://' + host + ':' + port  + '/');
};
