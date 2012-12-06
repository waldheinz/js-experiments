
"use strict";

importScripts("image.js", "ifs.js");

var ifs = null;
var image = null;
var pass = 0;
var div = 1;

self.onmessage = function(msg) {
    var cmd = msg.data.cmd;
    
    switch (cmd) {
        case "init":
            ifs = new Ifs(msg.data.ifs);
            image = emptyImage(msg.data.width, msg.data.height);
            div  = image.getWidth() * image.getHeight() / 50000;
            pass = 0;
            progress();
            
        case "pass":
            pass++;
            ifs.add(image, div);
            image.setScale(1 / pass);
            progress();
            break;
            
        default:throw msg.data;
    }
}

function progress() {
    self.postMessage(image.data);
}
