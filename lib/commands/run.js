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
      { getFuncArgs } = require('../parser');

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

const FORMATS = {
    'json': 'application/json',
    'xml': 'application/xml'
}

function output (res, msg, code) {
    res.writeHead(code || 404, {'Content-Type': 'text/plain'});
    res.end(msg);
}

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
        let data = url.parse(req.url);
        let funcName = data.pathname.replace(/\//g, '');
        switch (funcName) {
        case 'favicon.ico':
            return output(res, 'Not found');
        case 'caches.txt':
            return output(res, fs.readFileSync(cachesRulesfile, 'utf8'), 200);
        }
        let fmt = 'json';
        let chunks = funcName.split('.');
        let func = api[chunks[0]];
        let args = {};
        for (let i in chunks) {
            if (['function', 'undefined'].indexOf(typeof(func)) > -1) break;
            func = func[chunks[++i]];
        }
        if (typeof(func) == 'function') {
            if (data.query) {
                args = qs.parse(data.query);
                fmt = args['_smappi_fmt_type'] || fmt;
                if (!FORMATS[fmt])
                    return output(res, 'Format "' + fmt + '" is not supported!')
            }
            let cache_tbl = func + '_' + fmt;
            let cached_out = caches.resolve(cache_tbl, data.query);
            console.log('Function:', funcName, '[', data.query, ']')
            if (cached_out) {
                console.log('Cached out', );
                res.writeHead(200, {'Content-Type': FORMATS[fmt]});
                res.end(cached_out);
            } else {
                // Get arguments for function
                let seqArgs = getFuncArgs(func);
                let funcArgs = [];
                for (let i in seqArgs) {
                    let attr = seqArgs[i];
                    if (!args[attr])
                        return output(res, 'No specified argument "' + attr + '" for "' + funcName + '"!')
                    funcArgs[i] = args[attr];
                }
                // Call function
                let out = func(...funcArgs);
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
                caches.save(cache_tbl, data.query, out);
                res.end(out);
            }
        } else {
            return output(res, 'Function "' + funcName + '" not found!');
        }
    }).listen(port, host);
    console.log('Smappi Server running at http://' + host + ':' + port  + '/');
};
