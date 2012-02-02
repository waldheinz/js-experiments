
/*
 * color
 */

function Color(red, green, blue) {
    this.red = red;
    this.green = green;
    this.blue = blue;
}


function Range(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    
    this.split = function(p) {
        var nw = this.w / 2;
        var nh = this.h / 2;
        
        switch (p) {
            case 0: /* top left */
                return new Range(this.x, this.y, nw, nh);
                    
            case 1: /* top right */
                return new Range(this.x + nw, this.y, nw, nh);
                    
            case 2: /* bottom left */
                return new Range(this.x, this.y + nh, nw, nh);
                    
            case 3: /* bottom right */
                return new Range(this.x + nw, this.y + nh, nw, nh);
                    
            default:
                throw "illegal split " + p;
        }
    }
}

/*
 * image functions
 */

Image.prototype.nextPowerOfTwo = function(val) {
    val--;
    val = (val >> 1) | val;
    val = (val >> 2) | val;
    val = (val >> 4) | val;
    val = (val >> 8) | val;
    val = (val >> 16) | val;
    return (val + 1);
}

Image.prototype.makePowerOfTwo = function() {
    var potw = this.nextPowerOfTwo(this.width);
    var poth = this.nextPowerOfTwo(this.height);
    
    if (this.width == potw && this.height == poth) {
        return this;
    }
    
    var size = Math.max(potw, poth);
    
    var p = new Uint8Array(size * size * 3);
    
    /* fill the image with the average color */
    var avgColor = this.avgColor();
    for (var i=0; i < size * size; i++) {
        var off = i * 3;
        p[off + 0] = avgColor.red;
        p[off + 1] = avgColor.green;
        p[off + 2] = avgColor.blue;
    }
    
    /* copy over the original image */
    var ls = this.width * 3;
    for (var y=0; y < this.height; y++) {
        var offset = y * ls;
        var line = this.pixels.subarray(offset, offset + ls);
        p.set(line, y * size * 3);
    }
    
    return new Image(size, size, p);
}

Image.prototype.halfSize = function() {
    var w = this.width / 2;
    var h = this.height / 2;
    var p = new Uint8Array(w * h * 3);
    
    for (var y=0; y < h; y++) {
        var lo = y * w;
        var lo2 = y * this.width * 2;
        
        for (var x=0; x < w; x++) {
            var dstOffset = (lo + x) * 3;
            var so = (lo2 + 2 * x) * 3;
            var nl = so + this.width * 3;
            
            /* red */
            var r1 = this.pixels[so + 0 + 0];
            var r2 = this.pixels[so + 3 + 0]
            var r3 = this.pixels[nl + 0 + 0];
            var r4 = this.pixels[nl + 3 + 0];
            var r = (r1 + r2 + r3 + r4) / 4;
            
            /* green */
            var g1 = this.pixels[so + 0 + 1];
            var g2 = this.pixels[so + 3 + 1]
            var g3 = this.pixels[nl + 0 + 1];
            var g4 = this.pixels[nl + 3 + 1];
            var g = (g1 + g2 + g3 + g4) / 4;
            
            /* blue */
            var b1 = this.pixels[so + 0 + 2];
            var b2 = this.pixels[so + 3 + 2]
            var b3 = this.pixels[nl + 0 + 2];
            var b4 = this.pixels[nl + 3 + 2];
            var b = (b1 + b2 + b3 + b4) / 4;
            
            p[dstOffset + 0] = r;
            p[dstOffset + 1] = g;
            p[dstOffset + 2] = b;
        }
    }
    
    return new Image(w, h, p);
}

/**
 * returns a part of this image as a new image
 */
Image.prototype.copy = function(offX, offY, w, h) {
    var nw = Math.min(w, this.width - offX);
    var nh = Math.min(h, this.height - offY);
    
    if (nw <= 0 || nh <= 0) {
        throw "target image would be empty";
    }
    
    var p = new Uint8Array(nw * nh * 3);
    var lineSize = nw * 3;
    
    for (var y=0; y < nh; y++) {
        var srcOff = ((y + offY) * this.width + offX) * 3;
        p.set(
            this.pixels.subarray(srcOff, srcOff + lineSize),
            y * lineSize);
    }
        
    return new Image(nw, nh, p);
}

