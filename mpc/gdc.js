
function GDC(contElem) {
    this.scale = 1;
    
    /* initialize canvas */
    this.canvas = document.createElement('canvas');

    contElem.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.scale, this.scale);
    
    /* initialize random vram */
    this.vram = new Uint16Array(256 * 256);
    for (var i=0; i < this.vram.length; i++) {
        this.vram[i] = Math.random() * 255 * 256;
    }
    
    /**
     * Defines what to do with incoming data bytes:
     * -1 -> no destination
     * 0  -> reset parameters
     * 1  -> PRAM
     * 2  -> MASK
     * 3  -> PITCH
     * 4  -> CURS
     * 5  -> WDAT
     * 6  -> FIGS
     * 7  -> ZOOM
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
    this.wdatType = 0;
    
    /** mask register, 16 bits */
    this.regMask = 0;
    this.regPitch = 0;
    this.regEAD = 0;
    this.regdAD = 0;
    
    /**
     * Mode for RMW cycles,
     * 0 -> replace, 1 -> complement, 2 -> reset, 3 -> set
     */
    this.regRMWMode = 0;
    
    this.wdatData = 0;
    
    /* figure drawing parameters */
    this.regDrawDir = 0;
    this.regDrawFlags = 0;
    this.regDC = 0;
    this.regD = 0;
    this.regD2 = 0;
    this.regD1 = 0;
    this.regDM = 0;
    this.pramBit = 0;
    this.pramByte = 0;
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
        
