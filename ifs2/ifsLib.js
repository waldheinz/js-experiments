
/*
 * image functions
 */

function Image(w, h, pixels) {
    this.width = w;
    this.height = h;
    
    if (!pixels) {
        this.pixels = new Float32Array(w * h);
    } else {
        this.pixels = pixels;
    }
    
    this.paint = function(canvas) {
        canvas.width = this.width;
        canvas.height = this.height;
        var w = this.width;
        var h = this.height;
        
        var ctx = canvas.getContext("2d");
        var cd = ctx.createImageData(this.width, this.height);
        var cdd = cd.data;
        
        for (var y=0; y < h; y++) {
            var off = y * w;
                    
            for (var x=0; x < w; x++) {
                var idx = off + x;
                var d = this.pixels[idx];
                var coff = (y * w + x) * 4;
                
                cdd[coff + 0] = d * 255;
                cdd[coff + 1] = d * 255;
                cdd[coff + 2] = d * 255;
                cdd[coff + 3] = 255;
            }
        }
        
        ctx.putImageData(cd, 0, 0);
    }
    
    this.difference = function(img) {
        var w = this.width;
        var h = this.height;
                
        var diff = 0;
                
        for (var y=0; y < h; y++) {
            var off = y * w;
                    
            for (var x=0; x < w; x++) {
                var idx = off + x;
                var d = this.pixels[idx] - img.pixels[idx];
                diff += (d*d);
            }
        }
        
        return (diff / (w * h));
    }
    
    this.serialize = function() {
        var result = "";
        
        result += this.width;
        result += ",";
        result += this.height;
        result += ",";
        
        for (var i=0; i < this.width * this.height; i++) {
            result += this.pixels[i];
            
            if (i < (this.width * this.height) - 1) {
                result += ",";
            }
        }
        
        return result;
    }
}

function parseImage(imgString) {
    var parts = imgString.split(",");
    var w = parts[0];
    var h = parts[1];
    
    var pixels = new Float32Array(w*h);
    
    parts = parts.slice(2);
    for (var i=0; i < w*h; i++) {
        pixels[i] = parts[i];
    }
    
    return new Image(w, h, pixels);
}

/* convert a canvas to the internal image representation */
function canvasToImage(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var d = ctx.getImageData(0, 0, w, h).data;
    var pixels = new Array();
    
    for (var y=0; y < h; y++) {
        var off = y * w * 4;
        
        for (var x=0; x < w; x++) {
            var idx = off + x * 4;
            var r = d[idx + 0];
            var g = d[idx + 1];
            var b = d[idx + 2];
            
            var gray = (r * 0.2989 + g * 0.5870 + b * 0.1140) / 255.0;
            pixels.push(gray);
        }
    }
    
    return new Image(w, h, pixels);
}


/*
 * ifs functions
 */

var COEFF_COUNT = 12;

function Ifs(funcs) {
    this.funcs = funcs;
    
    this.crossover = function(other) {
        var newFuncs = new Array();
        
        for (var i=0; i < this.funcs.length; i++) {
            if (Math.random() < 0.5) {
                newFuncs.push(new Array().concat(this.funcs[i]));
            } else {
                newFuncs.push(new Array().concat(other.funcs[i]));
            }
        }
        
        return new Ifs(newFuncs);
    }
    
    this.mutate = function(delta) {
        var d2 = delta / 5;
        if (Math.random < d2) {
            this.incr += (Math.random() - 0.5) * delta;
        }
        
        for (var func=0; func < this.funcs.length; func++) {
            var f = this.funcs[func];
            
            for (var c=0; c < f.length; c++) {
                if (Math.random() < d2) {
                    f[c] += (Math.random() - 0.5) * delta;
                }
            }
        }
    }
    
    this.clone = function() {
        return parseIfs(this.serialize());
    }
    
    this.serialize = function() {
        var result = "";
        
        result += this.funcs.length;
        result += ",";
        
        for (var func=0; func < this.funcs.length; func++) {
            var f = this.funcs[func];
            
            for (var coeff=0; coeff < f.length; coeff++) {
                result += f[coeff];
                result += ",";
            }
        }
        
        return result;
    }
    
    this.draw = function(image) {
        /* reset image to black */
        var data = new Float32Array(image.width * image.height);
        image.pixels = data;
        this.add(image, 1, 1);
    }
    
    this.add = function(image, scale, itDiv) {
        var w = image.width;
        var h = image.height;         
        var dx = w / 2;
        var dy = h / 2;
        
        var data = image.pixels;
        
        var x = 0;
        var y = 0;
        var c = 0;
        var iterations = (w * h * this.funcs.length) / itDiv;
        scale = scale / this.funcs.length;
        for (i=0; i < iterations; i++) {
            var fidx = Math.floor(Math.random() * this.funcs.length);
            var func = this.funcs[fidx];
            
            var tx = func[0] * x + func[1] * y + func[2] * c + func[3];
            var ty = func[4] * x + func[5] * y + func[6] * c + func[7];
            c      = func[8] * x + func[9] * y + func[10] * c + func[11];
            x = tx;
            y = ty;
            if (i < 100) continue;
            
            var px = Math.floor(x * w + dx);
            var py = Math.floor(y * h + dy);

            if (px >= 0 && px < w && py >= 0 && py < h) {
                var off = (px + py * w);
                data[off] += c * scale;
            }
        }
    }
}

function parseIfs(ifsString) {
    var parts = ifsString.split(",");
    var funcCount = parts[0];
    parts = parts.slice(1);
    
    var funcs = new Array();
    
    for (var i=0; i < funcCount; i++) {
        if (parts.length < COEFF_COUNT) {
            throw "error parsing ifs";
        }
        
        funcs.push(parts.slice(0, COEFF_COUNT));
        
        for (var f=0; f < COEFF_COUNT; f++) {
            funcs[i][f] = parseFloat(funcs[i][f]);
        }
        
        parts = parts.slice(COEFF_COUNT);
    }
    
    return new Ifs(funcs);
}

function randomIfs(fCount) {
    var ifs = Array();
    var s = 0.10 * Math.sqrt(fCount);

    for (var i=0; i < fCount; i++) {
        var func = Array();
        
        for (var j=0; j < COEFF_COUNT; j++) {
            func.push((Math.random() - 0.5) * s);
        }
        
        ifs.push(func);
    }
    
    return new Ifs(ifs);
}

/*
 * worker communication
 */

function setTarget(worker, image) {
    worker.postMessage("setTarget " + image.serialize());
}

function setBase(worker, ifs) {
    worker.postMessage("setBase " + ifs.serialize());
}

function startWorker(worker) {
    worker.postMessage("start");
}
