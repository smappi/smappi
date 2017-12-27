const fs = require('fs'),
      url = require('url'),
      qs = require('querystring'),
      { serialize } = require('./serializers'),
      { getFuncArgs } = require('./parser');

const FORMATS = {
    'json': 'application/json',
    'xml': 'application/xml'
}


function STD (res) {
    function output (msg, code, fmt) {
        res.writeHead(code, {'Content-Type': FORMATS[fmt] || 'text/plain'});
        res.end(msg);
    }
    res.stdout = function (msg, fmt) {
        return output(msg, 200, fmt);
    }
    res.stderr = function (msg, fmt) {
        msg = serialize({'error': {'code': '1501', 'message': msg}}, fmt);
        return output(msg, 404, fmt);
    }
    return res;
}

function handleRequest (request, response, api, caches) {
    let params = url.parse(request.url),
        data = params.query,
        args = {};
    if (request.body) {
        data = request.body;
        if ((request.headers['content-type'] || '').indexOf('application/json') != -1) {
            args = JSON.parse(data);
        }
    }
    if (!Object.keys(args).length)
        args = qs.parse(data);
    response = STD(response);
    let funcName = params.pathname.replace(/\//g, ''),
        fmt = 'json';
    if (args) {
        fmt = args['_smappi_fmt'] || fmt;
        if (fmt == 'api')
            fmt = 'json';
        if (!FORMATS[fmt])
            return response.stderr('Format "' + fmt + '" is not supported!')
    }
    switch (funcName) {
    case 'favicon.ico':
        return response.stderr('Not found', fmt);
    case 'caches.txt':
        let out = 'The caches.txt does not exist';
        if (fs.existsSync(caches.rulesfile))
            out = fs.readFileSync(caches.rulesfile, 'utf8')
        return response.stdout(out);
    case '':
        return response.stderr('You did not specify a function name', fmt);
    }
    let chunks = funcName.split('.');
    let func = api[chunks[0]];
    for (let i in chunks) {
        if (['function', 'undefined'].indexOf(typeof(func)) > -1) break;
        func = func[chunks[++i]];
    }
    if (typeof(func) == 'function') {
        let cachedOut = caches.resolve(funcName, fmt, data);
        console.log('Function:', funcName, '[', args, ']')
        if (cachedOut) {
            console.log('Cached out', );
            response.writeHead(200, {'Content-Type': FORMATS[fmt]});
            response.end(cachedOut);
        } else {
            // Get arguments for function
            let seqArgs = getFuncArgs(func);
            let funcArgs = [];
            let isSpread;
            for (let i in seqArgs) {
                if (seqArgs[i].indexOf('...') != -1)
                    isSpread = true;
                let attr = seqArgs[i].replace(/\./g, '');
                if (args[attr] == undefined)
                    return response.stderr('No specified argument "' + attr + '" for "' + funcName + '"!', fmt)
                funcArgs[i] = args[attr];
            }
            // Call function
            let context = {
                'return': function (out) {
                    if (context._returned) return;
                    out = serialize(out, fmt);
                    console.log('Format:', fmt)
                    caches.save(funcName, fmt, data, out);
                    response.writeHead(200, {'Content-Type': FORMATS[fmt]});
                    response.end(out);
                }
            }
            if (isSpread) {
                let spread = funcArgs[0];
                try {
                    spread = JSON.parse(spread);
                    if (!Array.isArray(spread))
                        return response.stderr('Spread only apply for iterables (such as arrays)', fmt)
                } catch (err) {
                    console.log('JSON parse spread error: ', err);
                    spread = spread.split(',');
                }
                funcArgs = spread;
            }
            let out = func.apply(context, funcArgs);
            if (out !== undefined) {
                context.return(out);
                context._returned = true;
            }
        }
    } else {
        return response.stderr('Function "' + funcName + '" not found!', fmt);
    }

}

module.exports = { handleRequest }
