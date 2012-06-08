
"use strict";

importScripts("image.js", "ifs.js");

var targetImage = null;

self.onmessage = function(msg) {
    var cmd = msg.data.cmd;
    
    switch (cmd) {
        case "init":
            targetImage = new Image(msg.data.image);
            break;
            
        case "eval":
            evaluate(new Ifs(msg.data.ifs));
            break;
            
        default: throw msg.data;
    }
}

function evaluate(ifs) {
    var img = emptyImage(targetImage.getWidth(), targetImage.getHeight());
    ifs.add(img, 1);
    
    var fit = img.similarity(targetImage);
    
    self.postMessage(new Evaluated(ifs.data, fit, img.data));
}
