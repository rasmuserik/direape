importScripts(['https://unpkg.com/reun']);
self.reun.require('direape@0.1').then(da => self.postMessage(da.pid));
