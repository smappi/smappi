const xml2js = require('xml2js');

function serialize (out, fmt) {
    let builder = new xml2js.Builder();
    switch (fmt) {
        case 'soap':
            if (out.error)
                out = {
                    'soap:Fault': {
                        faultcode: 'SOAP-ENV:Client',
                        faultstring: out.error.message,
                        faultactor: '',
                        detail: {
                           code: out.error.code,
                           name: out.error.message,
                           description: out.error.message,
                       }
                    }
                }
            out = {'soap:Envelope': {
                    '$': {
                        'xmlns:soap': "http://schemas.xmlsoap.org/soap/envelope/",
                        'xmlns:ns1': "http://localhost:8000",
                    },
                    'soap:Body': out,
                }
            };
            out = builder.buildObject(out, {explicitRoot: false});
            break;
        case 'xml':
            if (Array.isArray(out)) {
                out = out.map((o) => { return {item: o}; });
            }
            out = {response: out}
            out = builder.buildObject(out, {explicitRoot: false});
            break;
        default:
            fmt = 'json';
            out = JSON.stringify(out);
            break;
        }
    return out;
}

function formatXml(str, tree) {
    let data = {}, errs;
    if (!tree)
        xml2js.parseString(str.trim().split('\n').join(''), {trim: true}, function (err, result) {
            if (err)
                errs = '__encode_error'
            tree = result;
            if (tree && tree.request)
                tree = tree.request;
        });
    if (errs)
        return errs
    for (let tag in tree) {
        let child = tree[tag];
        if (typeof(child) == 'object' && !Array.isArray(child))
            data[tag] = formatXml('', child)
        else {
            if (data[tag]){
                if (Array.isArray(data[tag]))
                    data[tag] += [child]
                else
                    data[tag] = [data[tag], child]
            } else {
                data[tag] = child
                if (Array.isArray(child) && child.length == 1)
                    data[tag] = child.pop()
            }
        }
    }
    return data
}

function normalizeSoapArgs(args) {
    let out = {};
    if (typeof(args) == 'object') {
        if (Array.isArray(args)) {
            out = []
            for (let i = 0, el; el = args[i]; i++) {
                let tmp = (typeof(el) == 'object' ? normalizeSoapArgs(el) : el)
                out.push(tmp)
            }
        } else
            for (let key in args) {
                let tmp = (typeof(args[key]) == 'object' ? normalizeSoapArgs(args[key]) : args[key])
                if (key.indexOf(':') >= 0)
                    out[key.split(':')[1]] = tmp
                else
                    out[key] = tmp
            }
    }
    return out
}

let normalizeSoapArgsOut = function(args) {
    if (typeof(args) == 'object') {
        if (Array.isArray(args)) {
            if (args.length > 1)
                for (let i = 0; i < args.length; i++)
                    args[i] = normalizeSoapArgsOut(args[i])
            else
                args = normalizeSoapArgsOut(args[0]) || '';
        } else
            for (let key in args) {
                if (key == 0)
                    args = normalizeSoapArgsOut(args[key])
                else
                    args[key] = normalizeSoapArgsOut(args[key])
            }
    }
    return args
}

function soapResponseEncode(res, encoder){
    let out = {};
    if (res && encoder && typeof(res) == 'object') {
        for (let key in res) {
            let s = `${encoder}:${key}`
            out[s] = soapResponseEncode(res[key], encoder)
        }
    }
    else return res
    return out
}

function soap2args(args, child) {
    let out = args;
    if (!child)
        out = normalizeSoapArgsOut(normalizeSoapArgs(args));
    if (typeof(out) == 'object')
        for (let key in out) {
            if (key.toLowerCase() == 'body'){
                return {'isBody': true, 'obj': out[key]}
            }
            else {
                let tmp = soap2args(out[key], true)
                if (tmp.isBody)
                    if (!child)
                        return tmp.obj
                    else return tmp
            }
        }
    return out
}

module.exports = { serialize, formatXml, soap2args }
