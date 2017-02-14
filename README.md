<img src=https://direape.solsort.com/icon.png width=96 height=96 align=right>

[![website](https://img.shields.io/badge/website-direape.solsort.com-blue.svg)](https://direape.solsort.com/)
[![github](https://img.shields.io/badge/github-solsort/direape-blue.svg)](https://github.com/solsort/direape)
[![codeclimate](https://img.shields.io/codeclimate/github/solsort/direape.svg)](https://codeclimate.com/github/solsort/direape)
[![travis](https://img.shields.io/travis/solsort/direape.svg)](https://travis-ci.org/solsort/direape)
[![npm](https://img.shields.io/npm/v/direape.svg)](https://www.npmjs.com/package/direape)

# DireApe - Distributed Reactive App Environment

Read up to date documentation on [AppEdit](https://appedit.solsort.com/?Read/js/gh/solsort/direape).

    (function() {
      var da; setupModule();
    
## Message Passing

### `handle(name, fn, opt)`

      var handlers;
    
      da.handle = (name, fn, opt) => {
        if(!fn) {
          handlers.delete(name);
        }
        handlers.set(name, Object.assign(opt || {}, {fn:fn}));
      };

### `emit(pid, name, args...)`

TODO: test
    
      da.emit = function(pid, name) {
        send({
          dstPid: pid,
          dstName: name,
          data: da.slice(arguments, 2)
        });
      };
    
### `call(pid, name, args...)`

      da.call = function(pid, name) {
        return new Promise((resolve, reject) =>
            send({
              dstPid: pid,
              dstName: name,
              srcPid: da.pid,
              srcName: makeCallbackHandler(resolve, reject),
              data: da.slice(arguments, 2)
            }));
      };
    
### `pid`, `nid`

`pid` is the process id and `nid` is the node id.

These are set by parent thread, so if they are unset, it means that we are the node main thread.

The pid is the hash of the public key for the node.

We do not use the keys for identity yet,
but later on, it will come in handy.
    
      var publicKey;
      function initPid() {
        if(!da.pid) {
          if(!self.crypto && isNodeJs()) {
            publicKey = Math.random().toString(); // TODO
            da.pid = require('crypto')
              .createHash('sha256')
              .update(publicKey)
              .digest('base64');
          } else {
            return da.pid || Promise.resolve()
              .then(() => self.crypto.subtle ||
                  (self.crypto.subtle = self.crypto.webkitSubtle))
              .then(() => self.crypto.subtle.generateKey(
                    {name: 'ECDSA', namedCurve: 'P-521'},
                    true, ['sign', 'verify']))
              .then(key => self.crypto.subtle.exportKey('spki', key.publicKey))
              .then(spki => publicKey = spki)
              .then(buf => self.crypto.subtle.digest('SHA-256', buf))
              .then(buf => btoa(da.buf2ascii(buf)))
              .then(base64 => da.pid = da.nid = base64)
              .catch(e => {
                document.body.innerHTML = `
                  This app requires a browser that supports web cryptography.<br>
                  This has been tested to work recent Chrome and Firefox.`;
                throw e;
              });
          }
        }
      }
    
### Implementation details

      var messageQueue = [];
      var postmanScheduled = false;
      var callTimeout = 10000;
      handlers = new Map();
    
      function makeCallbackHandler(resolve, reject) {
        var name = 'callback' + Math.random().toString().slice(2);
        var timeout = setTimeout(
            () => handler(null, 'call timeout'),
            callTimeout);
    
        function handler(result, error) {
          clearTimeout(timeout);
          da.handle(name, null);
          if(error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
    
        da.handle(name, handler, {public: true});
        return name;
      }
    
      function send(msg) {
        messageQueue.push(msg);
        schedulePostman();
      }
    
      function schedulePostman() {
        if(!postmanScheduled) {
          da.nextTick(postman);
          postmanScheduled = true;
        }
      }
    
      function postman() {
        postmanScheduled = false;
        var messages = messageQueue;
        messageQueue = [];
        for(var i = 0; i < messages.length; ++i) {
          processMessage(messages[i]);
        }
      }
    
      function processMessage(msg) {
        if(msg.dstPid === da.pid) {
          processLocalMessage(msg);
        } else {
          relay(msg);
        }
      }
    
      function processLocalMessage(msg) {
        var result;
        var handler = handlers.get(msg.dstName) || {};
    
        if(msg.external && ! handler.public) {
          return sendReply(msg, [null, 'no such public function']);
        }
    
        var fn = handler.fn;
        if(!fn) {
          console.log('no such function:', msg.dstName);
          return sendReply(msg, [null, 'no such function']);
        }
    
        Promise.resolve(fn.apply(msg, msg.data))
          .then(result => sendReply(msg, [result]))
          .catch(e => sendReply(msg, [null, e]));
      }
    
      function sendReply(msg, data) {
        if(msg.srcPid !== undefined && msg.srcName !== undefined) {
          send({
            dstPid: msg.srcPid,
            dstName: msg.srcName,
            data: data
          });
        }
      }
    
      test('message passing', () => {
        da.handle('da:square', i => i*i);
        return da.call(da.pid, 'da:square', 9)
          .then(i => da.assertEquals(i, 81));
      });
    
## Workers

### `isWorker()`
    
      da.isWorker = isWorker;
      function isWorker() {
        return !!self.postMessage && self.postMessage.length === 1;
      }
    
### `spawn()`
    
      if(isBrowser()) {
    
        var children;
        var direapeSource;
    
        da.spawn = () => new Promise((resolve, reject) => {
    
          var childPid = da.pid + Math.random().toString(36).slice(2,12);
          var workerSource = `
            self.direape = {
              pid: '${childPid}',
              nid: '${da.pid}'
            };
          ` + direapeSource;
    
          var workerSourceUrl = URL.createObjectURL(
              new Blob([workerSource], {type:'application/javascript'}));
    
          var child = new self.Worker(workerSourceUrl);
          console.log(child);
    
          children.set(childPid, child);
    
          child.onmessage = (o) => {
            child.onmessage = (o) => send(o.data);
            URL.revokeObjectURL(workerSourceUrl);
            resolve(childPid);
          };
        });
    
### `children()`
    
        da.children = () => children.keys();
    
### `kill(child-id)`
    
        da.kill = (pid) => {
          children.get(pid).terminate();
          children.delete(pid);
        };
    
### Implementation details
    
        children = new Map();
    
      }
    
Send the message to ther processes. Only called if it shouldn't be handled by the process itself;
    
      function relay(msg) {
        if(isWorker()) {
          self.postMessage(msg);
        } else if(isBrowser()) {
          var child = children.get(msg.dstPid);
          if(child) {
            child.postMessage(msg);
          } else {
            relayNetwork(msg);
          }
        } else {
          relayNetwork(msg);
        }
      }
    
      function initWorker() {
        if(isWorker()) {
          self.onmessage = (o) => send(o.data);
          self.postMessage({});
        } else {
          var reunRequest = da.GET('https://unpkg.com/reun@0.2');
          return da.GET(isDev() ? './direape.js' : 'https://unpkg.com/direape@0.2')
            .then(src => direapeSource = src)
            .then(() => reunRequest)
            .then(reun => direapeSource += reun);
        }
      }
    
      function isDev() {
        return isNodeJs() ? process.env.DIREAPE_DEV : location.hostname === 'localhost';
      }
    
      if(isBrowser()) {
        test('workers', () => {
          var childPid;
          return da.spawn()
            .then(pid => childPid = pid)
            .then(() => da.call(childPid, 'da:status'))
            .then(o => da.assertEquals(o.pid, childPid));
        });
      }
    
## Network

### `online([boolean/url])`

TODO: automatic reconnect
    
      if(isBrowser()) {
    
        var websocket;
    
        da.online = function(url) {
          if(arguments.length === 0) {
            return websocket && websocket.readyState === 1;
          }
    
          closeWebSocket();
    
          if(url) {
            if(typeof url !== 'string') {
              url = 'wss://direape.solsort.com';
            }
            return new Promise((resolve, reject) => {
              websocket = new WebSocket(url);
              websocket.onopen = () => {
                websocket.send(JSON.stringify({direapeConnect: da.buf2ascii(publicKey)}));
                resolve(true);
              };
              websocket.onerror = (e) => {
                da.emit(da.pid, 'da:socket-error', e);
                reject(e);
              };
              websocket.onmessage = o => {
                var msg = o.data;
                msg = JSON.parse(msg);
                msg.external = msg.external || true;
                send(msg);
              };
            });
          }
        };
      }
    
### Implementation details

Send the message to ther processes. Only called if it shouldn't be handled by the process itself;
    
      if(isNodeJs()) {
        var wsClients = new Map();
      }
    
      function closeWebSocket() {
        if(websocket) {
          websocket.onerror = () => null;
          websocket.close();
        }
      }
    
      function relayNetwork(msg) {
        if(isNodeJs()) {
          var dst = wsClients.get(msg.dstPid.slice(0,44));
          console.log('relay', msg, wsClients.keys(), dst);
          if(dst) {
            console.log('relay send', msg);
            dst.send(JSON.stringify(msg));
          }
        } else {
          if(websocket) {
            websocket.send(JSON.stringify(msg));
          }
        }
      }
    
### Server: nodejs websocket server that relays messages
    
      if(isNodeJs()) {
        da.startServer = () => {
          var app = require('express')();
          app.use(require('express').static('.'));
    
          var server = require('http').createServer(app);
    
          var wss = new (require('ws').Server)({
            perMessageDeflate: false,
            server: server
          });
    
          wss.on('connection', (ws) => {
            var nid;
            ws.on('message', (msg) => {
              msg = JSON.parse(msg);
              if(msg.direapeConnect) {
                if(nid) {
                  wsClients.delete(nid);
                }
                nid = require('crypto')
                  .createHash('sha256')
                  .update(msg.direapeConnect)
                  .digest('base64');
                wsClients.set(nid, ws);
              } else {
                msg.external = nid;
                if(msg.dstPid === 'server') {
                  msg.dstPid = da.pid;
                }
                send(msg);
              }
            });
            ws.on('close', () => {
              if(nid) {
                wsClients.delete(nid);
              }
            });
          });
    
          server.listen(8888, () => console.log('started server on port 8888'));
        };
      }
    
## Built-in Handlers
    
      function initHandlers() {
    
### `da:list-clients ()`

        
        if(isNodeJs()) {
          da.handle('da:list-clients', () => Array.from(wsClients.keys()), {public: true});
        }
    
### `da:get (url)`
    
        da.handle('da:GET', da.GET);
    
### `da:status ()`
    
        da.handle('da:status', () => ({pid: da.pid, time: Date.now()}), {public: true});
    
### `da:children ()`
    
        if(!isBrowser()) {
          da.handle('da:children', da.children);
        }
      }
## Utilities

### `ready(fn)`

      var waiting = [];
      da.ready = (fn) => {
        if(waiting) {
          waiting.push(fn);
        } else {
          fn();
        }
      };
    
### `isNodeJS()`, `isBrowser()`

      da.isNodeJs = isNodeJs;
      function isNodeJs() {
        return !!((self.process || {}).versions || {}).node;
      }
    
      da.isBrowser = isBrowser;
      function isBrowser() {
        return !!(self.window);
      }
    
### `da.log(...)` `da.trace(...)`

      da.log = function(msg, o) {
        console.log.apply(console, arguments);
        return o;
      };
      da.trace = da.log;

### `GET(url)`

TODO: make it work with unpkg(cross-origin) in webworkers (through making request in main thread).
    
      if(self.XMLHttpRequest) {
        da.GET = (url) => new Promise((resolve, reject) => {
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
      } else {
        da.GET = (url) => new Promise((resolve, reject) => {
          if(url[0] === '.') {
            resolve(require('fs').readFileSync(url));
          } else {
            return require('request')(url, (err, res, body) =>
                err || res.statusCode !== 200 ? reject(err) : resolve(body));
          }
        });
      }
      test('GET ok', () => da.GET('https://unpkg.com/direape'));
      test('GET fail', () => da.GET('https://unpkg.com/direape/notfound')
          .catch(() => 'error')
          .then(ok => da.assertEquals('error', ok)));
    
### `jsonify(obj)`

Translate JavaScript objects JSON

    
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
    
        if((typeof o !== 'object' && typeof o !== 'function') ||
            o === null || Array.isArray(o) || o.constructor === Object) {
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

TODO btoa does not work in arraybuffer,
and apply is probably slow.
Also handle Actual typed arrays,
in if above.

          result.base64 = self.btoa(
              String.fromCharCode.apply(null, new Uint8Array(o)));
        }
        for(i = 0; i < jsonifyWhitelist.length; ++i) {
          k = jsonifyWhitelist[i] ;
          if(o[k] !== undefined) {
            result[k] = o[k];
          }
        }
        return result;
      }
    
### `nextTick(fn)`
    
      da.nextTick = nextTick;
      function nextTick(f) {
        setTimeout(f, 0); // TODO this is relatively slow, could implement with faster version.
      }
    
### `slice(arr, i, j)`

    
      da.slice = (a, start, end) => {
        return Array.prototype.slice.call(a, start, end);
      };
    
      test('slice', () => {
        da.assertEquals(da.slice([1,2,3]).length, 3);
        da.assertEquals(da.slice([1,2,3], 1)[1], 3);
        da.assertEquals(da.slice([1,2,3], 1 , 2).length, 1);
      });
    
### `buf2ascii(buf)`, `ascii2buf(str)`

    
      da.buf2ascii = (buf) =>
        Array.from(new Uint8Array(buf)).map(i => String.fromCharCode(i)).join('');
    
      test('buffer conversion', () => {
        da.assertEquals(da.buf2ascii(Uint8Array.from([104,105]).buffer), 'hi');
      });
    
### `equals(a,b)`

(deep equal for Object/Array, otherwise `.equals(..)` or direct comparison)

TODO handle cyclic structures (via weak-map)
TODO handle iterables
    
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
          return true;
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
      };
    
      test('equals', () => {
        da.assert(da.equals({a:[1,2],b:3},{b:3,a:[1,2]}));
        da.assert(!da.equals({a:['1',2],b:3},{b:3,a:[1,2]}));
        da.assertEquals({a:[1,2],b:3},{b:3,a:[1,2]});
      });
    
## Testing
    
      var testTimeout = 5000;
    
### `assert(bool)`
    
      da.assert = (ok) => ok || throwAssert({type: 'truthy', val: ok});
    
### `assertEquals(val1, val2)`
    
      da.assertEquals = (val1, val2) =>
        da.equals(val1, val2) || throwAssert({type: 'equals', vals: [val1, val2]});
    
### `testSuite(name)`

Sets the current test suite name
    
      var currentTestSuite;
      da.testSuite = testSuite;
      function testSuite(str) {
        currentTestSuite = str;
      }
      
### `test(name, fn)`
    
      var tests;
      da.test = test;
      function test(name, f) {
        if(currentTestSuite) {
          name = currentTestSuite + ':' + name;
        }
        f.testName = name;
        if(!tests) {
          tests = [];
        }
        tests.push(f);
      }
    
### `runTests(modules)`
    
      var errors;
      da.runTests = (modules) => {
        var ts = tests;
        if(modules) {
          if(!Array.isArray(modules)) {
            modules = [modules];
          }
          ts.filter(t => modules.some(m => t.testName.startsWith(m + ':')));
        }
        return Promise
          .all(tests.map(runTest))
          .then(e => {
            console.log('All tests ok:', tests.map(o => JSON.stringify(o.testName)).join(', '));
          });
      };
    
### Implementation details
    
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
    
        p = p.then(() => {
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
        return p;
      }
    
      /*
         test('must error 1', () => da.assert(false));
         test('must error 2', () => new Promise(() => da.assert(false)));
         test('must error 3', () => new Promise((reject, resolve) => {true;}));
         */
    
To get the call stack correct, to be able to report assert position, we throw an `Error` (which includes the stack on many browsers), and enrich it with more information.
    
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
    
## Module Setup / Main
    
      function setupModule() {
    
Define name of testsuite
    
        testSuite('direape');
    
    
Shims
    
        if(typeof self === 'undefined') {
          global.self = global;
        }
    
        if(!self.URL) {
          self.URL = self.webkitURL;
        }
    
Make sure are on https in browser,
otherwise crypto etc. wont work.
    
        if(isBrowser() &&
            self.location.protocol === 'http:' &&
            self.location.hostname !== 'localhost') {
          self.location.href = self.location.href.replace(/http/, 'https');
        }
    
Setup / export module
    
        da = self.direape || {};
    
        if(typeof module === 'undefined') {
          self.direape = da;
        } else {
          module.exports = da;
        }
      }
    
Initialisation, of the different parts of direape
    
      Promise
        .resolve(initPid())
        .then(initHandlers)
        .then(initWorker)
        .then(() => {
          for(var i = 0; i < waiting.length; ++i) {
            waiting[i]();
          }
          waiting = false;
        });
    
Main entry
    
      testSuite('');
      da.ready(() => {
        if(self.DIREAPE_RUN_TESTS) {
          da.runTests();
        }
    
        if(isNodeJs() && require.main === module) {
          if(process.argv.indexOf('test') !== -1) {
            da.runTests('direape')
              .then(o => {
                if(process.argv.indexOf('server') !== -1) {
                  da.startServer();
                } else {
                  process.exit(0);
                }
              }).catch(e => process.exit(-1));
          }
        }
      });
    })();
    
## License

This software is copyrighted solsort.com ApS, and available under GPLv3, as well as proprietary license upon request.

Versions older than 10 years also fall into the public domain.

