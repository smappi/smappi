const { relative } = require('path');
const keep = require('zeelib/lib/keep').default;
const map = require('zeelib/lib/map').default;
const concat = require('zeelib/lib/concat').default;
const filter = require('zeelib/lib/filter').default;
const findWhere = require('zeelib/lib/find-where').default;
const { escapeString, stripExtension } = require('jsdoctap/lib/util');
const commentParser = require('jsdoctap/lib/comment-parser');
const dox = require('dox');

/**
 * Parses tests out of a file's contents and returns them. These are
 * `dox` outputted `comment` nodes, overloaded with an `examples` field which
 * adds `testCase` and `expectedResult` pairs to them.
 */
const getTests = (content) => {
    const parsedContent = dox.parseComments(content)
    const functionComments = filter((c) =>
                                    c.ctx &&
                                    (c.ctx.type === 'method' ||
                                     c.ctx.type === 'function' ||
                                     (c.ctx.type === 'declaration' && c.ctx.value.includes('=>'))), parsedContent)

    const comments = map((comment) => {
        const exampleNodes = filter(({ type }) => type === 'example', comment.tags);
        const examples = concat(map((exampleNode) =>
                                    commentParser.run(exampleNode.string), exampleNodes));
        comment.examples = examples;
        return examples.length ? comment : undefined;
    }, functionComments)
    const ret = keep(comments);
    ret.source = parsedContent;
    return ret;
}

/**
 * Resolves the expected module name for a given file, to use as the top-level
 * spec when generating tap doctest `tap.test`
 *
 * @param {String} The root directory
 * @param {String} The module's filename
 * @return {String} moduleName
 */

const getModuleName = (rootDir, filename, parsedContent) => {
    const moduleBlock = findWhere((block) =>
                                  block.tags && findWhere(({ type }) =>
                                                          type === 'example', block.tags), parsedContent)

    if (moduleBlock) {
        const moduleTag = findWhere(({ type }) => type === 'module', moduleBlock.tags);
        if (moduleTag && moduleTag.string) {
            const smoduleTag = moduleTag.string.split(' ');
            if (smoduleTag[0].charAt(0) === '{' && !!smoduleTag[1]) {
                return smoduleTag[1];
            } else if (smoduleTag[0]) {
                return smoduleTag[0];
            }
        }
    }
    const filenamePrime = relative(rootDir, filename);
    return stripExtension(filenamePrime);
}

/**
 * Compiles down an example.
 *
 * @param {Object} comment
 * @param {String} comment.testCase
 * @param {String} comment.expectedResult
 * @return {String}
 */
const getExampleCode = ({ testCase, expectedResult }) => {
    let ts = testCase.split('\n');
    const s = 'result = ';
    ts[ts.length - 1] = s + ts[ts.length - 1];
    const joined = ts.join('\n');
    return { joined, expectedResult }
}

/**
 * Compiles a jsdoc comment parsed by `dox` and its doctest examples into a
 * tap spec.
 */
const commentToTapSpec = (comment) => {
    const ctx = comment.ctx || {}
    return map(function (example) {
        let com = getExampleCode(example);
        return `
    ${com.joined}
    t.same(
      adaptResultByMask(result, '${escapeString(com.expectedResult)}'),
      removeMask('${escapeString(com.expectedResult)}'),
      '${escapeString(ctx.string)} ${escapeString(example.label || example.displayTestCase)}'
    )
    `
    }, comment.examples);
}

function adaptResultByMask (funcResult, code) {
    if (code.indexOf('...') === -1) // return original result by func
        return funcResult;
    let codeResult = removeMask(code);
    if (typeof(codeResult) === 'object') {
        if (!Array.isArray(codeResult)) {
            // Object
            let obj = {};
            for (let key in codeResult) {
                obj[key] = funcResult[key];
            }
            return obj;
        } else {
            // Array
            codeResultLength = codeResult.length;
            if (funcResult.length < codeResultLength)
                return funcResult;
            let items = [];
            for (let i = 0; i < codeResultLength; i++) {
                let idx = funcResult.indexOf(codeResult[i]);
                if (idx > -1)
                    items.push(funcResult[idx]);
            }
            if (codeResult.length != items.length)
                return funcResult;
            return items;
        }
    }
    return funcResult;
}

function removeMask (code) {
    let typeOfCode;
    if (code.startsWith('{')) {
        typeOfCode = 'object';
        code = code.replace(/\.\.\./g, 'SMAPPIMOCK:42');
    } else if (code.startsWith('[')) {
        typeOfCode = 'list';
        code = code.replace(/\.\.\./g, '{SMAPPIMOCK:42}');
    }
    try {
        eval('var result = ' + code);
    } catch (err) {
        console.error('Error while parse:', code);
        console.error(err);
        throw err;
    }
    if (typeOfCode === 'object') {
        delete result['SMAPPIMOCK'];
    } else if (typeOfCode === 'list') {
        for (let i = 0; i < result.length; i++) {
            if (result[i].SMAPPIMOCK) result.splice(i, 1);
        }
        return result;
    }
    return result;
}

/**
 * Compiles a string containing the contents of a JSDoc annotated file and
 * outputs the generated tap spec.
 */
const contentsToTapSpec = (rootDir, filename, content) => {
    const comments = getTests(content);
    const moduleName = getModuleName(rootDir, filename, comments.source);
    const mn = escapeString(moduleName);
    return `
${adaptResultByMask.toString()}
${removeMask.toString()}

  const tap = require('tap');
  let result;
  tap.test('${mn}', (t) => {
    ${map((comment) => `${commentToTapSpec(comment)}`, keep(comments))}
    t.end()
  })
  `
}

module.exports = contentsToTapSpec;
