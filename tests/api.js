/**
 * Test of list
 *
 * @example
 *   list()
 *   // => ['/moskva/kvartiry/1-k_kvartira_1', ..., '/moskva/kvartiry/1-k_kvartira_4']
 *
 */
function list () {
    return ['/moskva/kvartiry/1-k_kvartira_1', '/moskva/kvartiry/1-k_kvartira_2', '/moskva/kvartiry/1-k_kvartira_3', '/moskva/kvartiry/1-k_kvartira_4'];
}

/**
 * Test of list twice
 *
 * @example
 *   list_twice()
 *   // => ['/moskva/kvartiry/1-k_kvartira_1', ..., '/moskva/kvartiry/1-k_kvartira_4', ..., 123]
 *
 */
function list_twice () {
    return ['/moskva/kvartiry/1-k_kvartira_1', '/moskva/kvartiry/1-k_kvartira_2', '/moskva/kvartiry/1-k_kvartira_3', '/moskva/kvartiry/1-k_kvartira_4', 444, 55, 123];
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

