const xml2js = require('xml2js');

function serialize (out, fmt) {
    switch (fmt) {
    case 'xml':
        let builder = new xml2js.Builder();
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

module.exports = { serialize }
