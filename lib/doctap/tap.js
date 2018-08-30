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
const getExampleCode = ({ testCase, expectedResult }, funcName) => {
    let ts = testCase.split('\n');
    let code = ts[ts.length - 1].replace(`${funcName}(`, `wrapFunc(${funcName}, {'return': testSame}, `);
    ts[ts.length - 1] = 'result = ' + code;
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
        let com = getExampleCode(example, ctx.name);
        return `
    (function () {
        let wrapFunc = function (func, ctx) {
            let args = [...arguments].slice(2);
            funcArgs[func.name] = args.map((o) => [o, typeof(o)]);
            return func.apply(ctx, args);
        }
        let testSame = function (result) {
            t.same(
                  adaptResultByMask(result, '${escapeString(com.expectedResult)}'),
                  removeMask('${escapeString(com.expectedResult)}'),
                 '${escapeString(ctx.string)} ${escapeString(example.label || example.displayTestCase)}'
            )
        }
        ${com.joined}
        if (${ctx.name}.toString().indexOf('.return') == -1 || result !== undefined) {
            testSame(result);
        }
    })();`
    }, comment.examples);
}

// require('babylon').parseExpression(codeResult).elements[1].argument.properties[0];
function adaptResultByMask (foundResult, wantedCode) {
    // WHEN USE REGEXP, THEN HAVE PROBLEM WITH ... IN CODE:
    // if (wantedCode.indexOf('...') === -1) // return original result by func
    //     return foundResult;
    function equal (fValue, wValue) {
        // equal two objects with serialize type
        if (fValue && fValue.constructor.name == 'RegExp')
            fValue = fValue.toString();
        if (fValue && wValue.constructor.name == 'RegExp')
            wValue = wValue.toString();
        return JSON.stringify(fValue) == JSON.stringify(wValue);
    }
    let wantedResult = removeMask(wantedCode);
    let buildCompareResult = (found, wanted) => {
        if (found === wanted) // When objects is equal, then return wanted
            return wanted;
        let wType = wanted && wanted.constructor.name,
            result = found; // default is found
        if (typeof(found) != typeof(wanted) && wType != 'RegExp') {
            return result;
        }
        else if (result === undefined) {
            return result;
        }
        else if (wType == 'RegExp') {
            result = (wanted.test(found)) ? wanted : found;
        }
        else if (typeof(wanted) == 'string') {
            if (wanted.indexOf('...') > -1) {
                let re = '^' + wanted.replace(/\.\.\./g, '.*?') + '$';
                result = (new RegExp(re).test(found)) ? wanted : found;
            }
        }
        else if (typeof(wanted) == 'object' && wanted) {
            let wIndex = 0, fIndex = 0, wValue, fValue, blackHoleMode = false;
            if (Array.isArray(wanted)) {
                result = [];
                for (; wIndex < wanted.length; wIndex++) {
                    wValue = wanted[wIndex];
                    if (wValue === '...') {
                        blackHoleMode = true;
                        result.push('...');
                        continue;
                    } else if (blackHoleMode) {
                        for (; fIndex < found.length; fIndex++) {
                            fValue = buildCompareResult(found[fIndex], wValue);
                            if (!equal(fValue, wValue)) continue;
                            result.push(wValue);
                            break;
                        }
                        blackHoleMode = false;
                    } else {
                        fValue = buildCompareResult(found[fIndex], wValue);
                        if (!equal(fValue, wValue)) {
                            return found;
                        } else {
                            result.push(wValue);
                        }
                    }
                    fIndex++;
                }
                // if they did not reach the end of the found, it means they did not finish and return original found
                // example: [1, 2, 3, 4, 5, 6, 7] and [1, ..., 3, ..., 7, 8, 7]
                if ((found.length - fIndex) > 1 && wValue != '...') return found;
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
                        // Why are we iterate?
                        // Why not get values by keys?
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
                        let fValue = (found || {})[wIndex];
                        fValue = buildCompareResult(fValue, wValue);
                        if (JSON.stringify(fValue) != JSON.stringify(wValue)) {
                            return found;
                        } else {
                            result[wIndex] = wValue;
                        }
                    }
                }
                if (wValue === '...') return result; // when ends with a mask, or mask one: {...{}}
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
const contentsToTapSpec = (rootDir, filename, content, withExtra) => {
    const comments = getTests(content);
    const moduleName = getModuleName(rootDir, filename, comments.source);
    const mn = escapeString(moduleName);
    let examplesCnt = 0;
    if (comments && comments.length)
        examplesCnt = comments.map((x) => x.examples.length).reduce((a, b) => a + b);
    return `
  ${adaptResultByMask.toString()}
  ${removeMask.toString()}
  var result, funcArgs = {};
  const tap = require('tap');
  tap.test('${mn}', (t) => {
      t.plan(${examplesCnt});
      ${map((comment) => `${commentToTapSpec(comment).join('\n\n')}`, keep(comments)).join('\n\n// -------------------------------------------------')}
  }, {timeout: 20000}); ` + (withExtra && `console.log('STRUCTURE', JSON.stringify(funcArgs));` || '');
}

module.exports = contentsToTapSpec;
