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
// - [x] `da.pid` is the unique id of the current process
// - [x] `da.parent` the pid of the parent process, and is assigned when created as a child process.
// - [x] `da.call(pid, name, ...parameters) => promise` executes a named handle in a process
// - [x] `da.run(pid, name, ...parameters)` executes a named handle in process, and discards the result.
//
// ## Defining handlers/reactions
//
// - [x] `da.handle("name", (...parameters) => promise)` adds a new event handler. When `name` is run/called, the function is executed, the new state replaces the old state, and the return/reject of the promise is returned.
// - [x] `da.reaction(name, () => promise)` - adds a reactive handle, that is executed when the `name` is emitted, or the accessed parts of the state has changed.
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
// - [x] `da.children()` list of live child processes
// - [x] `da.spawn(code) => promise` spawn a new process, execute the passed javascript, and return its pid as a promise
// - [x] `da.kill(pid)` kill a child process
//
// ## Handlers
//
// - [x] `reun:run(src, base) ` 
// - [x] `da:getIn(path) -> value` 
// - [x] `da:setIn(path, value)` 
// - [ ] `da:subscribe(path, handlerName)` - call `da.run(da.pid, handlerName, path, value)` on changes
// - [ ] `da:unsubscribe(path, handlerName)`
//
// # API implementation
//
var immutable = require('immutable');
var state = new immutable.Map();
var prevState = state;
var da = exports;
var handlers = {};
var reactions = {};

// ## Process / messages

da.pid = 'PID' + randomString();
/* TODO: emit pid to parent */

self.onmessage = o => {
  da.parent = o.data;
  self.onmessage = o => send(o.data);
}

da.run = function(pid, name) {
  var params = slice(arguments, 2);
  send({dstPid: pid, dstName: name, params: params});
}

da.call = function(pid, name) {
  var params = slice(arguments, 2);
  return new Promise((resolve, reject) => {
    send({dstPid: pid, dstName: name, 
      srcPid: da.pid,
      srcName: callbackHandler((val, err) => err ? reject(err) : resolve(val)),
      params: params})});
}


function callbackHandler(f) {
  var id = 'callback:' + randomString();
  handlers[id] = function() {
    delete handlers[id];
    return f.apply(null, slice(arguments));
  }
  return id;
}

// ## Handlers/reactions
//
da.handle = (name, f) => {
  handlers[name] = f;
};

function makeReaction(name, f) {
  reactions[name] = true;
  var reaction = function() {
    if(handlers[name] !== reaction) {
      delete reactions[name];
    } else {
      return f();
    }
  }
  return reaction;
}
da.reaction = (name, f) => {
  handlers[name] = makeReaction(name, f);
  return Promise.resolve(handlers[name]());
}

// ## Accessing the application state

function setJs(o, path, value) {
  /* TODO: check that we are in handler, or else throw */
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
da.setJs = (path, value) => { 
  state = setJs(state, path, value); 
  reschedule();
};

da.getJs = (path, defaultValue) => {
  var result = state.getIn(path);
  return result === undefined ? defaultValue :
    (result.toJS ? result.toJS() : result);
};

// ## Creating / killing children

var baseUrl = self.location ? self.location.href : './';
var workerSourceUrl;
var children = {};
da.spawn = () => new Promise((resolve, reject) => {
  /* TODO: execute src */
  if(!workerSourceUrl) {
    workerSourceUrl = 
      (self.URL || self.webkitURL).createObjectURL(new Blob([
          "importScripts('https://unpkg.com/reun');" +
          "reun.require('http://localhost:8080/main.js').then(da => {" +
          " self.postMessage(da.pid);" +
          "});"
          ], {type:'application/javascript'}));
  }
  var child = new Worker(workerSourceUrl);
  child.onmessage = o => {
    var pid = o.data;
    children[pid] = child;
    child.postMessage(da.pid);
    child.onmessage = o => send(o.data);
    resolve(pid);
  }
});

da.kill = (pid) => {
  children[pid].terminate();
  delete children[pid];
};

da.children = () => Object.keys(children);


// ## Handlers
//
da.handle('reun:run', (a,b) => reun.run(a,b).then(o=>{}));
/*TODO: make reun:run result serialisable*/
da.handle('da:setIn', da.setJs);
da.handle('da:getIn', da.getJs);

// # Event loop
//
var messageQueue = [];
var scheduled = false;

function reschedule() {
  if(!scheduled) {
    nextTick(handleMessages);
    scheduled = true;
  }
}
function send(msg) {
  if(msg.dstPid === da.pid) {
    messageQueue.push(msg);
    reschedule();
  } else if(children[msg.dstPid]) {
    console.log('a');
    children[msg.dstPid].postMessage(msg);
  } else {
    console.log('b', msg, da.pid, children);
    self.postMessage(msg);
    console.log('c');
  }
}

function sendResponse(msg, params) {
  if(msg.srcPid) {
    send({dstPid: msg.srcPid, dstName: msg.srcName, params: params});
  }
}
function handleMessages() {
  scheduled = false;
  if(messageQueue.length) {
    var messages = messageQueue;
    messageQueue = [];
    messages.forEach(msg => {
      try {
        Promise.resolve(handlers[msg.dstName].apply(null, msg.params))
          .then(o => sendResponse(msg, [o]), 
              e => sendResponse(msg, [null, errorToJson(e)]));
      } catch(e) {
        sendResponse(msg, [null, errorToJson(e)]);
      }
    });
  }
  if(!prevState.equals(state)) {
    /* TODO: only run reactions where used parts of state had been changed */
    Object.keys(reactions).forEach(name => send({dstPid: da.pid, dstName: name}));
    prevState = state;
  }
}

// # Utility functions

// ## Generic
function errorToJson(e) {
  /* TODO: better json representation of error, including stack trace*/
  return {error: e};
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

// # Main / test
da.main = () => {
  console.log('running', da.pid);

  da.reaction('blah', () => {
    console.log('blah', da.getJs(['blah']));
  });

  da.setJs(['blah', 1, 'world'], "hi");
  console.log('here', da.getJs(['blah']));

  da.handle('hello', (t) => {
   da.setJs(['blah'], '123');
    console.log('hello', t);
   return 'hello' + t;
  });
  da.run(da.pid, 'hello', 'world');
  da.call(da.pid, 'hello', 'to you').then(o => console.log(o));
  da.call(da.pid, 'hello', 'to me').then(o => console.log(o));
  da.setJs(['hi'], 'thread-1');
  da.spawn().then(child =>
      da.call(child, 'reun:run', 'require("./main.js").setJs(["hi"], "here");', 'http://localhost:8080/')
      .then(() => 
        da.call(child, 'da:getIn', ['hi'], 123).then(o =>
        console.log('call-result', o))
      )
      .then(() => 
        da.call(da.pid, 'da:getIn', ['hi'], 432).then(o =>
        console.log('call-result', o))
      )
  );
  console.log(Object.keys(da));
};

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
