
DMA = function() {
    this.dataHandlers = [];
    
    this.reg0 = 0;
    
    /**
     * 0 = invalid, 1 = transfer, 2 = search, 3 = transfer + search
     */
    this.operation = 0;
    
    /**
     * 0 = port B -> port A, 1 = port A -> port B
     */
    this.direction = 0;
    
    this.blockLength = 0;
    this.portAStart = 0;
    
    /**
     * 0 = memory, 1 = I/O port
     */
    this.portADest = 0;
    this.portBDest = 0;
    
    /**
     * Port A increment, should be 0, 1 or -1.
     */
    this.portADelta = 0;
    this.portBDelta = 0;
}

DMA.prototype.log = function(message) {
    console.log("DMA: " + message);
}

DMA.prototype.writeByte = function(val) {
    if (this.dataHandlers.length > 0) {
        this.dataHandlers.shift()(val);
    } else {
        if ((val & 0x80) == 0x80) {
            /* bit 7 is set */

            if ((val & 0x03) == 0x03) {
                /* bit 0 and 1 are set */
                this.doWriteReg6(val);
            } else {
                throw "unknown command 0x" + val.toString(16);
            }

        } else {
            if ((val & 0x03) == 0) {
                if ((val & 0x04) != 0) {
                    this.doWriteReg1(val);
                } else {
                    this.doWriteReg2(val);
                }
            } else {
                this.doWriteReg0(val);
            }

        }
    }
}

DMA.prototype.doWriteReg0 = function(val) {
    this.reg0 = val;
    this.operation = val & 0x03;
    this.direction = (val >> 2) & 0x01;
    
    var that = this;
    
    this.log("WR0 op=" + this.operation + ", dir=" + this.direction);
    
    if ((val & 0x08) != 0) {
        /* Port A low byte */
        this.dataHandlers.push(function(b) {
            that.portAStart &= 0xff00;
            that.portAStart |= b & 0xff;
        });
    }
    
    if ((val & 0x10) != 0) {
        /* Port A high byte */
        this.dataHandlers.push(function(b) {
            that.portAStart &= 0x00ff;
            that.portAStart |= (b & 0xff) << 8;
            that.log("WR0 port A start = 0x" + that.portAStart.toString(16));
        });
    }
    
    if ((val & 0x20) != 0) {
        /* block len low byte */
        this.dataHandlers.push(function(b) {
            that.blockLength &= 0xff00;
            that.blockLength |= b & 0xff;
        });
    }
    
    if ((val & 0x40) != 0) {
        /* block len high byte */
        this.dataHandlers.push(function(b) {
            that.blockLength &= 0x00ff;
            that.blockLength |= (b & 0xff) << 8;
            that.log("WR0 block length = " + that.blockLength);
        });
    }
    
}

DMA.prototype.doWriteReg1 = function(val) {
    this.portADest = (val >> 3) & 1;
    
    switch ((val >> 4) & 3) {
        case 0:
            this.portADelta = -1;
            break;
            
        case 1:
            this.portADelta = 1;
            break;
            
        default:
            this.portADelta = 0;
    }
    
    if ((val & 0x40) != 0) {
        this.dataHandlers.push(function(b) {
            /* we don't implement detailed timing, so this byte
             * is ignored for now
             */
        });
    }
    
    this.log("WR1 port A dest=" +
        this.portADest + ", delta=" + this.portADelta);
}

DMA.prototype.doWriteReg2 = function(val) {
    this.portBDest = (val >> 3) & 1;
    
    switch ((val >> 4) & 3) {
        case 0:
            this.portBDelta = -1;
            break;
            
        case 1:
            this.portBDelta = 1;
            break;
            
        default:
            this.portBDelta = 0;
    }
    
    if ((val & 0x40) != 0) {
        this.dataHandlers.push(function(b) {
            /* we don't implement detailed timing, so this byte
             * is ignored for now
             */
        });
    }
    
    this.log("WR2 port B dest=" +
        this.portBDest + ", delta=" + this.portBDelta);
}

DMA.prototype.doWriteReg6 = function(val) {
    switch (val) {
        case 0xc3:
            this.log("reset");
//            this.resetIRQ();
//            this.resetBus();
//            this.resetAutoRepeat();
//            this.resetWait();
            /* reset port A/B to standard U880 timing */
            break;
            
        default:
            throw "unknown register 6 value " + val.toString(16);
    }
}
