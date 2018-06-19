const { relative } = require('path');
const keep = require('zeelib/lib/keep');
const map = require('zeelib/lib/map');
const concat = require('zeelib/lib/concat');
const filter = require('zeelib/lib/filter');
const findWhere = require('zeelib/lib/find-where');
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

// require('babylon').parseExpression(codeResult).elements[1].argument.properties[0];
function adaptResultByMask (foundResult, wantedCode) {
    if (wantedCode.indexOf('...') === -1) // return original result by func
        return foundResult;
    let wantedResult = removeMask(wantedCode);
    let buildCompareResult = (found, wanted) => {
        let result = found; // default is found
        if (typeof(wanted) == 'string') {
            if (wanted.indexOf('...') > -1) {
                let re = '^' + wanted.replace(/\.\.\./g, '.*?') + '$';
                result = (new RegExp(re).test(found)) ? wanted : found;
            }
        }
        else if (typeof(wanted) == 'object') {
            let wIndex = 0, fIndex = 0, wValue, fValue, blackHoleMode = false;
            if (Array.isArray(wanted)) {
                result = [];
                for (; wIndex < wanted.length; wIndex++) {
                    wValue = wanted[wIndex];
                    if (wValue === '...') {
                        blackHoleMode = true;
                        result.push('...')
                        continue;
                    } else if (blackHoleMode) {
                        for (; fIndex < found.length; fIndex++) {
                            if (found[fIndex] == wValue) {
                                result.push(wValue);
                                break;
                            }
                        }
                        blackHoleMode = false;
                        continue;
                    } else {
                        fValue = found[wIndex];
                        fValue = buildCompareResult(fValue, wValue);
                        if (JSON.stringify(fValue) != JSON.stringify(wValue)) {
                            return found;
                        } else {
                            result.push(wValue);
                        }
                    }
                    fIndex++;
                }
                // if they did not reach the end of the found, it means they did not finish and return original found
                // example: [1, 2, 3, 4, 5, 6, 7] and [1, ..., 3, ..., 7, 8, 7]
                if (fIndex != found.length - 1 && wValue != '...') {
                    return found;
                }
                // when result is same as wanted (целостный), then return it. Otherwise return original return to debug
                result = (result.length == wanted.length) ? result : found;
            } else {
                let fIndexLast;
                result = {};
                for (wIndex in wanted) {
                    wValue = wanted[wIndex];
                    if (wValue === '...') {
                        blackHoleMode = true;
                        result['...'] = '...';
                        continue
                    } else if (blackHoleMode) {
                        let start = false;
                        for (fIndex in found) {
                            if (!fIndexLast)
                                fIndexLast = fIndex;
                            if (fIndex == fIndexLast)
                                start = true;
                            if (start) {
                                fValue = buildCompareResult(found[fIndex], wValue);
                                if (fValue.toString() == wValue.toString()) {
                                    result[fIndex] = wValue;
                                    break;
                                }
                                fIndexLast = fIndex;
                            }
                        }
                        blackHoleMode = false;
                    } else {
                        let fValue = found[wIndex]
                        fValue = buildCompareResult(fValue, wValue);
                        if (fValue != wValue) {
                            return found;
                        } else {
                            result[wIndex] = wValue;
                        }
                    }
                }
                // when result is same as wanted (целостный), then return it. Otherwise return original return to debug
                result = Object.keys(result).length == Object.keys(wanted).length ? result : found;
            }
        }
        return result;
    }
    return buildCompareResult(foundResult, wantedResult);
}

function removeMask (code) {
    // eval('var result = ' + code);
    // return result;
    code = code.replace(/\s*(\.\.\.)\s+/g, '$1'); // reset whitespaces around ...
    code = code.replace(/([\s\,\[\{]{0,1})(\.\.\.)([\,\]\}]{1})/g, '$1$2[\'...\']$3'); // replace ... to ...['...']
    code = code.replace(/\.\.\.\[\]/g, '...[\'...\']') // ...[] -> ...['...']
    code = code.replace(/\.\.\.\{\}/g, '...{\'...\': \'...\'}') // ...{} -> ...{'...': ...}
    try {
        eval('var result = ' + code);
    } catch (err) {
        console.error('Error while parse:', code);
        console.error(err);
        throw err;
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
