const { request } = require('smappi-cl');

/**
 * Test of simple list
 *
 * @example
 *   list_simple()
 *   // => ['str_1', 'str_2']
 *
 */
function list_simple () {
    return ['str_1', 'str_2'];
}

/**
 * Test of list with regexp
 *
 * @example
 *   list_regexp()
 *   // => [/str_\d+/, 'str_2']
 *
 */
function list_regexp () {
    return ['str_123', 'str_2'];
}

/**
 * Test of list
 *
 * @example
 *   list_mask()
 *   // => ['str_1', ..., 'str_5']
 *   list_mask()
 *   // => ['str_1', ...[], 'str_4', 'str_5']
 *
 */
function list_mask () {
    return ['str_1', 'str_2', 'str_3', 'str_4', 'str_5'];
}

/**
 * Test of list twice
 *
 * @example
 *   list_twice()
 *   // => ['str_1', ..., 'str_4', ..., 123]
 *   list_twice()
 *   // => ['str_1', ...[], 'str_4', ..., 123]
 *   list_twice()
 *   // => ['str_1', ...[], 'str_4', ..., ..., 55, 123]
 *
 */
function list_twice () {
    return ['str_1', 'str_2', 'str_3', 'str_4', 444, 55, 123];
}

/**
 * Test of obj
 *
 * @example
 *   obj()
 *   // => {'a': 1, 'b': 2, ...{}, 'e': 5}
 *
 */
function obj () {
    return {'a': 1, 'b': 2, 'e': 5}
}

/**
 * Test of obj
 *
 * @example
 *   obj_nested()
 *   // => {one: {...{}}, ...{}}
 *
 */
function obj_nested () {
    return {one: {a: 1, b: 2}, two: 2}
}

/**
 * Test of str
 *
 * @example
 *   str()
 *   // => 'abc...(x|y).+z'
 *
 */
function str () {
    return 'abcdefxyz'
}

/**
 * Test of short str
 *
 * @example
 *   str_short()
 *   // => 'abc...xyz'
 *
 */
function str_short ()
{
    return 'abcxyz'
}

/**
 * Test list of strings
 *
 * @example
 *   list_strings()
 *   // => ['a1', 'a2', 'b...', ...]
 *
 */
function list_strings ()
{
    return ['a1', 'a2', 'b3', 'c4']
}

/**
 * Test of deferred return with mixed types
 *
 * @example
 *   defer_return_mixed()
 *   // => [{a: 1}, {...{}, b: [..., 42, ...]}, ...]
 *
 */
function defer_return_mixed ()
{
    let self = this;
    setTimeout(() => {
        // console.log('self.return for defer_return_mixed', self.return)
        self.return([{a: 1}, {a: 2, b: [41, 42, 43]}, {a: 3}]);
    }, 1000);
}

/**
 * Test of mixed types
 *
 * @example
 *   mixed()
 *   // => [{a: 1}, {...{}, b: [..., 42, ...]}, ...]
 *
 */
function mixed ()
{
    return [{a: 1}, {a: 2, b: [41, 42, 43]}, {a: 3}]
}

/**
 * Test of deferred return
 *
 * @example
 *   var x = 123
 *   defer_return(x)
 *   // => 234
 *   defer_return(42)
 *   // => 153
 *
 */
function defer_return (x)
{
    var self = this;
    setTimeout(function () {
        // console.log('self.return for defer_return!!!!!!!!!', self.return)
        return self.return(x + 111)
    }, 1000);
}

/**
 * Test of RegExp values
 *
 * @example
 *   regexp_value()
 *   // => {'pid': /\d+/}
 *
 */
function regexp_value ()
{
    return {'pid': process.pid}
}

/**
 * Test of null
 *
 * @example
 *   null_test()
 *   // => null
 *
 */
function null_test ()
{
    return null
}

/**
 * Test of undefined
 *
 * @example
 *   undefined_test()
 *   // => undefined
 *
 */
function undefined_test () {}

/**
 * Test of lambda in doctest
 *
 * @example
 *   (function () { let obj = lambda_test(); delete obj.deleteItProperty; return obj } )()
 *   // => {id: 1, name: 'test'}
 *
 */
function lambda_test () {
    return {id: 1, name: 'test', deleteItProperty: 'deleteItProperty'}
}

/**
 * Mask and simple obj
 *
 * @example
 *   smpObj()
 *   // => [..., {a: 1}]
 */
function smpObj () {
    return [1, 2, {a: 1}]
}

/**
 * Mask and complex obj
 *
 * @example
 *   complexObj()
 *   // => [1, 2, 3, ...[], {a: 1, b: 2, c: /\d+/, ...{}, z: 'Hello ...'}, 7, 8, ...]
 */
function complexObj () {
    return [
        1, 2, 3, 4, 5, 6, {
            a: 1,
            b: 2,
            c: 3,
            d: 4, e: 5,
            z: 'Hello World'
        },
        7, 8, 9, 10
    ]
}

/**
 * Check GET request
 *
 * @example
 *   getRequest('get')
 *   // => "Hello, get!"
 */
function getRequest (name) {
    return request.get('https://json.smappi.org/adw0rd/example/greeting', {name: name}).json()
}

/**
 * Check POST request
 *
 * @example
 *   postRequest('post')
 *   // => "Hello, post!"
 */
function postRequest (name) {
    return request.post('https://json.smappi.org/adw0rd/example/greeting', {name: name}).json()
}
