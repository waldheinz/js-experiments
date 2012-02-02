
/*
 * color
 */
function RGB(red, green, blue) {
    this.red = red;
    this.green = green;
    this.blue = blue;
}

function YUV(y, u, v) {
    this.y = y;
    this.u = u;
    this.v = v;
}

YUV.wr = 0.299;
YUV.wb = 0.114;
YUV.wg = 1 - YUV.wr - YUV.wb;
YUV.umax = 0.436;
YUV.vmax = 0.615;

YUV.prototype.toRGB = function() {
    var y1 = this.y / 255;
    var u1 = (this.u / 255) * YUV.umax * 2 - YUV.umax; 
    var v1 = (this.v / 255) * YUV.vmax * 2 - YUV.vmax;
    
    var r = y1 + v1 * (1 - YUV.wr) / YUV.vmax;
    var g = y1 - u1 * (YUV.wb * (1 - YUV.wb)) / (YUV.umax * YUV.wg) - v1 * (YUV.wr * (1 - YUV.wr) / (YUV.vmax * YUV.wg));
    var b = y1 + u1 * (1 - YUV.wb) / YUV.umax;
    
    return new RGB(r * 255, g * 255, b * 255);
}

RGB.prototype.toYUV = function() {
    var r = this.red / 255;
    var g = this.green / 255;
    var b = this.blue / 255;
    
    var y = r * YUV.wr + g * YUV.wg + b * YUV.wb;
    var u = YUV.umax * (b - y) / (1 - YUV.wb);
    var v = YUV.vmax * (r - y) / (1 - YUV.wr);
    
    return new YUV(
        y * 255,
        (u + YUV.umax) * (255 / YUV.umax / 2),
        (v + YUV.vmax) * (255 / YUV.vmax / 2));
}

/*
 * An image consists of a width, a height and one or more channels.
 */
function Image(w, h, chn, colorSpace) {
    this.width = w;
    this.height = h;
    this.colorSpace = colorSpace;
    
    if (!chn) {
        var gray = new Uint8Array(w * h);
        this.channels = [gray];
        
        for (var i=0; i < w*h; i++) {
            gray[i] = 0; //Math.floor(Math.random() * 255);
        }
    } else {
        this.channels = chn;
    }
}

function createImage(w, h, channelCount, colorSpace) {
    var channels = [];
    for (var c=0; c < channelCount; c++) {
        channels.push(new Uint8Array(w * h));
    }
    
    return new Image(w, h, channels, colorSpace);
}

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
    var size = Math.max(potw, poth);
    
    if (this.width == size && this.height == size) {
        return this;
    }
    
    var chn = [];
    
    for (var c=0; c < this.channels.length; c++) {
        var dst = new Uint8Array(size * size);
        var src = this.channels[c];
        
        /* fill the image with the average color */
        var avg = this.avgIntensity(c)
        for (var i=0; i < size * size; i++) {
            dst[i] = avg;
        }
        
        /* copy over the original image */
        for (var y=0; y < this.height; y++) {
            var offset = y * this.width;
            var end = offset + this.width;
            var line = src.subarray(offset, end);
            
            dst.set(line, y * size);
        }
        
        chn.push(dst);
    }
    
    return new Image(size, size, chn);
}

Image.prototype.difference = function(other, channel) {
    if (!channel) {
        channel = 0;
    }
    
    var pt = this.channels[channel];
    var po = other.channels[channel];
    var w = Math.min(this.width, other.width);
    var h = Math.min(this.height, other.height);
    var p = new Uint8Array(w * h);
    
    for (var y=0; y < h; y++) {
        for (var x=0; x < w; x++) {
            var ot = y * this.width + x;
            var oo = y * other.width + x;
            var od = y * w + x;
            
            p[od] = Math.min(255, Math.max(0, 128 - (pt[ot] - po[oo]) / 2));
        }
    }
    
    return new Image(w, h, [p]);
}