//        if (this.AAAA) throw "up";
        
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
            var cmd_p1 = (val >> 5) & 7; /* get 3 MS bits */
            
            switch (cmd_p1) {
                case 0: /* 000xxxxx - BCTRL or SYNC */
                    if (((val >> 1) & 1) == 0) {
                        /* 0000110x - BCTRL */
                        console.log("gdc: enable display");
                    } else {
                        throw "unimplemented SYNC";
                    }
                
                    break;
                
                case 1: /* 001xxxxx - WDAT or DMAW */
                    
                    if (((val >> 2) & 1) == 0) {
                        /* WDAT */
                        this.regRMWMode = val & 3;
                        this.wdatType = (val >> 3) & 3;
                        this.setDataMode(5);
                        console.log("gdc: WDAT t=" + this.wdatType +
                            ", m=" + this.regRMWMode);
                    } else {
                        throw "unimplemented DMAW";
                    }
                    
                    break;
                    
                case 2: /* 010xxxxx */
                    var cmd_p2 = val & 0x1f;
                    
                    switch (cmd_p2) {
                        case 0x6: /* 01000110 - ZOOM */
                            console.log("gdc: ZOOM");
                            this.setDataMode(7);
                            break;
                            
                        case 0x7: /* 01000111 - PITCH */
                            console.log("gdc: PITCH");
                            this.setDataMode(3);
                            break;
                            
                        case 0x9: /* 01001001 - CURS */
                            console.log("gdc: CURS");
                            this.setDataMode(4);
                            break;
                            
                        case 0xa: /* 01001010 - MASK */
                            console.log("gdc: MASK");
                            this.setDataMode(2);
                            break;
                            
                        case 0xc: /* 01001100 - FIGS */
                            console.log("gdc: FIGS");
                            this.setDataMode(6);
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
                            case 4: /* 01101000 - GCHRD */
                                this.cmdGCHRD();
                                break;
                                
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
        
        this.paint();
        
    } else {
        /* data */
        
        switch (this.mode) {
            case 0:
                this.handleResetParamByte(val);
                break;
                
            case 1:
                this.pram[this.pramWritePos] = val;
                
                if (this.pramWritePos >= 8) {
                    console.log(this.pram[this.pramWritePos].toString(2));
                }
                
                this.pramWritePos++;
                
                if (this.pramWritePos == 16) {
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
                
            case 3: /* PITCH */
                this.regPitch = val;
                console.log("gdc: pitch is now " +
                    this.regPitch.toString() + " words");
                break;
                
            case 4: /* CURS */
                switch (this.paramByteCnt++) {
                    case 0:
                        this.regEAD &= 0x3ff00;
                        this.regEAD |= val & 0xff;
                        break;
                    
                    case 1:
                        this.regEAD &= 0x300ff;
                        this.regEAD |= (val & 0xff) << 8;
                        break;
                        
                    case 2:
                        this.regEAD &= 0xffff;
                        this.regEAD |= (val & 0x03) << 16;
                        this.regdAD = (val >> 4) & 0x0f;
                        this.logCursorPos();
                
                }
                
                break;
                
            case 5: /* WDAT */
                console.log("gdc: WDAT data " + val.toString(16));
                
                switch (this.wdatType) {
                    case 0:
                        if ((this.paramByteCnt % 2) == 0) {
                            this.wdatData = val;
                        } else {
                            this.wdatData = this.wdatData | (val << 8);
                            this.execWdat();
                        }
                        
                        break;
                        
                    default:
                        throw "unimplemented wdat type " + this.wdatType;
                }
                
                break;
                
            case 6: /* FIGS */
                switch (this.paramByteCnt++) {
                    case 0:
                        this.regDrawDir = val & 7;
                        this.regDrawFlags = val >> 3;
                        break;
                        
                    case 1:
                        this.regDC = val;
                        break;
                        
                    case 2:
                        this.regDC |= (val & 0x3f) << 8;
                        break;
                        
                    case 3:
                        this.regD = val;
                        break;
                        
                    case 4:
                        this.regD |= (val & 0x3f) << 8;
                        break;
                        
                    case 5:
                        this.regD2 = val;
                        break;
                        
                    case 6:
                        this.regD2 |= (val & 0x3f) << 8;
                        break;
                        
                    case 7:
                        this.regD1 = val;
                        break;
                        
                    case 8:
                        this.regD1 |= (val & 0x3f) << 8;
                        break;
                        
                    case 9:
                        this.regDM = val;
                        break;
                        
                    case 10:
                        this.regDM |= (val & 0x3f) << 8;
                        break;
                        
                    default:
                        console.log("suspicious FIGS parameter #"
                            + this.paramByteCnt + " = " + val);
                }
                
                break;
                
            case 7: /* ZOOM */
                console.log("gdc: ignore set zoom = " + val);
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

GDC.prototype.logCursorPos = function() {
    var cx = this.regEAD % this.regPitch + this.regdAD;
    var cy = Math.floor(this.regEAD / this.regPitch);

    console.log("gdc: cursor is at (" + cx + ", " + cy + ")");
}

GDC.prototype.cmdGCHRD = function() {
    console.log(this.regDC);
    console.log(this.regD);
    console.log(this.regD2);
    console.log(this.regDrawFlags.toString(2));
    
    console.log(this.regEAD);
    console.log(this.regdAD);
    console.log(this.regDrawDir.toString(2));
    
    this.pramBit = 0;
    this.pramByte = 0;
    var forward = true;
    
    draw: while (true) {
        if (this.dc) this.logCursorPos();
        /* grab figure from pram and advance */
        var f = (this.pram[this.pramByte] >> this.pramBit) & 1;
        
        /* update video ram */
        var o = this.vram[this.regEAD];
        
        switch (this.regRMWMode) {
            case 0:
                o &= ~(1 << this.regdAD);
                o |= (f << this.regdAD);
                break;
                
            case 1 :
                if (f) {
                    o ^= (1 << this.regdAD);
                }
                
                console.log("ead = " + this.regEAD);
                break;
                
            default:
                throw "up";
        }
        
        this.vram[this.regEAD] = o;
        
        /* advance cursor */
        switch (this.regDrawDir) {
            case 2:
                if (forward) {
                    if (this.regD > 0) {
                        /* move ltr */
                        this.cursorRight();
                        this.regD -= 1;
                    } else {
                        this.cursorUp();
                        
                        if (this.regDC == 0) {
                            break draw;
                        }
                        
                        this.regDC--;
                        forward = false;
                    }
                } else {
                    if (this.regD < this.regD2) {
                        this.cursorLeft();
                        this.regD += 1;
                    } else {
                        this.cursorUp();
                        
                        if (this.regDC == 0) {
                            break draw;
                        }
                        
                        this.regDC--;
                        
                        forward = true;
                    }
                }
                
                break;
                
            default:
                throw "unimplemented dir " + this.regDrawDir;
        }
    }
    
    this.paint();
//    if (this.dc) throw "up";
//    this.dc = true;
}

GDC.prototype.cursorLeft = function() {
    if (this.regdAD == 0) {
        this.regEAD--;
        this.regdAD = 15;
    } else  {
        this.regdAD--;
    }
    
    this.pramBit--;
    
    if (this.pramBit < 0) {
        this.pramBit = 7;
    }
}

GDC.prototype.cursorRight = function() {
    this.regdAD++;
    
    if (this.regdAD > 15) {
        this.regEAD++;
        this.regdAD = 0;
    }
    
    this.pramBit++;
    
    if (this.pramBit > 7) {
        this.pramBit = 0;
    }
}

GDC.prototype.cursorUp = function() {
    this.regEAD -= this.regPitch;
    
    this.pramByte--;
    
    if (this.pramByte < 8) {
        this.pramByte = 15;
    }
}

GDC.prototype.cursorDown = function() {
    this.regEAD += this.regPitch;
    
    
    this.pramByte++;
    
    if (this.pramByte > 15) {
        this.pramByte = 8;
    }
}


GDC.prototype.paint = function() {
    var sad1 =
        ((this.pram[2] & 3) << 16) |
        ((this.pram[1]    ) <<  8) |
        ((this.pram[0]    ) <<  0);
        
    var len1 =
        ((this.pram[3] & 0x3f) << 4) |
        ((this.pram[2] & 0xf0) >> 4);
    
    console.log("paint sad=" + sad1 + ", len=" + len1);
    if (len1 == 0) return;
    
    var offScreen = document.createElement('canvas');
    var width = this.regAW * 16;
    offScreen.width = width;
    offScreen.height = this.regAL;
    
    var octx = offScreen.getContext('2d');
    var imgData = octx.createImageData(width, this.regAL);
    var pixels = imgData.data;
    
    for (var line=0; line < len1; line++) {
        var off = sad1 + (this.regPitch * line);
        
        for (var w=0; w < this.regAW; w++) {
            var d = this.vram[off + w];
            var poff = (line * width + w * 16) * 4;
            
            for (var p=0; p < 16; p++) {
                var pv = ((d >> (15 - p)) & 1) * 255;
                
                pixels[poff + p * 4 + 0] = 0;
                pixels[poff + p * 4 + 1] = pv;
                pixels[poff + p * 4 + 2] = 0;
                pixels[poff + p * 4 + 3] = 0xff;
            }
        }
    }
    
    octx.putImageData(imgData, 0, 0);
    this.ctx.drawImage(offScreen, 0, 0);
    this.dirty = false;
}