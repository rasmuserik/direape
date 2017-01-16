// # <img src=https://direape.solsort.com/icon.png width=64 height=64> DireApe - Distributed Reactive App Environment
//
// [![website](https://img.shields.io/badge/website-direape.solsort.com-blue.svg)](https://direape.solsort.com/)
// [![github](https://img.shields.io/badge/github-solsort/direape-blue.svg)](https://github.com/solsort/direape)
// [![travis](https://img.shields.io/travis/solsort/direape.svg)](https://travis-ci.org/solsort/direape)
// [![npm](https://img.shields.io/npm/v/direape.svg)](https://www.npmjs.com/package/direape)
// 
// *Unstable - under development - do not use it yet*
// 
// DireApe is an JavaScript library for making distributed reactive apps. It delivers:
// 
// - message passing between processes
// - a reactive world state
// 
// # Concepts
// 
// ## Processes / message parsing
// 
// DireApe facilitates communication between processes. Every process has a globally unique id `pid` and a set of named mailboxes. It is possible to send messages to a given "mailbox `@` process id".
// 
// The current supported processes are the browser main thread, and webworkers. The intention is to also send messages across the network, and to nodejs/workers.
// 
// ## Reactive state
// 
// The world state consist conceptually of an eventually consistent JSON-Object. The JSON-Object may also contain binary data, and is stored as an immmutable data structure, to allow fast diff'ing for reactive programming.
// The keys on the first level are PIDs, and the values on the first level is the state within the process.
// 
// 
// ```JSON
// { "PID1234": {"some": "state", "belonging to": "the process"},
//   "PID5678": {"some": "state", "belonging to": "another process"} }
// ```
// 
// It is possible to add reactive functions to the state, such that they are called when the state changes.
// 
// # Public API
//
// In the process of being redesigned/implemented, not done yet.
//
// ## Process / messages
//
// - [ ] `da.pid` is the unique id of the current process
// - [ ] `da.parent` the pid of the parent process, and is assigned when created as a child process.
// - [ ] `da.call(pid, name, ...parameters) => promise` executes a named handle in a process
// - [ ] `da.run(pid, name, ...parameters)` executes a named handle in process, and discards the result.
//
// ## Defining handlers/reactions
//
// - [ ] `da.handle("name", (...parameters) => promise)` adds a new event handler. When `name` is run/called, the function is executed, the new state replaces the old state, and the return/reject of the promise is returned.
// - [ ] `da.reaction(name, () => promise)` - adds a reactive handle, that is executed when the `name` is emitted, or the accessed parts of the state has changed.
//
// ## Accessing the application state
//
// - [x] `da.setJs([...keys], value)` sets a value, - only allowed to be called synchronously within a handler/reaction, to avoid race-conditions
// - [x] `da.getJs([...keys], defaultVale) => value`
//
// Immutable value is publicly available yet, to avoid to expose immutable data structure implementation. TODO: maybe extend the api to make immutable value available. For example like `da.getIn([...keys], defaultVale) => Immutable`
// 
// ## Creating / killing children
//
// - [ ] `da.children()` list of live child processes
// - [ ] `da.spawn(code) => promise` spawn a new process, execute the passed javascript, and return its pid as a promise
// - [ ] `da.kill(pid)` kill a child process
//
// ## Handle
//
// - [ ] `da:getIn(path) -> value` 
// - [ ] `da:subscribe(path, handlerName)` - call `da.run(da.pid, handlerName, path, value)` on changes
// - [ ] `da:unsubscribe(path, handlerName)`
//
// # Features backlog
//
// - [ ] Implement API above
// - [ ] Description/implementation of event execution
//
// # Utility functions

function randomString() {
  return Math.random().toString(32).slice(2);
}
function nextTick(f) {
  setTimeout(f, 0);
}
function slice(a, start, end) {
  return Array.prototype.slice.call(a, start, end);
}


// # Literate code
//
// Should probably be replaced with better general module
//

var immutable = require('immutable');
var state = new immutable.Map();
var da = exports;

function setJs(o, path, value) {
  if(path.length) {
    var key = path[0];
    var rest = path.slice(1);
    if(!o) {
      if(typeof key === 'number') {
        o = new immutable.List();
      } else {
        o = new immutable.Map();
      }
    }
    return o.set(key, setJs(o.get(path[0]), path.slice(1), value));
  } else {
    return immutable.fromJS(value);
  }
}

da.setJs = (path, value) => { state = setJs(state, path, value); };
da.getJs = (path, defaultValue) => {
  var result = state.getIn(path);
  return result.toJS ? result.toJS() : 
    (result === undefined ? defaultValue : result);
}

da.main = () => {
  da.setJs(['hello', 1, 'world'], "hi");
  console.log('here', da.getJs(['hello']));
}

