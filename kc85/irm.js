
/**
 * Creates a new IRM instance using the specified element as screen container.
 */
function IRM(contElem) {
    this.data = new Uint8Array(16 * 1024);
    this.dirty = true;
    
    /* initialize canvas */
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 256;
    contElem.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.update();
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
//                    var colorIdx = this.getColorIndex( c, (p & m) != 0 );
                    var color = p != 0 ? 0xffffff : 0;
                    var pixelOffset = (y * 320 + x) * 4;
                    
                    pixels[pixelOffset + 0] = p;
                    pixels[pixelOffset + 1] = p << 2;
                    pixels[pixelOffset + 2] = p << 4;
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
