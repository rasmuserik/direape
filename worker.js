importScripts(['https://unpkg.com/reun']);
reun.require('direape').then(da => self.postMessage(da.pid));