/*
var direape = exports;
var immutable = require('immutable');

// # Internal methods
var pid = "PID" + randomString();
var msg = function(pid, mbox) {
  return {dst: `${mbox}@${pid}`, data: slice(arguments, 2)};
}
var state = new immutable.Map();
var prevState = state;
var handlers = {};
var messageQueue = [];
var scheduled = false;
var reactions = {};
var transports = {};
transports[pid] = o => {
  var mbox = o.dst.slice(0, o.dst.lastIndexOf('@'));
  if(handlers[mbox]) {
    state = handlers[mbox].apply(o, [state].concat(o.data)) || state;
  } else {
    console.log('missing handler for ', pid.length, o, mbox);
  }
}
transports['*'] = o => self.postMessage(o);
self.onmessage = o => {
  //console.log('onmessage', o)
  _dispatch(o.data);
}
function _dispatch(o) {
  messageQueue.push(o);
  _dispatchAll(); 
};
function _dispatchSync(o) {
  //console.log(pid.slice(0,7), o);
  o.dst = (o.dst || '').includes('@') ? o.dst : o.dst + '@' + pid;
  var f = transports[o.dst.slice(o.dst.lastIndexOf('@') + 1)];
  (f || transports['*'])(o);
}

function _dispatchAll() {
  if(scheduled) {
    return;
  }
  scheduled = true;
  nextTick(function() {
    scheduled = false;
    var messages = messageQueue;
    messageQueue = [];
    for(var i = 0; i < messages.length; ++i) {
      try {
        _dispatchSync(messages[i])
      } catch(e) {
        console.log('error during dispatch:', e);
      }
    }

    if(!prevState.equals(state)) {
      //console.log('reaction needed');  
      for(var k in reactions) {
        try {
          reactions[k]();
        } catch(e) {
          console.log('error during reaction:', e);
        }
      }
      prevState = state;
    } else {
      //console.log('reaction unneeded');  
    }
  });
}

// # Add worker

var baseUrl = self.location ? self.location.href : './';
var workerSourceUrl;
var workers = {};
function spawn() {
  return new Promise((resolve, reject) => {
  if(!workerSourceUrl) {
    workerSourceUrl = 
      (self.URL || self.webkitURL).createObjectURL(new Blob([`
          importScripts('https://unpkg.com/reun');
          reun.require('direape').then(da => {
            self.postMessage(da.pid);
          });
          `], {type:'application/javascript'}));
  }
  var worker = new Worker(workerSourceUrl);
  worker.onmessage = o => {
    var pid = o.data;
    worker.onmessage = o => _dispatch(o.data);
    workers[pid] = worker;
    transports[pid] = o => worker.postMessage(o);
    resolve(pid);
  }
  });
}

function kill(pid) {
  workers[pid].terminate();
  delete workers[pid];
  delete transports[pid];
}

// # API
direape.pid = pid;
direape._transports = transports;
direape.handle = (eventType, f) => { handlers[eventType] = f; }
direape.dispatch = _dispatch;
direape.dispatchSync = (o) => { _dispatchSync(o); _dispatchAll(); };
direape.getIn = (ks, defaultValue) => state.getIn(ks, defaultValue);
direape.reaction = (name, f) => { reactions[name] = f; }
direape.spawn = spawn;
direape.kill = kill;
direape.msg = msg;

// # Built-in event handlers
direape.handle('reun:run', (state, code, uri) => {
  require('reun').run(code, uri);
});
direape.handle('direape:getIn', (state, ks, mbox) => {
  direape.dispatch({dst: mbox, data: [direape.getIn(ks)]});
});
direape.handle('direape:setIn', (state, ks, value) => state.setIn(ks,value)); 

var subscriptions = new Set();
direape.handle('direape:subscribe', function(state, path, dst) {
  subscriptions.add([path, dst]);
});
direape.handle('direape:unsubscribe', function(state, path, dst) {
  subscriptions.delete([path, dst]);
});
direape.reaction('direape:subscriptions', function() {
  for(var v of subscriptions) {
    direape.dispatch({dst: v[1], data:[direape.getIn(v[0])]});
  }
});

direape.main = () => {
  var child;
  var da = direape;
  spawn().then(child => {
    console.log(child);
    da.dispatch(msg(child, 'reun:run', 
          'console.log("hallo" + require("direape").pid);', "" + location.href));
    da.dispatch(msg(direape.pid, 'reun:run', 
          'console.log("hallo" + require("direape").pid);', "" + location.href));
  });
  console.log('main');
}
*/

// # License
// 
// This software is copyrighted solsort.com ApS, and available under GPLv3, as well as proprietary license upon request.
// 
// Versions older than 10 years also fall into the public domain.
// 
// # Future ideas
//
// - Make the library truely functional, ie. `da` will be a monadic state which also implements being a promise.
// - Add API for creating a cached reactive function.
