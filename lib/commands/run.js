'use strict';
const http = require('http'),
      fs = require('fs'),
      qs = require('querystring'),
      url = require('url'),
      // xml2js = require('xml2js'),
      api = require(process.cwd() + '/api'),
      { Caches } = require('../cache'),
      { parseArgs } = require('../parser');

const cachesRulesfile = 'caches.txt';

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
    var caches = new Caches(cachesRulesfile);
    http.createServer(function (req, res) {
        let data = url.parse(req.url)
        let func = data.pathname.replace(/\//g, '');
        let fmt = 'json';
        let args = [];
        if (api[func]) {
            console.log('func:', func)
            if (data.query) {
                let qs_data = qs.parse(data.query);
                console.log('QS:', qs_data);
                args = parseArgs(decodeURI(qs_data.args));
                console.log('args:', args);
                fmt = qs_data['_smappi_fmt_type'] || fmt;
            }
            let cache_tbl = func + '_' + fmt;
            res.writeHead(200, {'Content-Type': 'application/json'});
            if (args === null) {
                res.end('Wrong args, use quotes. \nExample: ?args="First\\nmessage","something else",42')
                return;
            }
            let cached_out = caches.resolve(cache_tbl, args);
            if (cached_out) {
                console.log('cached out', cached_out);
                res.end(cached_out);
            } else {
                let out = api[func](...args);
                switch (fmt) {
                case 'xml':
                    let builder = new xml2js.Builder();
                    out = builder.buildObject(out);
                    break;
                default:
                    out = JSON.stringify(out);
                    break;
                }
                console.log('fmt:', fmt)
                console.log('out:', out)
                caches.save(cache_tbl, args, out);
                res.end(out);
            }
        } else {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            if (func == 'caches.txt') {
                let out = fs.readFileSync(cachesRulesfile, 'utf8');
                res.end(out);
            } else {
                res.end('Function "' + func + '" not found!');
            }
        }
    }).listen(port, host);
    console.log('Server running at http://' + host + ':' + port  + '/');
};
