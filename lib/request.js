const { XMLHttpRequest } = require('xmlhttprequest');

function Response (request) {
    this.request = request;
    this.content = request.responseText;
    return this;
}

function Request (url, data, method, async) {
    var req = new XMLHttpRequest();
    req.open(method || 'GET', url, async || false);
    req.send(data || null);
    return new Response(req);
}


function get (url, data, async) {
    return new Request(url, data, 'GET', async);
}

function post (url, data, async) {
    return new Request(url, data, 'POST', async);
}

module.exports = { Request, Response, get, post }
