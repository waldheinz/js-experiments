
function GDC(contElem) {
    this.scale = 1;
    
    /* initialize canvas */
    this.canvas = document.createElement('canvas');

    contElem.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.scale, this.scale);
    
    this.mode = undefined;
    this.paramByteCnt = 0;
    
    /**
     * 0 = mixed, 1 = graphics, 2 = charater
     */
    this.displayMode = 0;
    
    /**
     * 0 = not interlaced,
     * 1 = <invalid>,
     * 2 = interlaced-repeat(?),
     * 3 = interlaced
     */
    this.videoMode = 0;
    
    /** active display words per line, always even */
    this.regAW = 0;
    
    /** active display lines per field */
    this.regAL = 0;
    this.fifo = [];
}

GDC.prototype.readByte = function(port) {
    if (port == 0) {
        /* read status register bits:
         * 0 - data ready
         * 1 - fifo full
         * 2 - fifo empty
         * 3 - drawing in progress
         * 4 - dma execute
         * 5 - vsync active
         * 6 - hblank active
         * 7 - light pen detect
         */
        
        var result = 0;
        result |= (this.fifo.length == 16) ? 2 : 0;
        result |= (this.fifo.length ==  0) ? 4 : 0;
        console.log("gdc: status read " + result.toString(2));
        return result;
    } else {
        /* read from FIDO */
        throw "FIFO reading not implemented";
    }
}

GDC.prototype.writeByte = function(port, val) {
    if (port == 1) {
        /* command */
        switch (val) {
            case 0x00: /* reset */
                console.log("gdc: reset");
                this.mode = 0;
                this.paramByteCnt = 0;
                break;
                
            default:
                throw "unknown GDC command " + val.toString(16);
        }
    } else {
        /* data */
        
        switch (this.mode) {
            case 0:
                this.handleResetParamByte(val);
                break;
                
            default:
                console.log("gdc data: " + val.toString(16));
        }
    }
    
}

GDC.prototype.setMode = function(mode) {
    /* set operating mode (bits: 00CFIDGS) */
    
    this.displayMode = ((mode >> 4) & 2) | ((mode >> 1) & 1);
    console.log("gdc: set display mode " + this.displayMode.toString(2));
    
    this.videoMode = ((mode >> 2) & 2) | (mode & 1);
    console.log("gdc: set video mode " + this.videoMode.toString(2));
    
    if (this.videoMode == 1) {
        throw "illegal video mode";
    }
    
    console.log("gdc: dram refresh is " + ((mode & 4) != 0));
    console.log("gdc: paint during display is " + ((mode & 16) == 0));
}

GDC.prototype.handleResetParamByte = function(val) {
    switch (this.paramByteCnt) {
        case 0:
            this.setMode(val);
            break;
            
        case 1:
            this.regAW = val + 2;
            console.log("gdc: display width is " + (this.regAW * 16));
            break;
            
        case 6:
            this.regAL = val;
            break;
            
        case 7:
            this.regAL = this.regAL | ((val & 3) << 8);
            console.log("gdc: display height is " + this.regAL);
            
            this.canvas.width = this.regAW * 16 * this.scale;
            this.canvas.height = this.regAL * this.scale;
            break;
            
        default:
            console.log("gdc: ignoring param byte " +
                this.paramByteCnt + "=" + val.toString(16));
    }
    
    this.paramByteCnt++;
}