Image.TRANSFORM_COUNT = 8;

/**
 * creates a transformed copy of a part of this image
 */
Image.prototype.transform = function(trans) {
    switch (trans) {
        case 0: /* no-op */
            break;
            
        case 1: /* flip */
            this.flip();
            break;
            
        case 2: /* rotate 90 */
            this.rotate90();
            break;
            
        case 3: /* rotate 180 */
            this.rotate180();
            break;
            
        case 4: /* rotate 270 */
            this.rotate270();
            break;
            
        case 5: /* flop */
            this.flop();
            break;
            
        case 6 : /* transpose */
            this.reflectDiag();
            break;
            
        case 7: /* reflect along 2nd diag */
            this.reflectDiag2();
            break;
            
        default:
            throw "unknwon transform " + trans;
    }
}

Image.prototype.toString = function() {
    return "Image [width=" + this.width + ", height=" + this.height + "]";
}

function Image(w, h, pixels) {
    this.width = w;
    this.height = h;
    
    if (!pixels) {
        this.pixels = new Uint8Array(w * h * 3);
        for (var i=0; i < w*h*3; i++) {
            this.pixels[i] = Math.floor(Math.random() * 255);
        }
    } else {
        this.pixels = pixels;
    }
}

Image.prototype.clone = function() {
    return new Image(this.width, this.height, new Uint8Array(this.pixels));
}
    
Image.prototype.rotate270 = function() {
    var dest = new Uint8Array(this.pixels.length);
        
    for (var i=0; i < this.width; i++) {
        var lineS = (this.height - 1) * this.width;
        var lineD = (this.width - i - 1) * this.height;
            
        for (var j=0; j < this.height; j++) {
            var offD = (lineD + (this.height - j - 1)) * 3;
            var offS = (lineS + i) * 3;
                
            dest[offD + 0] = this.pixels[offS + 0];
            dest[offD + 1] = this.pixels[offS + 1];
            dest[offD + 2] = this.pixels[offS + 2];
                
            lineS -= this.width;
        }
    }
        
    this.pixels = dest;
}
    
Image.prototype.rotate180 = function() {
    var dest = new Uint8Array(this.pixels.length);
    var w = this.width;
    var h = this.height;
        
    for (var y=0; y < this.height; y++) {
        for (var x=0; x < this.width; x++) {
            var srcOff = (y * this.width + x) * 3;
            var dstOff = ((h - y - 1) * w + (w - x - 1)) * 3;
                
            dest[dstOff + 0] = this.pixels[srcOff + 0];
            dest[dstOff + 1] = this.pixels[srcOff + 1];
            dest[dstOff + 2] = this.pixels[srcOff + 2];
        }
    }
        
    this.pixels = dest;
}
    
Image.prototype.rotate90 = function() {
    var dest = new Uint8Array(this.pixels.length);
        
    for (var i=0; i < this.width; i++) {
        var lineS = (this.height - 1) * this.width;
        var lineD = i * this.height;
            
        for (var j=0; j < this.height; j++) {
            var offD = (lineD + j) * 3;
            var offS = (lineS + i) * 3;
                
            dest[offD + 0] = this.pixels[offS + 0];
            dest[offD + 1] = this.pixels[offS + 1];
            dest[offD + 2] = this.pixels[offS + 2];
                
            lineS -= this.width;
        }
    }
        
    this.pixels = dest;
}
    
/**
     * fills a rect with a given color
     */
Image.prototype.fillRect = function(px, py, w, h, c) {
    var mx = px + w;
    var my = py + h;
       
    for (var y=py; y < my; y++) {
        for (var x=px; x < mx; x++) {
            var off = (y * this.width + x) * 3;
               
            this.pixels[off + 0] = c.red;
            this.pixels[off + 1] = c.green;
            this.pixels[off + 2] = c.blue;
        }
    }
}
    
/**
     * returns the average color of this image
     */
