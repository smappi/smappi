const os = require("os"),
      fs = require('fs');

function Caches (rulesfile) {
    var self = this;
    self.rulesfile = rulesfile;
    self.rules = {'*': 2};  // default cache 2 seconds
    fs.readFile(self.rulesfile, 'utf8', function (err, data) {
        if (!data) {
            if (err.code != 'ENOENT')
                console.log('Caches ERROR:', err);
            return false;
        }
        let items = data.split(os.EOL), i, item;
        for (i = 0; i < items.length; i++) {
            item = items[i].split(' ');
            if (item[0] && item[1]) {
                self.rules[item[0]] = parseInt(item[1]);
            }
        }
    });
    self.storage = {};
    self.save = function (tbl, key, fmt, data) {
        if (!self.storage[tbl])
            self.storage[tbl] = {};
        let delta = parseInt(self.rules[tbl] || self.rules['*']);
        let dt = new Date();
        dt.setSeconds(dt.getSeconds() + delta);
        self.storage[tbl][key + fmt] = {
            expires: dt,
            data: data
        }
    }
    self.resolve = function (tbl, key, fmt) {
        if (self.storage[tbl]) {
            var item = self.storage[tbl][key + fmt];
            if (!item) return null;
            if ((new Date(item.expires) - new Date()) > 0) {
                return item.data;
            } else {
                delete self.storage[tbl][key + fmt];
                return null;
            }
        } else {
            return null;
        }
    }
}

module.exports = {Caches};
