exports.jsonml2dom = function jsonml2dom(o) { 
  if(typeof o === 'string') {
    return document.createTextNode(o);
  } else if(typeof o === 'undefined') {
    return document.createTextNode('undefined');
  } else if(Array.isArray(o)) {
    var node = document.createElement(o[0]);
    var tagtype = o[0];
    var params = o[1];
    var firstChild;
    if(typeof params === 'object' && params.constructor === Object) {
      for(var k in params) {
        if(k === 'style') {
          Object.assign(node.style, params[k]);
        } else {
          node[k] = params[k];
        }
      }
      firstChild = 2;
    } else {
      params = {};
      firstChild = 1;
    }
    for(var i = firstChild; i < o.length; ++i) {
      node.appendChild(jsonml2dom(o[i]));
    }
    return node;
  } else {
    console.log('err', o, typeof o);
    throw 'unexpected type of parameter to jsonml2dom - ' + o;
  }
};