Image.prototype.halfSize = function() {
    var w = this.width / 2;
    var h = this.height / 2;
    var result = [];
    
    for (var c=0; c < this.channels.length; c++) {
        var src = this.channels[c];
        var dst = new Uint8Array(w * h);
        
        for (var y=0; y < h; y++) {
            var dstOff = y * w;
            var srcLine = 2 * y * this.width;
        
            for (var x=0; x < w; x++) {
                var so = srcLine + (2 * x);
                
                var r1 = src[so + 0];
                var r2 = src[so + 1];
                var r3 = src[so + 0 + this.width];
                var r4 = src[so + 1 + this.width];
                var r = (r1 + r2 + r3 + r4) / 4;
                
                dst[dstOff + x] = r;
            }
        }
        
        result.push(dst);
    }
    
    return new Image(w, h, result);
}

Image.prototype.splitChannels = function() {
    var result = [];
    
    for (var i=0; i < this.channels.length; i++) {
        result.push(new Image(this.width, this.height, [this.channels[i]]));
    }
    
    return result;
}

Image.prototype.channelCount = function() {
    return this.channels.length;
}

/**
 * returns a part of this image as a new image
 */
Image.prototype.copy = function(offX, offY, w, h, channel) {
    var nw = Math.min(w, this.width - offX);
    var nh = Math.min(h, this.height - offY);
    
    if (nw <= 0 || nh <= 0) {
        throw "target image would be empty";
    }
    
    var chn = [];
    
    var cmin = 0;
    var cmax = this.channels.length;
    
    if (channel) {
        cmin = channel;
        cmax = channel+1;
    }
    
    for (var c=cmin; c < cmax; c++) {
        var p = new Uint8Array(nw * nh);
        var src = this.channels[c];
        
        for (var y=0; y < nh; y++) {
            var srcOff = ((y + offY) * this.width + offX);
            p.set(
                src.subarray(srcOff, srcOff + nw),
                y * nw);
        }
        
        chn.push(p);
    }
    
    return new Image(nw, nh, chn);
}

Image.TRANSFORM_COUNT = 8;

Image.reverseTrans = function(t) {
    
    switch (t) {
        case 1:
            return 3;
            
        case 3:
            return 1;
            
        default :
            return t;
    }
}

/**
 * creates a transformed copy of a part of this image
 */
