const fs = require('fs'),
      crypto = require('crypto'),
      { serialize } = require('./serializers'),
      { getFuncArgs } = require('./parser'),
      { logger } = require('smappi-cl');

const FORMATS = {
    'json': 'application/json',
    'xml': 'application/xml',
    'soap': 'application/soap+xml'
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
        msg += '. Please check Log tab for this API.';
        msg = serialize({'error': {'code': '1501', 'message': msg}}, fmt);
        return output(msg, 404, fmt);
    }
    return res;
}

function handleRequest (request, response, api, funcName, args, fmt, caches) {
    if (!FORMATS[fmt])
        return response.stderr(`Format "${fmt}" is not supported`);
    response = STD(response);
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
    console.log('----------------------------------------------------------------------------------------------------')
    if (typeof(func) == 'function') {
        let md5sum = crypto.createHash('md5'),
            cacheKey = md5sum.update(JSON.stringify(args)).digest('hex'),
            cachedOut = caches.resolve(funcName, cacheKey, fmt);
        console.log(`Function "${funcName}" with [${JSON.stringify(args)}]`);
        if (cachedOut) {
            console.log('Cached out.');
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
                if (args[attr] === undefined)
                    return response.stderr(`No specified argument "${attr}" for "${funcName}"`, fmt);
                funcArgs[i] = args[attr];
            }
            var returnTimeout = setTimeout(function () {
                console.warn('********************************************');
                console.warn('* Wait of return... You did not forget it? *');
                console.warn('********************************************');
            }, 20000);
            // Call function
            let context = {
                'return': function (out) {
                    clearTimeout(returnTimeout);
                    if (this._returned) return;
                    if (fmt == 'soap') {
                        tmp = {response: {}};
                        if (Array.isArray(out)) {
                            out = {item: out}
                        }
                        tmp.response[`ns1:${funcName}Response`] = out
                        out = tmp
                    }
                    out = serialize(out, fmt);
                    // console.log('Format:', fmt)
                    caches.save(funcName, cacheKey, fmt, out);
                    response.writeHead(200, {'Content-Type': FORMATS[fmt]});
                    response.end(out);
                    this._returned = true;
                }
            }
            if (isSpread) {
                let spread = funcArgs[0];
                try {
                    spread = JSON.parse(spread);
                    if (!Array.isArray(spread))
                        return response.stderr('Spread only apply for iterables (such as arrays)', fmt);
                } catch (err) {
                    console.log('JSON parse spread error: ', err);
                    console.log('Try to split by semicolon...')
                    spread = spread.split(',');
                }
                funcArgs = spread;
            }
            let out;
            try {
                out = func.apply(context, funcArgs);
            } catch (err) {
                logger.error(err.stack || err);
                return response.stderr(err, fmt);
            }
            if (out !== undefined) {
                context.return(out);
            } else {
                if (func.toString().indexOf('.return') == -1) {
                    // context.return('');
                    let msg = `The "${funcName}" function did not return anything, ` +
                        `it is necessary to call return or deferred self.return (https://smappi.org/documentation/the-deferred-return/)`;
                    logger.warn(msg);
                    return response.stderr(msg, fmt);
                }
            }
        }
    } else {
        return response.stderr(`Function "${funcName}" not found`, fmt);
    }

}

module.exports = { STD, handleRequest }
