
"use strict";

function Image(data) {
    this.data = data;
    this.header = new Uint16Array(this.data, 0, 2);
    this.scale = new Float32Array(this.data, 4, 1);
    this.pixels = new Float32Array(
            this.data, 8, this.getWidth() * this.getHeight());
}

function emptyImage(width, height) {
    var data = new ArrayBuffer(8 + (width * height * 4));
    var header = new Uint16Array(data, 0, 2);
    header[0] = width;
    header[1] = height;
    
    var scale = new Float32Array(data, 4, 1);
    scale[0] = 1;
    
    return new Image(data);
}

Image.prototype.getWidth = function() {
    return this.header[0];
}

Image.prototype.getHeight = function() {
    return this.header[1];
}

Image.prototype.getScale = function() {
    return this.scale[0];
}

Image.prototype.setScale = function(scale) {
    this.scale[0] = scale;
}

Image.prototype.paint = function(canvas) {
//    this.clamp();
    var w = this.getWidth();
    var h = this.getHeight();
    
    canvas.width = w;
    canvas.height = h;
    
    var ctx = canvas.getContext("2d");
    var cd = ctx.createImageData(w, h);
    var cdd = cd.data;
    var scale = this.getScale();
    
    for (var y=0; y < h; y++) {
        var off = y * w;
        
        for (var x=0; x < w; x++) {
            var d = this.pixels[off + x];
            var coff = (off + x) * 4;
            
            cdd[coff + 0] = d * 255 * scale;
            cdd[coff + 1] = d * 255 * scale;
            cdd[coff + 2] = d * 255 * scale;
            cdd[coff + 3] = 255;
        }
    }
    
    ctx.putImageData(cd, 0, 0);
}

Image.prototype.similarity = function(img) {
    var w = this.getWidth();
    var h = this.getHeight();
    
    var diff = 0;
    
    for (var y=0; y < h; y++) {
        var off = y * w;
        
        for (var x=0; x < w; x++) {
            var idx = off + x;
            var d = this.pixels[idx] - img.pixels[idx];
            diff += d * d;
        }
    }

    var maxDiff = w * h;
    return (1 - (diff / maxDiff)) * 100;
}

function imageFromDocument(image) {
    
    var w = image.width;
    var h = image.height;
    
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    
    ctx.drawImage(image, 0, 0, w, h);
    
    var d = ctx.getImageData(0, 0, w, h).data;
    var result = emptyImage(w, h);
    var pixels = result.pixels;
    var pidx = 0;
    for (var y=0; y < h; y++) {
        var off = y * w * 4;
        
        for (var x=0; x < w; x++) {
            var idx = off + x * 4;
            var r = d[idx + 0];
            var g = d[idx + 1];
            var b = d[idx + 2];
            
            var gray = (r * 0.2989 + g * 0.5870 + b * 0.1140) / 255.0;
            pixels[pidx++] = gray;
        }
    }
    
    return result;
}