Image.prototype.transform = function(trans) {
    switch (trans) {
        case 0: /* no-op */
            break;
            
        case 1:
            this.rotate90();
            break;
            
        case 2: /* rotate 180 */
            this.rotate180();
            break;
            
        case 3: /* rotate 270 */
            this.rotate270();
            break;
            
        case 4:
            this.flip();
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
    return "Image [width=" + this.width +
    ", height=" + this.height +
    ", channels=" + this.channelCount() + "]";
}

Image.prototype.clone = function() {
    var channels = [];
    
    for (var c=0; c < this.channelCount(); c++) {
        channels.push(new Uint8Array(this.channels[c]));
    }
    
    return new Image(this.width, this.height, channels);
}
    
Image.prototype.rotate270 = function() {
    for (var c=0; c < this.channelCount(); c++) {
        var dest = new Uint8Array(this.width * this.height);
        var src = this.channels[c];
        
        for (var i=0; i < this.width; i++) {
            var lineS = (this.height - 1) * this.width;
            var lineD = (this.width - i - 1) * this.height;
            
            for (var j=0; j < this.height; j++) {
                var offD = (lineD + (this.height - j - 1));
                var offS = (lineS + i);
                
                dest[offD] = src[offS];
                
                lineS -= this.width;
            }
        }
        
        this.channels[c] = dest;
    }
}
    
Image.prototype.rotate180 = function() {
    var w = this.width;
    var h = this.height;
    
    for (var c=0; c < this.channelCount(); c++) {
        var dest = new Uint8Array(this.width * this.height);
        var p = this.channels[c];
        
        for (var y=0; y < this.height; y++) {
            for (var x=0; x < this.width; x++) {
                var srcOff = (y * this.width + x);
                var dstOff = ((h - y - 1) * w + (w - x - 1));
                
                dest[dstOff] = p[srcOff];
            }
        }
        
        this.channels[c] = dest;
    }
}
    
Image.prototype.rotate90 = function() {
    for (var c=0; c < this.channelCount(); c++) {
        var dest = new Uint8Array(this.width * this.height);
        var src = this.channels[c];
        
        for (var i=0; i < this.width; i++) {
            var lineS = (this.height - 1) * this.width;
            var lineD = i * this.height;
            
            for (var j=0; j < this.height; j++) {
                var offD = (lineD + j);
                var offS = (lineS + i);
                
                dest[offD] = src[offS];
                
                lineS -= this.width;
            }
        }
        
        this.channels[c] = dest;
    }
}

/**
 * returns the average intensity of a channel of this image
 */
Image.prototype.avgIntensity = function(channel) {
    var value = 0;
    var pixels = this.channels[channel];
    
    for (var y=0; y < this.height; y++) {
        for (var x=0; x < this.width; x++) {
            value += pixels[y * this.width + x];
        }
    }
    
    return value / (this.width * this.height);
}
    
/**
 * draws another image to the specified location of this image
 */
Image.prototype.draw = function(img, offX, offY) {
    if (this.channelCount() != img.channelCount()) {
        throw "channel count mismatch";
    }
    
    var lineLen = Math.min(img.width, (this.width - offX));
            
    if (lineLen <= 0) {
        /* nothing to do */
        return;
    }
        
    var maxy = Math.min(img.height, this.height - offY);
        
    if (maxy <=0) {
        return;
    }
    
    for (var c=0; c < this.channelCount(); c++) {
        for (var y=0; y < maxy; y++) {
            var dstOff = ((y + offY) * this.width + offX);
            var srcOff = (y * img.width);
            var line = img.channels[c].subarray(srcOff, srcOff + lineLen);
            this.channels[c].set(line, dstOff);
        }
    }
}

Image.prototype.blit = function(img, srcChn, dstChn, offX, offY) {
    var lineLen = Math.min(img.width, (this.width - offX));
            
    if (lineLen <= 0) {
        /* nothing to do */
        return;
    }
        
    var maxy = Math.min(img.height, this.height - offY);
        
    if (maxy <=0) {
        return;
    }
    
    for (var y=0; y < maxy; y++) {
        var dstOff = ((y + offY) * this.width + offX);
        var srcOff = (y * img.width);
        var line = img.channels[srcChn].subarray(srcOff, srcOff + lineLen);
        this.channels[dstChn].set(line, dstOff);
    }
        
}

Image.prototype.adjust = function(o, s) {
    for (var c=0; c < this.channels.length; c++) {
        var p = this.channels[c];
        
        for (var y=0; y < this.height; y++) {
            for (var x=0; x < this.width; x++) {
                var off = (y * this.width + x);
                var v = p[off];
                var v2 = Math.round(v * s + o);
                p[off] = Math.max(0, Math.min(255, v2));
            }
        }
    }
}

Image.prototype.match = function(img) {
    if (this.channelCount() != 1 || img.channelCount() != 1) {
        throw "channel count must be 1";
    }
    
    if (this.width != img.width || this.height != img.height) {
        throw "image size mismatch";
    }
    
    var n = this.width * this.height;
    
    var as = img.channels[0];
    var bs = this.channels[0];
    
    var suma = 0;
    var suma2 = 0;
    var sumb = 0;
    var sumb2 = 0;
    var sumab = 0;
    
    for (var i=0; i < n; i++) {
        var a = as[i];
        var b = bs[i];
        
        suma += a;
        suma2 += a*a;
        sumb += b;
        sumb2 += b*b;
        sumab += a*b;
    }
    
    var s = (n * sumab - suma * sumb) / (n * suma2 - (suma * suma));
    var o = (sumb - s * suma) / n;
    var e = (sumb2 + s * (s * suma2 - 2 * sumab + 2*o*suma) + o * (o*n - 2 * sumb)) / n;
    
    return [e, o, s];
}

Image.prototype.shift = function(d) {
    for (var c=0; c < this.channels.length; c++) {
        var p = this.channels[c];
        
        for (var y=0; y < this.height; y++) {
            for (var x=0; x < this.width; x++) {
                var off = (y * this.width + x);
                
                p[off] = Math.max(0, Math.min(255, p[off] + d));
            }
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
   
Image.prototype.fillRect = function(xs, ys, w, h, channel, v) {
    var mx = Math.min(xs + w, this.width);
    var my = Math.min(ys + h, this.height);
    
    if (mx <= 0 || my <= 0) {
        return;
    }
    
    var p = this.channels[channel];
    
    for (var y=ys; y < my; y++) {
        for (var x=xs; x < mx; x++) {
            p[y * this.width + x] = v;
        }
    }
}
   
/**
 * crops this image to the specified region
 */
Image.prototype.crop = function(w, h, offX, offY) {
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

Image.prototype.scale = function(scale, interp) {
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
    var w = this.width;
    var h = this.height;
    
    canvas.width = w;
    canvas.height = h;
    
    var ctx = canvas.getContext("2d");
    var cd = ctx.createImageData(w, h);
    var cdd = cd.data;
    
    if (this.channels.length == 1) {
        /* grayscale image */
        var pixels = this.channels[0];
        
        for (var y=0; y < h; y++) {
            for (var x=0; x < w; x++) {
                var dstOff = (y * w + x) * 4;
                var c = pixels[y * w + x];
                
                cdd[dstOff + 0] = c;
                cdd[dstOff + 1] = c;
                cdd[dstOff + 2] = c;
                cdd[dstOff + 3] = 255;
            }
        }
    } else if (this.colorSpace == "rgb" && this.channels.length == 3) {
        /* rgb image */
        for (y=0; y < h; y++) {
            for (x=0; x < w; x++) {
                dstOff = (y * w + x) * 4;
                srcOff = y * w + x;
                
                cdd[dstOff + 0] = this.channels[0][srcOff];
                cdd[dstOff + 1] = this.channels[1][srcOff];
                cdd[dstOff + 2] = this.channels[2][srcOff];
                cdd[dstOff + 3] = 255;
            }
        }
    } else if (this.channels.length == 3) {
        /* yuv image */
        for (y=0; y < h; y++) {
            for (x=0; x < w; x++) {
                dstOff = (y * w + x) * 4;
                srcOff = y * w + x;
                
                var y1 = this.channels[0][srcOff];
                var u1 = this.channels[1][srcOff];
                var v1 = this.channels[2][srcOff];
                
                var rgb = new YUV(y1, u1, v1).toRGB();
                
                cdd[dstOff + 0] = rgb.red;
                cdd[dstOff + 1] = rgb.green;
                cdd[dstOff + 2] = rgb.blue;
                cdd[dstOff + 3] = 255;
            }
        }
    } else {
        throw "can not deal with " + this.channels.length + " channels";
    }
        
    ctx.putImageData(cd, 0, 0);
}

Image.prototype.serialize = function() {
    var result = "";
        
    result += this.width;
    result += ",";
    result += this.height;
    result += ",";
    result += this.channels.length;
    result += ",";
    
    for (var c=0; c < this.channels.length; c++) {
        var pixels = this.channels[c];
        
        for (var i=0; i < this.width * this.height; i++) {
            result += pixels[i];
            
            if (c < (this.channels.length-1) ||
                (i < (this.width * this.height) - 1)) {
                
                result += ",";
            }
        }
    
    }
    
    return result;
}

/**
 * flips the image in vertical direction (top <-> bottom)
 */
Image.prototype.flip = function() {
    var lineSize = this.width;
    
    for (var c=0; c < this.channelCount(); c++) {
        var pixels = this.channels[c];
        
        for (var y=0; y < this.height / 2; y++) {
            var offTop = y * this.width;
            var offBtm = (this.height - y - 1) * this.width;
            
            /* remember source line */
            var tmp = new Uint8Array(
                pixels.subarray(offTop, offTop + lineSize));
                
            pixels.set(
                pixels.subarray(offBtm, offBtm + lineSize), offTop);
                
            pixels.set(tmp, offBtm);
        }
    }
}

Image.prototype.flop = function() {
    var maxX = Math.floor(this.width / 2);
    
    for (var c=0; c < this.channelCount(); c++) {
        var p = this.channels[c];
        
        for (var y=0; y < this.height; y++) {
            for (var x=0; x < maxX; x++) {
                var src = (y * this.width + x);
                var dst = (y * this.width + (this.width - x - 1));
            
                var tmp = p[dst];
                p[dst] = p[src];
                p[src] = tmp;
            }
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
    for (var c=0; c < this.channelCount(); c++) {
        var p = this.channels[c];
        
        for (var n=0; n < this.height - 1; n++) {
            for (var m=n+1; m < this.height; m++) {
                var src = (n * this.width + m);
                var dst = (m * this.width + n);
            
                var tmp = p[dst];
                p[dst] = p[src];
                p[src] = tmp;
            }
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
    for (var c=0; c < this.channelCount(); c++) {
        var p = this.channels[c];
        
        for (var i=0; i < n - 1; i++) {
            for (var j=0; j < n - 1 - i; j++) {
                var src = ((n - j - 1) * n + (n - 1 - i));
                var dst = (i * n + j);
            
                var tmp = p[dst];
                p[dst] = p[src];
                p[src] = tmp;
            }
        }
    }
}

function parseImage(imgString) {
    var parts = imgString.split(",");
    var w = parseInt(parts[0]);
    var h = parseInt(parts[1]);
    var cc = parseInt(parts[2]);
    parts = parts.slice(3);
    
    var chn = [];
    
    for(var c=0; c < cc; c++) {
        var pixels = new Uint8Array(w * h);
        var off = w * h * c;
        
        for (var i=0; i < w * h; i++) {
            pixels[i] = parseInt(parts[i+ off]);
        }
        
        chn.push(pixels);
    }
    
    return new Image(w, h, chn);
}

/* convert a canvas to a gray scale image in the the internal representation */
function canvasToImageGray(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var srcPixels = ctx.getImageData(0, 0, w, h).data;
    
    var pixels = new Uint8Array(w * h);
    
    for (var y=0; y < h; y++) {
        var dstOff = y * w;
        var srcOff = y * w * 4;
        
        for (var x=0; x < w; x++) {
            var srcIdx = srcOff + x * 4;
            r = srcPixels[srcIdx + 0];
            g = srcPixels[srcIdx + 1];
            b = srcPixels[srcIdx + 2];
            var gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            
            pixels[dstOff + x] = gray;
        }
    }
    
    return new Image(w, h, [pixels]);
}

function canvasToImageRGB(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var srcPixels = ctx.getImageData(0, 0, w, h).data;
    
    var r = new Uint8Array(w * h);
    var g = new Uint8Array(w * h);
    var b = new Uint8Array(w * h);
    
    for (var y=0; y < h; y++) {
        var dstOff = y * w;
        var srcOff = y * w * 4;
        
        for (var x=0; x < w; x++) {
            var srcIdx = srcOff + x * 4;
            r[dstOff + x] = srcPixels[srcIdx + 0];
            g[dstOff + x] = srcPixels[srcIdx + 1];
            b[dstOff + x] = srcPixels[srcIdx + 2];
        }
    }
    
    return new Image(w, h, [r, g, b]);
}

function canvasToImageYUV(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var srcPixels = ctx.getImageData(0, 0, w, h).data;
    
    var yi = new Uint8Array(w * h);
    var ui = new Uint8Array(w * h);
    var vi = new Uint8Array(w * h);
    
    for (var y=0; y < h; y++) {
        var dstOff = y * w;
        var srcOff = y * w * 4;
        
        for (var x=0; x < w; x++) {
            var srcIdx = srcOff + x * 4;
            
            var yuv = new RGB(
                srcPixels[srcIdx + 0],
                srcPixels[srcIdx + 1],
                srcPixels[srcIdx + 2]).toYUV();
            
            yi[dstOff + x] = yuv.y;
            ui[dstOff + x] = yuv.u;
            vi[dstOff + x] = yuv.v;
        }
    }
    
    return new Image(w, h, [yi, ui, vi]);
}

function imageToImage(img, cspace) {
    var c = document.createElement("canvas");
    c.width = img.width
    c.height = img.height;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    
    switch (cspace) {
        case "yuv":
            return canvasToImageYUV(c);
            
        case "gray":
            return canvasToImageGray(c);
            
        default:
            throw "unsupported color space " + cspace;
    }
}
