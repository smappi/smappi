const xml2js = require('xml2js');

function serialize (out, fmt) {
    switch (fmt) {
    case 'xml':
        let builder = new xml2js.Builder();
        if (Array.isArray(out)) {
            out = {
                root: out.map((o) => { return {item: o}; })
            }
        }
        out = builder.buildObject(out);
        break;
    default:
        fmt = 'json';
        out = JSON.stringify(out);
        break;
    }
    return out;
}

module.exports = { serialize }
