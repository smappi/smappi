const { readFileSync, existsSync, unlinkSync } = require('fs');
const toSpec = require('./tap');
const babel = require('babel-core');
const getRc = require('jsdoctap/lib/get-babelrc');
const req = require('require-from-string');

const removeBOM = (res) => {
    if (res.charCodeAt(0) === 0xFEFF)
        res = res.substr(1);
    return res
}

const runTests = (filename, withExtra) => {
    const content = readFileSync(filename, 'utf8');
    const spec = toSpec(process.cwd(), filename, content, withExtra);
    const testPlusCode = content + spec;
    const { babelRc, isPackage } = getRc(filename);
    const opts = { extends: babelRc }
    const transformed = babel.transform(testPlusCode, opts).code;
    req(removeBOM(transformed), filename);
    process.on('exit', () => {
        if (isPackage && existsSync(babelRc)) {
            unlinkSync(babelRc);
        }
    })
}

module.exports = runTests;
