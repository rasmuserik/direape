importScripts(['https://unpkg.com/reun']);
self.reun.require('direape').then(da => self.postMessage(da.pid));
