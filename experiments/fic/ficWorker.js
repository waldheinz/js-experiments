
importScripts("imgLib.js", "fic.js", "../js/json2.js");

var image = null;
var domainSize = null;
var destWidth = 128, destHeight = 128;

self.onmessage = function(e) {
    var parts = e.data.split(" ");
    var command = parts[0];
    var param = parts[1];
    
    switch (command) {
        case "setImage":
            image = parseImage(param);
            log("got new target");
            break;
            
        case "setDomainSize":
            domainSize = param;
            log("set domain size to 2^" + domainSize);
            break;
            
        case "setTargetSize":
            destWidth = parts[1];
            destHeight = parts[2];
            log("set target size to " + destWidth + "x" + destHeight);
            break;
            
        case "decodeImage":
            var imgData = JSON.parse(parts[1]);
            doDecompress(imgData);
            break;
            
        case "start":
            log("starting compression");
            
            try {
                doCompress();
            } catch (ex) {
                log("FAILED: " + ex);
            }
            
            break;
            
        default:
            log("unknown command \"" + command + "\"");
    }
}

function doDecompress(imgData) {
    log("starting decompression");
    
    var img = new Image(destWidth, destHeight);
    self.postMessage("decodeProgress " + img.serialize());
    var dec = new Decoder(imgData, img);
    var passes = 10;
    for (var pass=0; pass < passes; pass++) {
        dec.onePass();
        log("decoded pass " + (pass+1) + " of " + passes);
        self.postMessage("decodeProgress " + img.serialize());
    }
    
    self.postMessage("decodeDone");
}

function doCompress() {
    var enc = new Encoder(image, domainSize, {
        onmessage : function(message) {
            log(message);
        },
        
        onprogress : function(current, total) {
            self.postMessage("progress " + current + " " + total);
        },
        
        onImageProgress : function(data) {
            self.postMessage("imageProgress " + JSON.stringify(data));
        }
    });
    
    var result = enc.encode();
    log("compression done");
    
    self.postMessage("result " + JSON.stringify(result));
}

function log(message) {
    self.postMessage("log " + message);
}