Image.prototype.avgColor = function() {
    var red = 0;
    var green = 0;
    var blue = 0;
        
    for (var y=0; y < this.height; y++) {
        for (var x=0; x < this.width; x++) {
            var off = (y * this.width + x) * 3;
                
            red += this.pixels[off + 0];
            green += this.pixels[off + 1];
            blue += this.pixels[off + 2];
        }
    }
        
    var scale = 1 / (this.width * this.height);
        
    return new Color(red * scale, green * scale, blue * scale);
}
    
/**
 * draws another image to the specified location of this image
 */
Image.prototype.draw = function(img, offX, offY) {
    var lineLen = Math.min(img.width * 3, (this.width - offX) * 3);
            
    if (lineLen <= 0) {
        /* nothing to do */
        return;
    }
        
    var maxy = Math.min(img.height, this.height - offY);
        
    if (maxy <=0) {
        return;
    }
        
    for (var y=0; y < maxy; y++) {
        var dstOff = ((y + offY) * this.width + offX) * 3;
        var srcOff = (y * img.width) * 3;
        var line = img.pixels.subarray(srcOff, srcOff + lineLen);
        this.pixels.set(line, dstOff);
    }
}

Image.prototype.shift = function(c) {
    for (var y=0; y < this.height; y++) {
        for (var x=0; x < this.width; x++) {
            var off = (y * this.width + x) * 3;
                
            this.pixels[off + 0] = Math.max(0, Math.min(255,
                this.pixels[off + 0] + c.red));
                        
            this.pixels[off + 1] = Math.max(0, Math.min(255,
                this.pixels[off + 1] + c.green));
                        
            this.pixels[off + 2] = Math.max(0, Math.min(255,
                this.pixels[off + 2] + c.blue));
        }
    }
}

Image.prototype.colorize = function(c, weight) {
        
    if (!weight) {
        weight = 0.5;
    }
        
    var w2 = Math.min(1, Math.max(0, weight));
    var w1 = (1 - w2);
        
    c = new Color(c.red * w2, c.green * w2, c.blue * w2);
        
    for (var y=0; y < this.height; y++) {
        for (var x=0; x < this.width; x++) {
            var off = (y * this.width + x) * 3;
                
            this.pixels[off + 0] = Math.max(0, Math.min(255,
                w1 * this.pixels[off + 0] + c.red));
                        
            this.pixels[off + 1] = Math.max(0, Math.min(255,
                w1 * this.pixels[off + 1] + c.green));
                        
            this.pixels[off + 2] = Math.max(0, Math.min(255,
                w1 * this.pixels[off + 2] + c.blue));
        }
    }
}
    
Image.prototype.extract = function(src, w, h) {
    var p = new Uint8Array(w * h * 3);
        
    for (var y=0; y < h; y++) {
        var sy = src.y + Math.floor(y * src.h / h);
            
        for (var x=0; x < w; x++) {
            var sx = src.x + Math.floor(x * src.w / w);
                
            var dstOff = (y * w + x) * 3;
            var srcOff = (sy * this.width + sx) * 3;
                
            p[dstOff + 0] = this.pixels[srcOff + 0];
            p[dstOff + 1] = this.pixels[srcOff + 1];
            p[dstOff + 2] = this.pixels[srcOff + 2];
        }
    }
        
    return new Image(w, h, p);
}
    
/**
     * crops this image to the specified region
     */
this.crop = function(w, h, offX, offY) {
    //        console.log("crop to " + offX + "," + offY + " " + w + "x" + h);
    var p = new Uint8Array(w * h * 3);
    var lineSize = w * 3;
        
    for (var y=0; y < h; y++) {
        var srcOff = ((y + offY) * this.width + offX) * 3;
        p.set(
            this.pixels.subarray(srcOff, srcOff + lineSize),
            y * lineSize);
    }
        
    this.width = w;
    this.height = h;
    this.pixels = p;
}
    
this.scale = function(scale, interp) {
    if (!interp) {
        this.scaleNN(scale);
    } else {
        switch(interp) {
            case 0:
                this.scaleNN(scale);
                break;
                    
            default:
                throw "unknown interpolation method " + interp;
        }
    }
}
    
