'use strict';

const jquery = require('jquery'),
      request = require("./request");

/**
 * DOM Helper
 * Return window from html-data
 */
function DOM (data) {
    let { JSDOM } = require("jsdom");
    return (new JSDOM(data)).window;
}

module.exports = { jquery, DOM, request }
