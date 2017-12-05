const { XMLHttpRequest } = require('xmlhttprequest');

function Response (request) {
    this.request = request;
    this.content = request.responseText;
    return this;
}

function Request (url, data, method, async, headers) {
    let key, req = new XMLHttpRequest();
    req.open(method || 'GET', url, async || false);
    if (method == 'POST')
        req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    for (key in headers) {
        if (!key) continue;
        req.setRequestHeader(key, headers[key]);
    }
    let body = [];
    if (typeof(data) == 'string') {
        body.push(data);
    } else {
        for (key in data) {
            if (!key) continue;
            body.push(key + '=' + encodeURIComponent(data[key]));
        }
    }
    req.send(body.join('&') || null);
    return new Response(req);
}


function get (url, data, async, headers) {
    return new Request(url, data, 'GET', async, headers);
}

function post (url, data, async, headers) {
    return new Request(url, data, 'POST', async, headers);
}

module.exports = { Request, Response, get, post }
