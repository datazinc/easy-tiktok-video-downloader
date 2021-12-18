
var jscript = document.createElement('script');
var csscript = document.createElement('link');
jscript.src = chrome.runtime.getURL('injex.js');
csscript.href = chrome.runtime.getURL('injex.css');
csscript.onload = function () {
    this.remove();
};
csscript.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(jscript);
(document.head || document.documentElement).appendChild(csscript);
