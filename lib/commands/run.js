'use strict';

const fs = require('fs'),
      qs = require('querystring'),
      url = require('url'),
      path = require('path'),
      http = require('http'),
      { Caches, logger } = require('smappi-cl'),
      { handleRequest, STD } = require('../handle'),
      { cwd, buildSchemes } = require('../utils'),
      { formatXml, soap2args } = require('../serializers');

module.exports.command = 'run [input..]';
module.exports.description = 'Smappi Dev Server (default: http://localhost:8000)\n\n' +
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
    },
    name: {
        describe: 'name of process to find in process list',
        type: 'string',
        default: 'API'
    }
};

function getArgs (params, request) {
    let data = params.query,
        args = {};
    if (request.body) {
        data = request.body;
        let cT = request.headers['content-type'] || '';
        if (cT.indexOf('application/json') != -1) {
            args = JSON.parse(data);
        }
        else if (cT.indexOf('application/xml') != -1 || cT.indexOf('text/xml') != -1) {
            console.log('d', data);
            args = formatXml(data);
            if (args == '__encode_error')
                return {}
        }
    }
    if (!Object.keys(args).length)
        args = qs.parse(data);
    return args;
}

function getFormat(args) {
    let fmt = 'json'; // default
    if (args) {
        fmt = args['_smappi_fmt'] || fmt;
        fmt = (fmt == 'api') ? 'json' : fmt;
    }
    return fmt;
}

module.exports.handler = function run (argv) {
    argv._handled = true;
    // Parse options
    let host = argv.host;
    let port = argv.port;
    let entrypoint = argv.entrypoint;
    let wsdl = '';
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
    var caches = new Caches(cwd(entrypoint, 'caches.txt'));
    // Run HTTP Server
    function createServer () {
        delete require.cache[require.resolve(cwd(entrypoint, 'api'))];
        var api;
        try {
            api = require(cwd(entrypoint, 'api'));
            if (api) {
                let scheme = buildSchemes(api, `http://${host}:${port}`)
                wsdl = scheme.wsdl;
                if (scheme.error) {
                    console.log('wsdl scheme generate error:', scheme.error);
                }
                if (scheme.warning && scheme.warning.length) for (let i = 0, warn; warn = scheme.warning[i]; i++)
                    console.log('wsdl scheme generate warning:', warn);
            }
        } catch (err) {
            logger.error(err.stack || err);  // wait of flush...
        }
        return http.createServer(function (req, res) {
            res = STD(res);
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

                let rurl = (req.headers && req.headers.soapaction ? req.headers.soapaction : req.url);
                if (["'", '"'].indexOf(rurl[0]) >=0 && ["'", '"'].indexOf(rurl[rurl.length - 1]) >= 0)
                    rurl = rurl.slice(1, rurl.length - 1)
                let params = url.parse(rurl || req.url),
                    funcName = params.pathname.replace(/\//g, ''),
                    args = getArgs(params, req),
                    fmt = (req.headers && req.headers.soapaction ? 'soap' : getFormat(args));
                if (fmt == 'soap') {
                    args = soap2args(args)
                    if (args && typeof(args) == 'object')
                        args = args[funcName]
                    if (args && args[funcName])
                        args = args[funcName]
                }
                if (!args) args = {}
                if (funcName == 'wsdl' && wsdl) {
                    try {
                        res.writeHead(200, {'Content-Type': 'application/xml'});
                    } catch (e) {
                        console.log('everything is gonna be OK');
                    }
                    res.end(wsdl);
                } else {
                    if (api === undefined) {
                        // wait when logger is flush data and kill process here
                        res.stderr('The "api.js" file has errors', fmt);
                        // process.exit(2);  // SyntaxError in api.js
                    } else {
                        handleRequest(req, res, api, funcName, args, fmt, caches);
                    }
                }
            });
        }).listen(port, host);
    }
    var server = createServer();
    var apiWatchedTimer = 0, m;
    fs.watch(cwd(entrypoint), {recursive: true}, function (e, filename) {
        if (filename.search(/^node_modules/) !== -1) return;
        let basename = path.basename(filename);
        if (basename.search(/^\./) !== -1) return;
        if (basename.search(/\.js$/) == -1) return;
        // Hack for fs.watch :-(
        m = Math.round(new Date().getTime() / 1000);
        if ((m - apiWatchedTimer) < 3) return;
        apiWatchedTimer = m;
        // Restart
        server.close();
        server = createServer();
        console.log('Restart Smappi Dev Server...');
    });
    console.log('Smappi Dev Server running at http://' + host + ':' + port  + '/');
};
