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

function formatXml(str, tree) {
    let data = {};
    if (!tree)
        xml2js.parseString(str, {trim: true}, function (err, result) {
            tree = result;
            if (tree && tree.request)
                tree = tree.request;
        });
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

module.exports = { serialize, formatXml }
