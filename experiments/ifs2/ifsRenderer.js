
/*
 * for doing HQ renderings
 */

importScripts("ifsLib.js");

var image = null;
var ifs = null;

self.onmessage = function(e) {
    var parts = e.data.split(" ", 2);
    var command = parts[0];
    var param = parts[1];
    
    switch (command) {
        case "doRender":
            doRender(param);
            break;
        
        case "setSize":
            var dim = param.split("x");
            image = new Image(dim[0], dim[1]);
            log("set image size to " + dim[0] + "x" + dim[1]);
            break;
            
        case "setIfs":
            ifs = parseIfs(param);
            log("got new ifs");
            break;
            
        default:
            log("unknown command \"" + e.data + "\"");
    }
}

function doRender(iterations) {
    self.postMessage("renderStarted");
    
    for (var pass=0; pass < iterations; pass++) {
        ifs.add(image, iterations);
        reportPassDone(image);
        reportProgress((100 * (pass+1)) / iterations);
    }
    
    image.clamp();
    reportPassDone(image);
    self.postMessage("renderDone");
}

function reportProgress(percent) {
    self.postMessage("progress " + percent);
}

function reportPassDone(img) {
    self.postMessage("passDone " + img.serialize());
}

function log(message) {
    self.postMessage("log " + message);
}
