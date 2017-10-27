function serialize (out, fmt) {
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
    return out;
}

module.exports = { serialize }
