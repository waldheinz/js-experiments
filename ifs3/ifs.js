
"use strict";

var COEFF_COUNT = 12;

function Ifs(data) {
    this.data = data;
    this.header = new Uint16Array(this.data, 0, 1);
    this.funcs = new Array();
    
    for (var i=0; i < this.getFunctionCount(); i++) {
        this.funcs.push(new Float32Array(
                this.data, 4 + COEFF_COUNT * i * 4, COEFF_COUNT));
    }
}

Ifs.prototype.getFunctionCount = function() {
    return this.header[0];
}

function randomIfs(fCount) {
    var data = new ArrayBuffer(4 + (COEFF_COUNT * 4 * fCount));
    var header = new Uint16Array(data, 0, 1);
    header[0] = fCount;
    
    var fdata = new Float32Array(data, 4, COEFF_COUNT * fCount);
    
    for (var i=0; i < fdata.length; i++) {
        fdata[i] = (Math.random() - 0.5);
    }
    
    return new Ifs(data);
}

Ifs.prototype.clone = function() {
    return new Ifs(this.data.slice(0));
}

Ifs.prototype.mutate = function(delta) {
    var d2 = delta / 5;
    
    for (var func=0; func < this.funcs.length; func++) {
        var f = this.funcs[func];
        
        if (Math.random() < (delta / 10)) {
            for (var c=0; c < f.length; c++) {
                f[c] = (Math.random() - 0.5) * 0.8;
            }
        } else {
            for (c=0; c < f.length; c++) {
                if (Math.random() < d2) {
                    f[c] += (Math.random() - 0.5) * delta;
                }
            }
        }
    }
    
}

Ifs.prototype.crossover = function(other) {
    var fCount = this.funcs.length;
    var newData = new ArrayBuffer(4 + (COEFF_COUNT * 4 * fCount));
    var header = new Uint16Array(newData, 0, 1);
    header[0] = this.funcs.length;
    
    var mf = new Float32Array(this.data, 4, COEFF_COUNT * fCount);
    var of = new Float32Array(other.data, 4, COEFF_COUNT * fCount);
    var newf = new Float32Array(newData, 4, COEFF_COUNT * fCount);
    
    for (var i=0; i < this.funcs.length; i++) {
        var off = COEFF_COUNT * i;
        
        if (Math.random() < 0.5) {
            for (var j=0; j < COEFF_COUNT; j++) {
                newf[off + j] = mf[off + j];
            }
        } else {
            for (j=0; j < COEFF_COUNT; j++) {
                newf[off + j] = of[off + j];
            }
        }
    }
    
    return new Ifs(newData);
}

Ifs.prototype.add = function(image, itDiv) {
    var w = image.getWidth();
    var h = image.getHeight();         
    var dx = w / 2;
    var dy = h / 2;
    
    var data = image.pixels;
    
    var x = 0;
    var y = 0;
    var c = 0;
    var q = this.getFunctionCount() * 4;
    var iterations = w * h * q;
    var ignored = iterations / 100;
    var scale = 1 / q;
    
    for (var i=0; i < iterations; i++) {
        var fidx = Math.floor(Math.random() * this.funcs.length);
        var func = this.funcs[fidx];
        
        var tx = func[0] * x + func[1] * y + func[2] * c + func[3];
        var ty = func[4] * x + func[5] * y + func[6] * c + func[7];
        c      = func[8] * x + func[9] * y + func[10] * c + func[11];
        x = tx;
        y = ty;
        if (i < ignored) continue;
        
        var px = Math.floor(x * w + dx);
        var py = Math.floor(y * h + dy);

        if (px >= 0 && px < w && py >= 0 && py < h) {
            data[px + py * w] += c * scale;
        }
    }
}

function Evaluated(ifs, fitness, image) {
    this.ifs = ifs;
    this.fitness = fitness;
    this.image = image;
}
