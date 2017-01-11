var immutable = require('immutable');
var direape = exports;

// # Generic utility functions
//
// Should probably be replaced with better general module
//
function randomString() {
  return Math.random().toString(32).slice(2);
}
function nextTick(f) {
  setTimeout(f, 0);
}
function slice(a, start, end) {
  return Array.prototype.slice.call(a, start, end);
}
function warn() {
  console.log.apply(console, ['warn'].concat(slice(arguments)));
}

// # Internal methods
var pid = "PID" + randomString();
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
    warn('missing handler for ', pid.length, o, mbox);
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
        warn('error during dispatch:', e);
      }
    }

    if(!prevState.equals(state)) {
      //console.log('reaction needed');  
      for(var k in reactions) {
        try {
          reactions[k]();
        } catch(e) {
          warn('error during reaction:', e);
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
            self.postMessage(da.exports.pid);
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

// # Built-in event handlers
direape.handle('reun.run', (state, code, uri) => {
  require('reun').run(code, uri);
});
direape.handle('direape.getIn', (state, ks, mbox) => {
  direape.dispatch({dst: mbox, data: [direape.getIn(ks)]});
});
direape.handle('direape.setIn', (state, ks, value) => state.setIn(ks,value)); 

var subscriptions = new Set();
direape.handle('direape.subscribe', function(state, path, dst) {
  subscriptions.add([path, dst]);
});
direape.handle('direape.unsubscribe', function(state, path, dst) {
  subscriptions.delete([path, dst]);
});
direape.reaction('direape.subscriptions', function() {
  for(var v of subscriptions) {
    direape.dispatch({dst: v[1], data:[direape.getIn(v[0])]});
  }
});
