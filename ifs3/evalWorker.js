
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
            
        case "metro":
            doMetropolis(msg.data);
            break;
            
        default:throw msg.data;
    }
}

function doMetropolis(data) {
    var index = data.index;
    var oldFitness = data.fit;
    var oldIfs = new Ifs(data.ifs);
    var mutIfs = oldIfs.clone();
    mutIfs.mutate(1 - (oldFitness / 100));
    
    var img = emptyImage(targetImage.getWidth(), targetImage.getHeight());
    mutIfs.add(img, 1);
    var mutFitness = img.similarity(targetImage);
    
    if (mutFitness > oldFitness) {
        /* accept */
        
        self.postMessage({
            'result'    : 'metroAccept',
            'index'     : index,
            'p'         : -1,
            'eval'      : new Evaluated(mutIfs.data, mutFitness, img.data)
        });
    } else {
        var de = (oldFitness - mutFitness) / 100;
        var p = Math.min(1, Math.exp(-de * 1000));
        
//        throw "de=" + de + ", p=" + p;
        
        if (p > Math.random()) {
            self.postMessage({
                'result'    : 'metroAccept',
                'index'     : index,
                'p'         : p,
                'eval'      : new Evaluated(mutIfs.data, mutFitness, img.data)
            });
        } else {
            self.postMessage({'result' : 'metroReject'});
        }
        
    }
}

function evaluate(ifs) {
    var img = emptyImage(targetImage.getWidth(), targetImage.getHeight());
    ifs.add(img, 1);
    
    var fit = img.similarity(targetImage);
    
    self.postMessage({
        'result'    : 'evalDone',
        'eval'      : new Evaluated(ifs.data, fit, img.data)
    });
}
