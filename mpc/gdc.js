
function GDC(contElem) {
    this.scale = 1;
    
    /* initialize canvas */
    this.canvas = document.createElement('canvas');

    contElem.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.scale, this.scale);
    
    /**
     * Defines what to do with incoming data bytes:
     * -1 -> no destination
     * 0  -> reset parameters
     * 1  -> PRAM data
     * 2  -> MASK data
     */
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
    this.pram = new Array(16);
    this.pramWritePos = 0;
    
    /** mask register, 16 bits */
    this.regMask = 0;
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

GDC.prototype.setDataMode = function(mode) {
    this.mode = mode;
    this.paramByteCnt = 0;
}

GDC.prototype.writeByte = function(port, val) {
    if (port == 1) {
        /* command */
        
        if (val == 0) {
            console.log("gdc: reset");
            this.mode = 0;
            this.paramByteCnt = 0;
        } else {
            var cmd_p1 = (val >> 5) & 7;
            
            switch (cmd_p1) {
                case 2: /* 010xxxxx */
                    var cmd_p2 = val & 0x1f;
                    
                    switch (cmd_p2) {
                        case 0xa: /* 01001010 - MASK */
                            console.log("gdc: MASK");
                            this.setDataMode(2);
                            break;
                            
                        default:
                            throw "unknown " + cmd_p2.toString(16);
                    }
                    
                    break;
                    
                case 3: /* 011xxxxx */
                    if (((val >> 4) & 1) == 0) {
                        /* 0110xxxx */
                        
                        cmd_p2 = (val >> 1) & 7;
                        
                        switch (cmd_p2) {
                            
                            case 7: /* 0110111x - VSYNC */
                                console.log("gdc: set vsync mode " + (val & 1));
                                break;
                                
                            default:
                                throw "unknown " + cmd_p2;
                        }
                    } else {
                        /* 0111xxxx - PRAM */
                        this.mode = 1;
                        this.pramWritePos = val & 0xf;
                        console.log("gdc: PRAM " + this.pramWritePos);
                    }
                    
                    break;
                    
                default:
                    throw "unknown GDC command " + val.toString(2);
            }
        }
    } else {
        /* data */
        
        switch (this.mode) {
            case 0:
                this.handleResetParamByte(val);
                break;
                
            case 1:
                this.pram[this.pramWritePos++] = val;
                
                if (this.pramWritePos == 15) {
                    this.pramWritePos = 0;
                }
                
                break;
                
            case 2:
                switch (this.paramByteCnt++) {
                    case 0:
                        this.regMask &= 0xff00;
                        this.regMask |= (val & 0xff);
                        break;
                        
                    case 1:
                        this.regMask &= 0xff;
                        this.regMask |= (val & 0xff) << 8;
                        console.log("gdc: mask is now " +
                            this.regMask.toString(2));
                        break;
                        
                    default:
                        console.log("gdc: ignore MASK " + val.toString(16));
                }
                
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

