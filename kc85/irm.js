
/**
 * Creates a new IRM instance using the specified element as screen container.
 */
function IRM(contElem) {
    this.data = new Uint8Array(16 * 1024);
    
    for (var i=0; i < this.data.length; i++) {
        this.data[i] = Math.random() * 255;
    }
    
    this.dirty = true;
    this.blinkEnabled = false;
    this.blinkState = false;
    
    /* initialize canvas */
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 256;
    contElem.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.update();
}

IRM.prototype.getAsciiChar = function(x, y) {
    var idx = 0x3200 + (y * 40) + x;
    var b = this.data[idx];
    var ch = ".";
    
    switch (b) {
        case 0: ch = " "; break;
        
        default:
            if ((b >= 0x20) && (b < 0x7f)) {
                ch = String.fromCharCode(b);
            }
    }
    
    return ch;
}

IRM.prototype.dumpAscii = function() {
    var result = "";
    for (var y=0; y < 32; y++) {
        for (var x=0; x < 40; x++) {
            result += this.getAsciiChar(x, y);
        }
        
        result += "\n";
    }
    
    return result;
}

IRM.prototype.update = function() {
    if (!this.dirty) {
        return;
    }
    
    var imgData = this.ctx.createImageData(320, 256);
    var pixels = imgData.data;
    
    for (var y=0; y < 256; y++) {
        var x=0;
        
        for (var col=0; col < 40; col++) {
            var pIdx = -1;
            var cIdx = -1;
            
            if (col < 32) {
                pIdx = ((y << 5) & 0x1E00)
                     | ((y << 7) & 0x0180)
                     | ((y << 3) & 0x0060)
                     | (col & 0x001F);
                
                cIdx = 0x2800 | ((y << 3) & 0x07E0) | (col & 0x001F);
            } else {
                pIdx = 0x2000
                | ((y << 3) & 0x0600)
                | ((y << 7) & 0x0180)
                | ((y << 3) & 0x0060)
                | ((y >> 1) & 0x0018)
                | (col & 0x0007);
                
                cIdx = 0x3000
                | ((y << 1) & 0x0180)
                | ((y << 3) & 0x0060)
                | ((y >> 1) & 0x0018)
                | (col & 0x0007);
            }
            
            if ( (pIdx >= 0) && (pIdx < this.data.length)
                && (cIdx >= 0) && (cIdx < this.data.length)) {
                
                var p = this.data[pIdx];
                var c = this.data[cIdx];
                var m = 0x80;
                
                for (var i=0; (i < 8) && (x < 320); i++) {
                    var color = this.basicRGB[this.getColorIndex(c, (p & m) != 0)];
                    var pixelOffset = (y * 320 + x) * 4;
                    
                    pixels[pixelOffset + 0] = color[0];
                    pixels[pixelOffset + 1] = color[1];
                    pixels[pixelOffset + 2] = color[2];
                    pixels[pixelOffset + 3] = 0xff;
                    
                    m >>= 1;
                    x++;
                }
            }
        }
    }
    
    this.ctx.putImageData(imgData, 0, 0);
    this.dirty = false;
}

IRM.prototype.writeByte = function(addr, val) {
    if (addr < this.data.length) {
        this.data[addr] = val;
        this.dirty = true;
    }
}

IRM.prototype.getByte = function(addr) {
    if (addr < this.data.length) {
        return this.data[addr] & 0xff;
    } else {
        return 0xff;
    }
}

IRM.prototype.getColorIndex = function(cbyte, fg) {
    if (this.blinkEnabled && this.blinkState && ((cbyte & 0x80) != 0) ) {
        fg = false;
    }
    
    return fg ? ((cbyte >> 3) & 0x0F) : ((cbyte & 0x07) + 16);
}

/**
 * Table of basic RGB colors supported by the IRM.
 */
IRM.prototype.basicRGB = [
    // primaere Vordergrundfarben
    [ 0,   0,   0   ],	// schwarz
    [ 0,   0,   255 ],	// blau
    [ 255, 0,   0   ],	// rot
    [ 255, 0,   255 ],	// purpur
    [ 0,   255, 0   ],	// gruen
    [ 0,   255, 255 ],	// tuerkis
    [ 255, 255, 0   ],	// gelb
    [ 255, 255, 255 ],	// weiss

    // Vordergrundfarben mit 30 Grad Drehung im Farbkreis
    [ 0,   0,   0   ],	// schwarz
    [ 75,  0,   180 ],	// violett
    [ 180, 75,  0   ],	// orange
    [ 180, 0,   138 ],	// purpurrot
    [ 0,   180, 75  ],	// gruenblau
    [ 0,   138, 180 ],	// blaugruen
    [ 138, 255, 0   ],	// gelbgruen
    [ 255, 255, 255 ],	// weiss

    // Hintergrundfarben (30% dunkler)
    [ 0,   0,   0   ],	// schwarz
    [ 0,   0,   180 ],	// blau
    [ 180, 0,   0   ],	// rot
    [ 180, 0,   180 ],	// purpur
    [ 0,   180, 0   ],	// gruen
    [ 0,   180, 180 ],	// tuerkis
    [ 180, 180, 0   ],	// gelb
    [ 180, 180, 180 ]	// weiss
    ];