/**
     * scales the image by the specified factor, using no interpolation
     */
Image.prototype.scaleNN = function(scale) {
    if (scale == 1) return;
        
    var w = this.width * scale;
    var h = this.height * scale;
    var invScale = 1 / scale;
    var p = new Uint8Array(w * h * 3);
        
    for (var y=0; y < h; y++) {
        var srcY = Math.floor(y * invScale);
            
        for (var x=0; x < w; x++) {
            var srcX = Math.floor(x * invScale);
                
            var srcOff = (srcY * this.width + srcX) * 3;
            var dstOff = (y * w + x) * 3;
                
            p[dstOff + 0] = this.pixels[srcOff + 0];
            p[dstOff + 1] = this.pixels[srcOff + 1];
            p[dstOff + 2] = this.pixels[srcOff + 2];
        }
    }
        
    this.width = w;
    this.height = h;
    this.pixels = p;
}
    
Image.prototype.paint = function(canvas) {
    canvas.width = this.width;
    canvas.height = this.height;
    var w = this.width;
    var h = this.height;
        
    var ctx = canvas.getContext("2d");
    var cd = ctx.createImageData(this.width, this.height);
    var cdd = cd.data;
        
    for (var y=0; y < h; y++) {
        for (var x=0; x < w; x++) {
            var srcOff = (y * w + x) * 3;
            var dstOff = (y * w + x) * 4;
                
            cdd[dstOff + 0] = this.pixels[srcOff + 0];
            cdd[dstOff + 1] = this.pixels[srcOff + 1];
            cdd[dstOff + 2] = this.pixels[srcOff + 2];
            cdd[dstOff + 3] = 255;
        }
    }
        
    ctx.putImageData(cd, 0, 0);
}
    
Image.prototype.difference = function(img, bestError) {
    //        if (img.width != this.width || img.height != this.height) {
    //            throw "different image sizes";
    //        }
        
    var w = Math.min(this.width, img.width);
    var h = Math.min(this.height, img.height);
    var diff = 0;
        
    if (bestError) {
        var eBound = (bestError * bestError) * w * h;
        for (var y=0; y < h; y++) {
            for (var x=0; x < w; x++) {
                var toff = (y * this.width + x) * 3;
                var ooff = (y * img.width + x) * 3;
                    
                var dr = this.pixels[toff + 0] - img.pixels[ooff + 0];
                var dg = this.pixels[toff + 1] - img.pixels[ooff + 1];
                var db = this.pixels[toff + 2] - img.pixels[ooff + 2];
                
                diff += (dr * dr + dg * dg + db * db);
            }
                
            if (diff >= eBound) {
                return Number.POSITIVE_INFINITY;
            }
        }
    } else {
        /* no bound given */
        for (y=0; y < h; y++) {
            for (x=0; x < w; x++) {
                toff = (y * this.width + x) * 3;
                ooff = (y * img.width + x) * 3;
                    
                dr = this.pixels[toff + 0] - img.pixels[ooff + 0];
                dg = this.pixels[toff + 1] - img.pixels[ooff + 1];
                db = this.pixels[toff + 2] - img.pixels[ooff + 2];
                    
                diff += (dr * dr + dg * dg + db * db);
            }
        }
    }
        
    return Math.sqrt(diff / (w*h));
}
    
Image.prototype.serialize = function() {
    var result = "";
        
    result += this.width;
    result += ",";
    result += this.height;
    result += ",";
    //    return result + this.pixels.join(",");
    
    for (var i=0; i < this.width * this.height * 3; i++) {
        result += this.pixels[i];
            
        if (i < (this.width * this.height * 3) - 1) {
            result += ",";
        }
    }
        
    return result;
}

/**
 * flips the image in vertical direction (top <-> bottom)
 */
Image.prototype.flip = function() {
    var lineSize = this.width * 3;
    for (var y=0; y < this.height / 2; y++) {
        var offTop = y * this.width * 3;
        var offBtm = (this.height - y - 1) * this.width * 3;
            
        /* remember source line */
        var tmp = new Uint8Array(
            this.pixels.subarray(offTop, offTop + lineSize));
        this.pixels.set(
            this.pixels.subarray(offBtm, offBtm + lineSize), offTop);
        this.pixels.set(tmp, offBtm);
    }
}

