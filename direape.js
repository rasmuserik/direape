// <img src=https://reun.solsort.com/icon.png width=96 height=96 align=right> 
// <img src=https://direape.solsort.com/icon.png width=96 height=96 align=right>
//
// [![website](https://img.shields.io/badge/website-direape.solsort.com-blue.svg)](https://direape.solsort.com/) 
// [![github](https://img.shields.io/badge/github-solsort/direape-blue.svg)](https://github.com/solsort/direape)
// [![codeclimate](https://img.shields.io/codeclimate/github/solsort/direape.svg)](https://codeclimate.com/github/solsort/direape)
// [![travis](https://img.shields.io/travis/solsort/direape.svg)](https://travis-ci.org/solsort/direape)
// [![npm](https://img.shields.io/npm/v/direape.svg)](https://www.npmjs.com/package/direape)
//
// # !!! UNDER MAJOR REWRITE !!!
//
// Read up to date documentation on [AppEdit](https://appedit.solsort.com/?Read/js/gh/solsort/direape).
//
// # DireApe - Distributed Reactive App Environment
// # !!! UNDER MAJOR REWRITE !!!
// 
(function() {
  var da = self.direape || {};

  // ## Message Passing
  //
  // ### TODO `handle(name, fn, opt)` 
  //
  // - public if opt `{public:true}`, otherwise node only
  //
  // ### TODO `call(pid, name, args...)`
  // ### TODO `emit(pid, name, args...)`
  // ### TODO `pid`, `nid`
  //
  // pid = process-id
  // `nid` node-id - process-id for main process
  // ### `isMainThread()`

  da.isMainThread = () => da.pid === da.nid;

  // ## Main thread functions (spawn, and network)
  //
  // ### TODO `online([boolean/url])` - sends message 'da:online' and 'da:offline'
  // ### TODO `children()`
  // ### TODO `spawn()`
  // ### TODO `kill(child-id)`
  // ## Reactive State
  //
  // ### TODO `setState(o)`
  // ### TODO `getState()`
  // ### TODO `reaction(f, params)` returns reaction, which when called returns result
  // ### TODO `rerun(name, reaction)`
  // ### Implementation details
  // - dag, from a single source-input-reaction to a single drain-output-reaction.
  //
  // Reaction:
  //
  // - data
  //     - uid
  //     - exec-count (only increases when result changes)
  //     - fn
  //     - parameters
  //     - result
  //     - list of inputs (reactions accessed) from previous run, and their exec-count
  //     - list of outputs (who have output as (grand-)child)
  //  - code
  //     - update children(recursively) on change
  //     - get value (traverse undrained parents if no drain, and recalculate if needed)
  //
  // ## Module Loader
  //
  // ### TODO `require(module-name, [opt])`
  // ### TODO `eval(str|fn, [opt])`
  // ### Implementation details    
  // ## Utilities
  //
  // ### `GET(url)` 
  //
  // TODO: make it work with unpkg(cross-origin) in webworkers (through making request in main thread).

  da.GET = function urlGet(url) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.onreadystatechange = () =>
        xhr.readyState === 4 && 
        ( ( xhr.status === 200 
            && typeof xhr.responseText === 'string') 
          ? resolve(xhr.responseText)
          : reject(xhr));
      xhr.send();
    });
  };
  test('GET ok', () => da.GET('https://unpkg.com/direape'));
  test('GET fail', () => da.GET('https://unpkg.com/direape/notfound')
      .catch(() => 'error')
      .then(ok => da.assertEquals('error', ok)));

  // ### `jsonify(obj)`
  //
  // Translate JavaScript objects JSON
  //

  da.jsonify = o => 
    JSON.parse(JSON.stringify([o], (k,v) => jsonReplacer(v)))[0];

  test('jsonify', () => {
    var e = new Error('argh');
    e.stack = 'hello';

    da.assertEquals(da.jsonify(e), {
      $_class: 'Error',
      name:'Error',
      message:'argh',
      stack: 'hello'
    });

    da.assertEquals(da.jsonify(function hello() { }), {
      $_class: 'Function',
      name: 'hello'
    });

    da.assertEquals(da.jsonify(null), null);
  });

  function jsonReplacer(o) {
    var jsonifyWhitelist = ['stack', 'name', 'message', 'id', 'class', 'value'];

    if((typeof o !== 'object' && typeof o !== 'function') || o === null || Array.isArray(o) || o.constructor === Object) {
      return o;
    }
    var result, k, i;
    if(typeof o.length === 'number') {
      result = [];
      for(i = 0; i < o.length; ++i) {
        result[i] = o[i];
      }
    }
    result = Object.assign({}, o);
    if(o.constructor && o.constructor.name && result.$_class === undefined) {
      result.$_class = o.constructor.name;
    }
    if(o instanceof ArrayBuffer) {
      //
      // TODO btoa does not work in arraybuffer, 
      // and apply is probably slow.
      // Also handle Actual typed arrays,
      // in if above. 
      //
      result.base64 = self.btoa(String.fromCharCode.apply(null, new Uint8Array(o)));
    }
    for(i = 0; i < jsonifyWhitelist.length; ++i) {
      k = jsonifyWhitelist[i] ;
      if(o[k] !== undefined) {
        result[k] = o[k];
      }
    }
    return result;
  }

  // ### `nextTick(fn)`

  function nextTick(f) {
    setTimeout(f, 0);
  }

  // ### `slice(arr, i, j)`
  //

  function slice(a, start, end) {
    return Array.prototype.slice.call(a, start, end);
  }

  test('slice', () => {
    da.assertEquals(slice([1,2,3]).length, 3);
    da.assertEquals(slice([1,2,3], 1)[1], 3);
    da.assertEquals(slice([1,2,3], 1 , 2).length, 1);
  });

  // ### `nextId()`

  var prevId = 0;
  da.nextId = () => ++prevId;

  //
  // ### `sha256(str)`
  //
  // Just an inline copy/loading of js-sha256 npm module.
  // We wrap it in a function to pretend that we have a module loader.

  da.sha256 = (function() {
    var module = {exports: {}};
    /*eslint-disable */
    /* [js-sha256]{@link https://github.com/emn178/js-sha256} @version 0.5.0 @author Chen, Yi-Cyuan [emn178@gmail.com] @copyright Chen, Yi-Cyuan 2014-2017 @license MIT */
    !function(){"use strict";function t(t,h){h?(c[0]=c[16]=c[1]=c[2]=c[3]=c[4]=c[5]=c[6]=c[7]=c[8]=c[9]=c[10]=c[11]=c[12]=c[13]=c[14]=c[15]=0,this.blocks=c):this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],t?(this.h0=3238371032,this.h1=914150663,this.h2=812702999,this.h3=4144912697,this.h4=4290775857,this.h5=1750603025,this.h6=1694076839,this.h7=3204075428):(this.h0=1779033703,this.h1=3144134277,this.h2=1013904242,this.h3=2773480762,this.h4=1359893119,this.h5=2600822924,this.h6=528734635,this.h7=1541459225),this.block=this.start=this.bytes=0,this.finalized=this.hashed=!1,this.first=!0,this.is224=t}var h="object"==typeof window?window:{},i=!h.JS_SHA256_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;i&&(h=global);var s=!h.JS_SHA256_NO_COMMON_JS&&"object"==typeof module&&module.exports,e="function"==typeof define&&define.amd,r="undefined"!=typeof ArrayBuffer,n="0123456789abcdef".split(""),o=[-2147483648,8388608,32768,128],a=[24,16,8,0],f=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],u=["hex","array","digest","arrayBuffer"],c=[],p=function(h,i){return function(s){return new t(i,!0).update(s)[h]()}},d=function(h){var s=p("hex",h);i&&(s=y(s,h)),s.create=function(){return new t(h)},s.update=function(t){return s.create().update(t)};for(var e=0;e<u.length;++e){var r=u[e];s[r]=p(r,h)}return s},y=function(t,h){var i=require("crypto"),s=require("buffer").Buffer,e=h?"sha224":"sha256",n=function(h){if("string"==typeof h)return i.createHash(e).update(h,"utf8").digest("hex");if(r&&h instanceof ArrayBuffer)h=new Uint8Array(h);else if(void 0===h.length)return t(h);return i.createHash(e).update(new s(h)).digest("hex")};return n};t.prototype.update=function(t){if(!this.finalized){var i="string"!=typeof t;i&&r&&t instanceof h.ArrayBuffer&&(t=new Uint8Array(t));for(var s,e,n=0,o=t.length||0,f=this.blocks;o>n;){if(this.hashed&&(this.hashed=!1,f[0]=this.block,f[16]=f[1]=f[2]=f[3]=f[4]=f[5]=f[6]=f[7]=f[8]=f[9]=f[10]=f[11]=f[12]=f[13]=f[14]=f[15]=0),i)for(e=this.start;o>n&&64>e;++n)f[e>>2]|=t[n]<<a[3&e++];else for(e=this.start;o>n&&64>e;++n)s=t.charCodeAt(n),128>s?f[e>>2]|=s<<a[3&e++]:2048>s?(f[e>>2]|=(192|s>>6)<<a[3&e++],f[e>>2]|=(128|63&s)<<a[3&e++]):55296>s||s>=57344?(f[e>>2]|=(224|s>>12)<<a[3&e++],f[e>>2]|=(128|s>>6&63)<<a[3&e++],f[e>>2]|=(128|63&s)<<a[3&e++]):(s=65536+((1023&s)<<10|1023&t.charCodeAt(++n)),f[e>>2]|=(240|s>>18)<<a[3&e++],f[e>>2]|=(128|s>>12&63)<<a[3&e++],f[e>>2]|=(128|s>>6&63)<<a[3&e++],f[e>>2]|=(128|63&s)<<a[3&e++]);this.lastByteIndex=e,this.bytes+=e-this.start,e>=64?(this.block=f[16],this.start=e-64,this.hash(),this.hashed=!0):this.start=e}return this}},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,h=this.lastByteIndex;t[16]=this.block,t[h>>2]|=o[3&h],this.block=t[16],h>=56&&(this.hashed||this.hash(),t[0]=this.block,t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[15]=this.bytes<<3,this.hash()}},t.prototype.hash=function(){var t,h,i,s,e,r,n,o,a,u,c,p=this.h0,d=this.h1,y=this.h2,l=this.h3,b=this.h4,v=this.h5,g=this.h6,w=this.h7,k=this.blocks;for(t=16;64>t;++t)e=k[t-15],h=(e>>>7|e<<25)^(e>>>18|e<<14)^e>>>3,e=k[t-2],i=(e>>>17|e<<15)^(e>>>19|e<<13)^e>>>10,k[t]=k[t-16]+h+k[t-7]+i<<0;for(c=d&y,t=0;64>t;t+=4)this.first?(this.is224?(o=300032,e=k[0]-1413257819,w=e-150054599<<0,l=e+24177077<<0):(o=704751109,e=k[0]-210244248,w=e-1521486534<<0,l=e+143694565<<0),this.first=!1):(h=(p>>>2|p<<30)^(p>>>13|p<<19)^(p>>>22|p<<10),i=(b>>>6|b<<26)^(b>>>11|b<<21)^(b>>>25|b<<7),o=p&d,s=o^p&y^c,n=b&v^~b&g,e=w+i+n+f[t]+k[t],r=h+s,w=l+e<<0,l=e+r<<0),h=(l>>>2|l<<30)^(l>>>13|l<<19)^(l>>>22|l<<10),i=(w>>>6|w<<26)^(w>>>11|w<<21)^(w>>>25|w<<7),a=l&p,s=a^l&d^o,n=w&b^~w&v,e=g+i+n+f[t+1]+k[t+1],r=h+s,g=y+e<<0,y=e+r<<0,h=(y>>>2|y<<30)^(y>>>13|y<<19)^(y>>>22|y<<10),i=(g>>>6|g<<26)^(g>>>11|g<<21)^(g>>>25|g<<7),u=y&l,s=u^y&p^a,n=g&w^~g&b,e=v+i+n+f[t+2]+k[t+2],r=h+s,v=d+e<<0,d=e+r<<0,h=(d>>>2|d<<30)^(d>>>13|d<<19)^(d>>>22|d<<10),i=(v>>>6|v<<26)^(v>>>11|v<<21)^(v>>>25|v<<7),c=d&y,s=c^d&l^u,n=v&g^~v&w,e=b+i+n+f[t+3]+k[t+3],r=h+s,b=p+e<<0,p=e+r<<0;this.h0=this.h0+p<<0,this.h1=this.h1+d<<0,this.h2=this.h2+y<<0,this.h3=this.h3+l<<0,this.h4=this.h4+b<<0,this.h5=this.h5+v<<0,this.h6=this.h6+g<<0,this.h7=this.h7+w<<0},t.prototype.hex=function(){this.finalize();var t=this.h0,h=this.h1,i=this.h2,s=this.h3,e=this.h4,r=this.h5,o=this.h6,a=this.h7,f=n[t>>28&15]+n[t>>24&15]+n[t>>20&15]+n[t>>16&15]+n[t>>12&15]+n[t>>8&15]+n[t>>4&15]+n[15&t]+n[h>>28&15]+n[h>>24&15]+n[h>>20&15]+n[h>>16&15]+n[h>>12&15]+n[h>>8&15]+n[h>>4&15]+n[15&h]+n[i>>28&15]+n[i>>24&15]+n[i>>20&15]+n[i>>16&15]+n[i>>12&15]+n[i>>8&15]+n[i>>4&15]+n[15&i]+n[s>>28&15]+n[s>>24&15]+n[s>>20&15]+n[s>>16&15]+n[s>>12&15]+n[s>>8&15]+n[s>>4&15]+n[15&s]+n[e>>28&15]+n[e>>24&15]+n[e>>20&15]+n[e>>16&15]+n[e>>12&15]+n[e>>8&15]+n[e>>4&15]+n[15&e]+n[r>>28&15]+n[r>>24&15]+n[r>>20&15]+n[r>>16&15]+n[r>>12&15]+n[r>>8&15]+n[r>>4&15]+n[15&r]+n[o>>28&15]+n[o>>24&15]+n[o>>20&15]+n[o>>16&15]+n[o>>12&15]+n[o>>8&15]+n[o>>4&15]+n[15&o];return this.is224||(f+=n[a>>28&15]+n[a>>24&15]+n[a>>20&15]+n[a>>16&15]+n[a>>12&15]+n[a>>8&15]+n[a>>4&15]+n[15&a]),f},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,h=this.h1,i=this.h2,s=this.h3,e=this.h4,r=this.h5,n=this.h6,o=this.h7,a=[t>>24&255,t>>16&255,t>>8&255,255&t,h>>24&255,h>>16&255,h>>8&255,255&h,i>>24&255,i>>16&255,i>>8&255,255&i,s>>24&255,s>>16&255,s>>8&255,255&s,e>>24&255,e>>16&255,e>>8&255,255&e,r>>24&255,r>>16&255,r>>8&255,255&r,n>>24&255,n>>16&255,n>>8&255,255&n];return this.is224||a.push(o>>24&255,o>>16&255,o>>8&255,255&o),a},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(this.is224?28:32),h=new DataView(t);return h.setUint32(0,this.h0),h.setUint32(4,this.h1),h.setUint32(8,this.h2),h.setUint32(12,this.h3),h.setUint32(16,this.h4),h.setUint32(20,this.h5),h.setUint32(24,this.h6),this.is224||h.setUint32(28,this.h7),t};var l=d();l.sha256=l,l.sha224=d(!0),s?module.exports=l:(h.sha256=l.sha256,h.sha224=l.sha224,e&&define(function(){return l}))}();
    /*eslint-enable */
    return module.exports;
  })();

  test('sha256', ()=>{
    da.assertEquals(da.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  // ### `sha224(str)`

  da.sha224 = da.sha256.sha224;

  test('sha224', ()=>{
    da.assertEquals(
        da.sha224('The quick brown fox jumps over the lazy dog'),
        '730e109bd7a8a32b1cb9d9a09aa2325d2430587ddbc0c38bad911525');
  });


  // ### `equals(a,b)`
  //
  // (deep equal for Object/Array, otherwise `.equals(..)` or direct comparison)
  // 
  // TODO handle cyclic structures (via weak-map)
  // TODO handle iterables

  da.equals = (a,b) => {
    if(a === b) {
      return true;
    }

    if(typeof a !== 'object' ||
        typeof b !== 'object' ||
        a === null || b === null) {
      return false;
    }

    if(Array.isArray(a)) {
      if(!Array.isArray(b)) {
        return false;
      }
      if(a.length !== b.length) {
        return false;
      }
      for(var i = 0; i < a.length; ++i) {
        if(!da.equals(a[i], b[i])) {
          return false;
        }
      }
      return true
    }

    if(a.constructor === Object) {
      if(b.constructor !== Object) {
        return false;
      }
      if(!da.equals( 
            Object.keys(a).sort(),
            Object.keys(b).sort())) {
        return false;
      }
      for(var key in a) {
        if(!da.equals(a[key] ,b[key])) {
          return false;
        }
      }
      return true;
    }

    if(typeof a.equals === 'function') {
      return a.equals(b);
    }
    return false;
  }

  test('equals', () => {
    da.assert(da.equals({a:[1,2],b:3},{b:3,a:[1,2]}));
    da.assert(!da.equals({a:["1",2],b:3},{b:3,a:[1,2]}));
    da.assertEquals({a:[1,2],b:3},{b:3,a:[1,2]});
  });

  // ### TODO `parseStack(err)`
  //
  // TODO should be used for better error reporting during testing, ie. line number of assert error

  // ## Testing

  // ### `assert(bool)`

  da.assert = (ok) => ok || throwAssert({type: 'truthy', val: ok});

  // ### `assertEquals(val1, val2)`

  da.assertEquals = (val1, val2) => 
    da.equals(val1, val2) || throwAssert({type: 'equals', vals: [val1, val2]});

  // ### `test([name], fn)`
  //
  // TODO: keep track of which module tests belongs to

  var tests;
  da.test = test;
  function test(name, f) {
    if(!f) {
      f = name; name= undefined;
    }
    f.testName = name;
    if(!tests) {
      tests = [];
    }
    tests.push(f);
  };

  // ### `runTests(modules)`
  //
  // TODO: only run desired modules

  da.runTests = (modules) => { // TODO: run for named modules
    for(var i = 0; i < tests.length; ++i) {
      runTest(tests[i]);
    }
  }

  var testTimeout = 5000;

  function runTest(t) {
    var err, p;

    try {
      p = Promise.resolve(t());
    } catch(e) {
      p = Promise.reject(e);
    }

    var timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), testTimeout));
    p = Promise.race([p, timeout]);

    p = p.catch(e => err = e);

    p.then(() => {
      if(err) {
        console.log('Test error in "' +
            (t.testName || '') +
            ': ' + err.message);
        if(err.assert) {
          try {
            console.log(JSON.stringify(err.assert));
          } catch(e) {
            console.log(err.assert);
          }
        }

        if(err.stack) {
          console.log(err.stack);
        }

        throw err;
      } else {
        console.log('Test ok', t.testName || '');
      }
    });
  }

  if(false) {
    test('must error 1', () => da.assert(false));
    test('must error 2', () => new Promise(() => da.assert(false)));
    test('must error 3', () => new Promise((reject, resolve) => {true}));
  }

  // ### Implementation details
  //
  // To get the call stack correct, to be able to report assert position, we throw an `Error` (which includes the stack on many browsers), and enrich it with more information.

  function throwAssert(o) {
    var err = new Error('AssertError');
    err.assert = o;
    throw err;
  }

  test('assert',()=>{
    try {
      da.assertEquals(1,2);
    } catch(e) {
      da.assert(e.message === 'AssertError');
      da.assert(typeof e.stack === 'string');
    }
  });

  // ## Done
  //
  if(typeof module === 'undefined') {
    self.direape = da;
  } else {
    module.exports = da;
  }
})();
// # Old
// ## REUN - require(unpkg) 
//
/*
// 
// Reun is:
// 
// - 100% client-side nodejs-like `require` for the browser.
// - using https://unpkg.com/.
// - dynamic, just `require(...)` whatever module you want from your source file. No need for `package.json`, - versions can be passed to require, i.e. `require('module@1.2.3')`.
// - pretending to be a synchronous, even though it is asynchrounous. Tries to work in the typical cases, and will always fail in certain documented edge cases. Pragmatic, and not standard compliant.
// - able to directly load many nodejs modules, that has not been packaged for the browser.
// - adding custom functionality when desired, i.e. `module.meta`
// 
// ### API
// 
// - `reun.run(code, [opt])` execute `code`, where `code` is either a function, or the string source of a module. `require()` is available and is pretending to be synchronous, and done relative to the `opt.uri`. Returns a promise of the function result or module-exports.
// - `reun.require(module)` loads a module, path is relative to the `location.href` if available. Returns a promise.
// 
// ### Usage example
// 
// `index.html`:
// ```html
// <!DOCTYPE html>
// <html>
//   <body>
//     <script src=https://unpkg.com/reun></script>
//     <script>reun.require('./example.js');</script>
//   </body>
// </html>
// ```
// 
// `example.js`:
// ```javascript
// var uniq = require('uniq');
// console.log(uniq([1,4,2,8,4,2,1,3,2]));
// ```
// 
// ### Extensions
// 
// - `require('module@0.2.3')` allows you to require a specific version
// - `module.meta` allows you to set meta information about your module, - this may later be used to automatically package the module for npm, cordova, ...
// 
// ### Incompatibilities
// 
// The implementation is a hack. We want to _pretend_ to be synchronous, but we also do not want to block the main thread. Instead `require` throws an exception when a module is not loaded yet. When we run a file, we catch this exception, load the module asynchrounously, and then rerun the file. Later on we might also search the source for `require("...")`, or `require('...')` and try to preload these modules, but this is not implemented yet.
// 
// Also we just resolve the module name as `'https://unpkg.com/' + module_name`. To be more compatible with node modules, we may check the `package.json` in the future to make sure that the relative paths in the require works.
// 
// - Custom exceptions from `require` should not caught.
// - Code before a require, may be executed multiple times, - should be side-effect free.
// - `require` may fail within callbacks, if the module has not been loaded before.
// - If the source lives in a subdirectory, and the module is not packaged for the web, and contains relative paths, - the paths are wrongly resolved. A workaround is to `require('module/lib/index.js')` instead of `require('module')`.
// - It does obviously not work with every module.
// 
// In spite of these limitations, it is still possible to `require` many nodejs module directly to the web.
//
// ## Source Code

(function() { "use strict";
var reun = {};
reun.log = function() {};

// Http(s) get utility function, as `fetch` is not generally available yet.
//
reun.urlGet = function urlGet(url) {
reun.log('urlGet', url);
return new Promise(function(resolve, reject) {
var xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onreadystatechange = function() {
if(xhr.readyState === 4) {
if(xhr.status === 200 && typeof xhr.responseText === 'string') {
resolve(xhr.responseText);
} else {
  reject(xhr);
}
}
}
xhr.send();
});
};


// When trying to load at module, that is not loaded yet, we throw this error:
//
function RequireError(module, url) { 
  this.module = module; 
  this.url = url;
}
RequireError.prototype.toString = function() {
  return 'RequireError:' + this.module +
    ' url:' + this.url;
}

// Convert a require-address to a url.
// path is baseurl used for mapping relative file paths (`./hello.js`) to url.
//
function moduleUrl(path, module) {
  if(module.slice(0,4) === 'reun') {
    return 'reun';
  }
  if(module.startsWith('https:') ||
      module.startsWith('http:')) {
    return module;
  }
  path = path.replace(/[?#].*.?/, '');
  path = (module.startsWith('.')
      ? path.replace(/[/][^/]*$/, '/')  
      : 'https://unpkg.com/');
  path = path + module;
  while(path.indexOf('/./') !== -1) {
    path = path.replace('/./', '/');
  }
  var prevPath;
  do {
    prevPath = path;
    path = path.replace(/[/][^/]*[/][.][.][/]/g, '/');
  } while(path !== prevPath);
  return path;
}

var modules = {reun:reun};
function _eval(code, opt) {
  var opt = opt || {};
  reun.log('_eval', opt.uri);
  var result, wrappedSrc, module;
  var uri = typeof opt.uri === 'string' ? opt.uri : '';
  var require = function require(module, opt) {
    if(modules[module]) {
      return modules[module];
    }
    var url = moduleUrl(uri, module);
    if(!modules[url]) {
      throw new RequireError(module, url);
    } 
    return modules[url];
  };
  if(typeof code === 'string') {
    wrappedSrc = '(function(module,exports,require){' +
      code + '})//# sourceURL=' + uri;
    module = {
      require: require,
      id: uri.replace('https://unpkg.com/', ''),
      uri: uri,
      exports: {}};
    code = function() {
      eval(wrappedSrc)(module, module.exports, require);
      return module.exports;
    };
  } else if(typeof self.require === 'undefined') {
    self.require = require;
  }
  try {
    result = code();
  } catch (e) {
    if(e.constructor !== RequireError) {
      throw e;
    }
    return reun.urlGet(e.url)
      .catch(function() {
        throw new Error('require could not load "' + e.url + '" ' +
            'Possibly module incompatible with http://reun.solsort.com/');
      }).then(function(moduleSrc) {
        return _eval(moduleSrc, {uri: e.url});
      }).then(function(exports) {
        modules[e.url] = exports;

        // Find the short name of the module, and remember it by that alias,
        // to make sure that later requires for the module without version/url
        // returns the already loaded module.
        //
        if(e.url.startsWith('https://unpkg.com/') ||
            exports.meta && exports.meta.id) {
          var name = e.url
            .replace('https://unpkg.com/', '')
            .replace(/[@/].*.?/, '');
          if(!modules[name]) {
            modules[name] = exports;
          }
        }
      }).then(function() {
        return _eval(code, opt);
      });
  }
  return Promise.resolve(result);
}

var evalQueue = Promise.resolve();

function doEval(code, opt) {
  evalQueue = evalQueue.then(function() {
    return _eval(code, opt);
  }).catch(function(e) {
    setTimeout(function() {
      throw e;
    }, 0);
  });
  return evalQueue;
}
reun.eval = doEval;

reun.require = function require(name) {
  if(self.module && self.module.require) {
    return Promise.resolve(require(name));
  }
  return doEval('module.exports = require(\'' + name + '\');', 
      {uri: self.location && self.location.href || './'});
}

if(typeof module === 'object') {
  module.exports = reun;
} else {
  self.reun = reun;
}

// ## License
// 
// This software is copyrighted solsort.com ApS, and available under GPLv3, as well as proprietary license upon request.
// 
// Versions older than 10 years also fall into the public domain.
// 

// <img src=https://direape.solsort.com/icon.png width=96 height=96 align=right>
//
// [![website](https://img.shields.io/badge/website-direape.solsort.com-blue.svg)](https://direape.solsort.com/) 
// [![github](https://img.shields.io/badge/github-solsort/direape-blue.svg)](https://github.com/solsort/direape)
// [![codeclimate](https://img.shields.io/codeclimate/github/solsort/direape.svg)](https://codeclimate.com/github/solsort/direape)
// [![travis](https://img.shields.io/travis/solsort/direape.svg)](https://travis-ci.org/solsort/direape)
// [![npm](https://img.shields.io/npm/v/direape.svg)](https://www.npmjs.com/package/direape)
//
// ## DireApe - Distributed Reactive App Environment
//
// *Unstable - under development - do not use it yet*
// 
// DireApe is an JavaScript library for making distributed reactive apps. It delivers:
// 
// - message passing between processes
// - a reactive world state
// 
// ## Concepts
// 
// ### Processes / message parsing
// 
// DireApe facilitates communication between processes. Every process has a globally unique id `pid` and a set of named mailboxes. It is possible to send messages to a given "mailbox `@` process id".
// 
// The current supported processes are the browser main thread, and webworkers. The intention is to also send messages across the network, and to nodejs/workers.
// 
// ### Reactive state
// 
// Each process has a state that conceptually consist a consistent JSON-Object. The JSON-Object may also contain binary data, and is stored as an immmutable data structure, to allow fast diff'ing for reactive programming.
// 
// It is possible to add reactive functions to the state, such that they are called when the state changes.
// 
// ## API implementation
//
var da = reun;
da.eval(() => {
  da.log = function() {};

  // ### Defining handlers/reactions
  //
  // Keep track of the handlers/reactions. The keys are `name`, and the values are the corresponding functions.
  //
  // TODO: consider refactoring `handlers` to be a Map instead of an Object, - as we `delete`, which may be expensive.
  //
  da._handlers = {};

  // `da.handle("name", (...parameters) => promise)` adds a new event handler. When `name` is run/called, the function is executed, the new state replaces the old state, and the return/reject of the promise is returned.
  //
  da.handle = (name, f) => {
    da._handlers[name] = f;
  };

  // `da.reaction(name, () => promise)` - adds a reactive handle, that is executed when the `name` is emitted, or the accessed parts of the state has changed.
  //
  da.reaction = (name, f) => {
    if(!f) {
      delete reactions[name];
      delete da._handlers[name];
    } else {
      da._handlers[name] = makeReaction(name, f);
      return da._handlers[name];
    }
  };

  // ### Process / messages
  //
  // `da.pid` is the unique id of the current process. randomString has enough entropy, that we know with a probability as high as human certainty that the id is globally unique.

  da.pid = reun.pid || 'PID' + randomString();

  self.onmessage = o => send(o.data);

  // `da.run(pid, name, ...parameters)` executes a named handle in a process, and discards the result.

  da.run = function direape_run(pid, name) {
    var params = slice(arguments, 2);
    send({dstPid: pid, dstName: name, params: params});
  };

  // `da.call(pid, name, ...parameters) => promise` executes a named handle in a process, and returns the result as a promise. This is done by registring a temporary callback handler.

  da.call = function direape_call(pid, name) {
    //console.log('call', arguments);
    var params = slice(arguments, 2);
    return new Promise((resolve, reject) => {
      send({dstPid: pid, dstName: name, 
        srcPid: da.pid,
        srcName: callbackHandler((val, err) => {
          //console.log('got-result', name, val, err);
          if(err) {
            reject(err);
          } else {
            resolve(val);
          }
        }),
        params: params});
    });
  };

  // ### Accessing the application state
  //
  // The state is an immutable value, which is useful for diffing, comparison, etc. The value only contains a JSON+Binary-object, such that it can always be serialised.
  //
  // Exposing an immutable object may also be useful outside of the library may be useful later on. It is not exposed / publicly available yet, to avoid exposing the immutable data structure, and we may want to use something simpler than the `immutable` library.
  //
  // TODO: extend the api to make immutable value available. For example like `da.getIn([...keys], defaultVale) => Immutable`. This is also why the api is called setJS/getJS, - as setIn/getIn should return immutable values.

  var immutable = require('immutable');
  var state = new immutable.Map();

  // `da.setJS([...keys], value)` sets a value, - only allowed to be called synchronously within a handler/reaction, to avoid race-conditions
  // 
  // Making a change may also trigger/schedule reaction to run later.

  da.setJS = (path, value) => { 
    state = setJS(state, path, value); 
    reschedule();
  };

  // `da.getJS([...keys], defaultValue)` gets a value within the state

  da.getJS = (path, defaultValue) => {
    var result = state.getIn(path);
    accessHistoryAdd(path);
    return result === undefined ? defaultValue :
      (result.toJS ? result.toJS() : result);
  };

  // ### Creating / killing children
  // 
  // Keep track of the child processes, by mapping their pid to their WebWorker object.
  //
  // TODO: may make sense to use a Map instead, as we do deletes.

  var children = {};

  // `da.spawn() => promise` spawn a new process, and return its pid as a promise.
  //
  // When the new worker is created, we send back and forth the pids, so the parent/children knows its child/parent. And then we also set up handling of messages.

  da.spawn = () => new Promise((resolve, reject) => {
    var childPid = 'PID' + randomString();
    var workerSourceUrl = 
      (self.URL || self.webkitURL).createObjectURL(new Blob([`
            importScripts('https://unpkg.com/reun');
            reun.urlGet = function(url) { 
              return new Promise((resolve, reject) => {
                self.postMessage(url);
                self.onmessage = o => {
                  resolve(o.data);
                };
              });
            };
            reun.pid = '${childPid}';
            reun.require('direape@0.1').then(da => {
              //reun.require('http://localhost:8080/direape.js').then(da => {
              //da.log = function() { console.log.apply(console,da._slice(arguments))};
              da.parent = '${da.pid}';
              reun.urlGet = url => da.call(da.parent, 'reun:url-get', url);
              self.postMessage({ready:true});
            });
            `], {type:'application/javascript'}));
      var child = new Worker(workerSourceUrl);
      children[childPid] = child;
      child.onmessage = o => {
        o = o.data;
        if(o.ready) {
          child.onmessage = o => send(o.data);
          return resolve(childPid);
        }
        reun.urlGet(o).then(val => {
          child.postMessage(val);
        });
      };
            });

            // `da.kill(pid)` kill a child process

            da.kill = (pid) => {
              children[pid].terminate();
              delete children[pid];
            };

            // `da.children()` lists live child processes

            da.children = () => Object.keys(children);


            // ## Built-in Handlers

            da.handle('reun:url-get', reun.urlGet);
            // setIn/getIn

            da.handle('da:setIn', da.setJS);
            da.handle('da:getIn', da.getJS);

            // TODO: make `reun:run` result serialisable, currently we just discard it

            da.handle('da:eval', (src, opt) => 
                reun.eval(src, opt).then(o => jsonify(o)));

            da.handle('da:subscribe', (path, opt) => 
                jsonify(da.reaction(`da:subscribe ${path} -> ${opt.name}@${opt.pid}`,
                    () => da.run(opt.pid, opt.name, path, da.getJS(path)))));

            da.handle('da:unsubscribe', (path, opt) => 
                da.reaction(`da:subscribe ${path} -> ${opt.name}@${opt.pid}`));
            // TODO:
            //
            // - `da:subscribe(path, handlerName)` - call `da.run(da.pid, handlerName, path, value)` on changes
            // - `da:unsubscribe(path, handlerName)`

            // ## Internal functions
            //
            // TODO more documentation in the rest of this file

            function callbackHandler(f) {
              var id = 'callback:' + randomString();
              da._handlers[id] = function() {
                delete da._handlers[id];
                return f.apply(null, slice(arguments));
              };
              return id;
            }

            // ###  Setting af JS-value deeply inside an immutable json object
            //
            // Utility function for setting a value inside an immutable JSON object.
            // The state is kept JSON-compatible, and thus we create Map/Object or List/Array depending on whether the key is a number or string.
            //
            // TODO: better error handling, ie handle wrong types, i.e. setting a number in an object or vice versa

            function setJS(o, path, value) {
              if(path.length) { // TODO: check that we are in handler, or else throw 
                var key = path[0];
                var rest = path.slice(1);
                if(!o) {
                  if(typeof key === 'number') {
                    o = new immutable.List();
                  } else {
                    o = new immutable.Map();
                  }
                }
                return o.set(key, setJS(o.get(path[0]), path.slice(1), value));
              } else {
                return immutable.fromJS(value);
              }
            }

            // ### Handling access history for reactions
            var accessHistory = undefined;
            function accessHistoryAdd(path) {
              if(accessHistory) {
                accessHistory.add(JSON.stringify(path));
              }
            }

            // ### make reaction
            // 
            // The reactions object is used to keep track of which of the handlers that are reactions. 
            //
            // makeReaction, keeps track of whether a function is actually a reaction.
            //
            // TODO: think through whether there might be a bug: when a reaction is overwritten by a handler with the same name, - if the reaction is triggered, then it might call the handler?...
            //
            var reactions = {};
            function makeReaction(name, f) {
              reactions[name] = new Set(['[]']);
              var reaction = function() {
                if(da._handlers[name] !== reaction) {
                  delete reactions[name];
                  return;
                } 
                var prevAccessHistory = accessHistory;
                accessHistory = new Set();
                try {
                  f();
                } catch(e) {
                  console.log('error during reaction', name, e);
                }
                if(reactions[name]) {
                  reactions[name] = accessHistory;
                }
                accessHistory = prevAccessHistory;
              };
              return reaction;
            }


            // ### Event loop
            //
            var prevState = state;
            var messageQueue = [];
            var scheduled = false;

            // #### request/schedule execution of reactions / sending pending messages

            function reschedule() {
              if(!scheduled) {
                nextTick(handleMessages);
                scheduled = true;
              }
            }

            // #### Send a message

            function send(msg) {
              da.log('send', msg);
              if(msg.dstPid === da.pid) {
                messageQueue.push(msg);
                reschedule();
              } else if(children[msg.dstPid]) {
                try {
                  children[msg.dstPid].postMessage(msg);
                } catch(e) {
                  try {
                    children[msg.dstPid].postMessage(jsonify(msg));
                  } catch(e2) {
                    console.log('send error', msg, e2);
                    throw e2;
                  }
                }
              } else {
                try {
                  self.postMessage(msg);
                } catch(e) {
                  console.log('send error', msg, e);
                  throw e;
                }
              }
            }

            // #### send a response to a message

            function sendResponse(msg, params) {
              if(msg.srcPid && msg.srcName) {
                send({
                  dstPid: msg.srcPid, 
                  dstName: msg.srcName, 
                  params: params});
              } 
            }

            // #### dispatch all messages in the message queue and run reactions

            function handleMessages() {
              scheduled = false;
              if(messageQueue.length) {
                var messages = messageQueue;
                messageQueue = [];
                messages.forEach(handleMessage);
              }
              scheduleReactions();
            }

            // #### Request reactions to be executed

            function scheduleReactions() {
              if(prevState.equals(state)) {
                return;
              }

              var name, accessedPaths, accessedPath, path, changed, prev, current;
              for (name in reactions) {
                accessedPaths = reactions[name];
                changed = false;
                for (accessedPath of accessedPaths) {
                  path = JSON.parse(accessedPath);
                  prev = prevState.getIn(path);
                  current = state.getIn(path);
                  if (prev !== current) {
                    if ((prev instanceof immutable.Map || 
                          prev instanceof immutable.List)
                        && prev.equals(current)){
                      continue;
                    } 
                    changed = true;
                    break;
                  }
                }
                if(changed) {
                  send({dstPid: da.pid, dstName: name});
                }
              }
              prevState = state;
            }

            // #### Handle a single message

            function handleMessage(msg) {
              da.log('handleMessage', msg);
              try {
                if(!da._handlers[msg.dstName]) {
                  console.log('Missing handler: ' + msg.dstName);
                  throw new Error('Missing handler: ' + msg.dstName);
                }
                Promise
                  .resolve(da._handlers[msg.dstName].apply(null, msg.params))
                  .then(o => sendResponse(msg, [o]), 
                      e => sendResponse(msg, [null, jsonify(e)]));
              } catch(e) {
                sendResponse(msg, [null, jsonify(e)]);
              }
            }


            // ### Generic utility function
            //
            // May be temporarily exported, during development, but not intended to be used outside of module.

            // TODO extract common code to common core library
            da._jsonify = jsonify;
            da._slice = slice;
            da._jsonReplacer = jsonReplacer;

            function jsonify(o) {
              return JSON.parse(JSON.stringify([o], (k,v) => jsonReplacer(v)))[0];
            }

            var jsonifyWhitelist = 
              ['stack', 'name', 'message', 
            'id', 'class', 'value'
              ];

            function jsonReplacer(o) {
              if((typeof o !== 'object' && typeof o !== 'function') || o === null || Array.isArray(o) || o.constructor === Object) {
                return o;
              }
              var result, k, i;
              if(typeof o.length === 'number') {
                result = [];
                for(i = 0; i < o.length; ++i) {
                  result[i] = o[i];
                }
              }
              result = Object.assign({}, o);
              if(o.constructor && o.constructor.name && result.$_class === undefined) {
                result.$_class = o.constructor.name;
              }
              if(o instanceof ArrayBuffer) {
                //
                // TODO btoa does not work in arraybuffer, 
                // and apply is probably slow.
                // Also handle Actual typed arrays,
                // in if above. 
                //
                result.base64 = self.btoa(String.fromCharCode.apply(null, new Uint8Array(o)));
              }
              for(i = 0; i < jsonifyWhitelist.length; ++i) {
                k = jsonifyWhitelist[i] ;
                if(o[k] !== undefined) {
                  result[k] = o[k];
                }
              }
              return result;
            }

            function randomString() {
              return Math.random().toString(32).slice(2) +
                Math.random().toString(32).slice(2) +
                Math.random().toString(32).slice(2);
            }
            function nextTick(f) {
              setTimeout(f, 0);
            }
            function slice(a, start, end) {
              return Array.prototype.slice.call(a, start, end);
            }

            // ## exports
            //
            self.direape = da;

            // ## Main / test
            //
            // this is currently just experimentation during development.
            //
            // TODO: replace this with proper testing

            //console.log('started', da.pid);
            da.main = () => {
              console.log('running', da.pid);
              reun.log = da.log = function() { console.log(slice(arguments)); };
              da.reaction('blah', () => {
                console.log('blah', da.getJS(['blah']));
              });

              da.setJS(['blah', 1, 'world'], 'hi');
              console.log('here', da.getJS(['blah']));

              da.handle('hello', (t) => {
                da.setJS(['blah'], '123');
                console.log('hello', t);
                return 'hello' + t;
              });
              da.run(da.pid, 'hello', 'world');
              da.call(da.pid, 'hello', 'to you').then(o => console.log(o));
              da.call(da.pid, 'hello', 'to me').then(o => console.log(o));
              da.setJS(['hi'], 'thread-1');
              da.spawn().then(child => {
                da.handle('log', function () { console.log('log', arguments); });
                da.call(child, 'da:subscribe', ['hi'], {pid: da.pid, name: 'log'});
                da.call(child, 'da:eval', 
                    'require("http://localhost:8080/direape.js").setJS(["hi"], "here");', 
                    'http://localhost:8080/')
                  .then(result => console.log('result', result))
                  .then(() => da.call(child, 'da:getIn', ['hi'], 123))
                  .then(o => console.log('call-result', o))
                  .then(() => da.call(da.pid, 'da:getIn', ['hi'], 432))
                  .then(o => console.log('call-result', o));
              });
              console.log(Object.keys(da));
              try {
                throw new Error();
              } catch(e) {
                console.log(jsonify(e));
              }
              console.log(undefined);
              document.body.onclick = function(e) {
                console.log(jsonify(e));
              };
              document.body.click();
              da.setJS(['foo'], 123);
              da.reaction('a', o => {
                console.log('a', da.getJS(['foo']));
                console.log('b', da.getJS(['baz']));
              });
              setTimeout(o => da.setJS(['bar'], 456), 200);
              setTimeout(o => da.setJS(['foo'], 789), 400);
            };
  });
})();
*/

// ## License
// 
// This software is copyrighted solsort.com ApS, and available under GPLv3, as well as proprietary license upon request.
// 
// Versions older than 10 years also fall into the public domain.
// 
// ## Future ideas
//
// - Make the library truely functional, ie. `da` will be a monadic state which also implements being a promise.
// - Add API for creating a cached reactive function.
