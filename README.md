[![website](https://img.shields.io/badge/website-direape.solsort.com-blue.svg)](https://direape.solsort.com/)
[![github](https://img.shields.io/badge/github-solsort/direape-blue.svg)](https://github.com/solsort/direape)
[![travis](https://img.shields.io/travis/solsort/direape.svg)](https://travis-ci.org/solsort/direape)
[![npm](https://img.shields.io/npm/v/direape.svg)](https://www.npmjs.com/package/direape)


# <img src=https://direape.solsort.com/icon.png width=64 height=64> DireApe - Distributed Reactive App Environment

*Unstable - under development - do not use it yet*

DireApe is an JavaScript library for making distributed reactive apps. It delivers:

- message passing between processes
- a reactive world state

# Concepts

## Processes / message parsing

DireApe facilitates communication between processes. Every process has a globally unique id `pid` and a set of named mailboxes. It is possible to send messages to a given "mailbox `@` process id".

The current supported processes are the browser main thread, and webworkers. The intention is to also send messages across the network, and to nodejs/workers.

## Reactive state

The world state consist conceptually of an eventually consistent JSON-Object. The JSON-Object may also contain binary data, and is stored as an immmutable data structure, to allow fast diff'ing for reactive programming.
The keys on the first level are PIDs, and the values on the first level is the state within the process.


```JSON
{ "PID1234": {"some": "state", "belonging to": "the process"},
  "PID5678": {"some": "state", "belonging to": "another process"} }
```

It is possible to add reactive functions to the state, such that they are called when the state changes.

# Roadmap

- [x] core api functions
    - [x] `pid`: globally unique process id
    - [x] `handle(eventType, fn(state, data..) -> state, [opt])` opt may include whitelist(if emit across network) and callback later on.
    - [x] `dispatch(mbox, data..)` - async dispatch
    - [x] `dispatchSync(mbox, data..)` - synchronous dispatch - only local events
    - [x] `getIn(ks, defaultValue)`
    - [x] `reaction(name, fn())` - runs when state is changed
- [x] builtin event handlers
    - [x] `reun:execute(code, uri)`
    - [x] `direape:getIn([pid, ks...], mbox)`
    - [x] `direape:setIn([pid, ks...], value)`
    - [x] `direape:subscribe(path, event(path, data))`
    - [x] `direape:unsubscribe(path, event(..))`
- features
    - [ ] propagation of events between workers
    - [ ] global propagation between events
- events `"ns:type@PID"` object:
    - `dst` `pid:ns:type`
    - `src` `pid[:"callback":calback-id]`
    - `data` [...]
## License

This software is copyrighted solsort.com ApS, and available under GPLv3, as well as proprietary license upon request.

Versions older than 10 years also fall into the public domain.