Image.prototype.flop = function() {
    var maxX = Math.floor(this.width / 2);
    
    for (var y=0; y < this.height; y++) {
        for (var x=0; x < maxX; x++) {
            var src = (y * this.width + x) * 3;
            var dst = (y * this.width + (this.width - x - 1)) * 3;
            
            var tr = this.pixels[dst + 0];
            var tg = this.pixels[dst + 1];
            var tb = this.pixels[dst + 2];
            
            this.pixels[dst + 0] = this.pixels[src + 0];
            this.pixels[dst + 1] = this.pixels[src + 1];
            this.pixels[dst + 2] = this.pixels[src + 2];
            
            this.pixels[src + 0] = tr;
            this.pixels[src + 1] = tg;
            this.pixels[src + 2] = tb;
        }
    }
}

/**
 * reflection along main diagonal
 */
Image.prototype.reflectDiag = function() {
    if (this.width != this.height) {
        throw "works only on square images";
    }
    
    for (var n=0; n < this.height - 1; n++) {
        for (var m=n+1; m < this.height; m++) {
            var src = (n * this.width + m) * 3;
            var dst = (m * this.width + n) * 3;
            
            var tr = this.pixels[dst + 0];
            var tg = this.pixels[dst + 1];
            var tb = this.pixels[dst + 2];
            
            this.pixels[dst + 0] = this.pixels[src + 0];
            this.pixels[dst + 1] = this.pixels[src + 1];
            this.pixels[dst + 2] = this.pixels[src + 2];
            
            this.pixels[src + 0] = tr;
            this.pixels[src + 1] = tg;
            this.pixels[src + 2] = tb;
        }
    }
}

/**
 * reflection along other diagonal
 */
Image.prototype.reflectDiag2 = function() {
    if (this.width != this.height) {
        throw "works only on square images";
    }
    
    var n = this.width;
    
    for (var i=0; i < n - 1; i++) {
        for (var j=0; j < n - 1 - i; j++) {
            var src = ((n - j - 1) * n + (n - 1 - i)) * 3;
            var dst = (i * n + j) * 3;
            
            var tr = this.pixels[dst + 0];
            var tg = this.pixels[dst + 1];
            var tb = this.pixels[dst + 2];
            
            this.pixels[dst + 0] = this.pixels[src + 0];
            this.pixels[dst + 1] = this.pixels[src + 1];
            this.pixels[dst + 2] = this.pixels[src + 2];
            
            this.pixels[src + 0] = tr;
            this.pixels[src + 1] = tg;
            this.pixels[src + 2] = tb;
        }
    }
}

function parseImage(imgString) {
    var parts = imgString.split(",");
    var w = parts[0];
    var h = parts[1];
    
    var pixels = new Uint8Array(w * h * 3);
    
    parts = parts.slice(2);
    for (var i=0; i < w * h * 3; i++) {
        pixels[i] = parts[i];
    }
    
    return new Image(w, h, pixels);
}

/* convert a canvas to the internal image representation */
function canvasToImage(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var srcPixels = ctx.getImageData(0, 0, w, h).data;
    var pixels = new Uint8Array(w * h * 3);
    
    for (var y=0; y < h; y++) {
        var dstOff = y * w * 3;
        var srcOff = y * w * 4;
        
        for (var x=0; x < w; x++) {
            var dstIdx = dstOff + x * 3;
            var srcIdx = srcOff + x * 4;
            
            pixels[dstIdx + 0] = srcPixels[srcIdx + 0];
            pixels[dstIdx + 1] = srcPixels[srcIdx + 1];
            pixels[dstIdx + 2] = srcPixels[srcIdx + 2];
        }
    }
    
    return new Image(w, h, pixels);
}

function imageToImage(img) {
    var c = document.createElement("canvas");
    c.width = img.width
    c.height = img.height;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return canvasToImage(c);
}
