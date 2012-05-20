
"use strict";

function DMA(memory, ioSys, sigReady) {
    this.memory = memory;
    this.ioSys = ioSys;
    this.sigReady = sigReady;
    this.sigIeo = new Signal("DMA IEO");
    this.waitReady = false;
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
    
    /**
     * Start address for operation.
     */
    this.portAStart = 0;
    this.portBStart = 0;
    
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
    
    /**
     * Work registers.
     */
    this.portAddrA = 0;
    this.portAddrB = 0;
    this.byteCount = 0;
    
    this.intEnabled = false;
    this.intOnMatch = false;
    this.intOnBlockEnd = false;
    this.intPending = false;
    this.intUnderService = false;
    this.intVector = 0;
    
    /** 0 = byte, 1 = continuous, 2 = burst */
    this.transferMode = 0;
}

DMA.prototype.log = function(message) {
    console.log("DMA: " + message);
}

DMA.prototype.interruptPending = function() {
    return this.intPending;
}

DMA.prototype.writeByte = function(val) {
    if (this.dataHandlers.length > 0) {
        this.dataHandlers.shift()(val);
    } else {
        if ((val & 0x80) == 0x80) {
            /* bit 7 is set */

            switch (val & 0x03) {
                case 0:this.doWriteReg3(val);break;
                case 1:this.doWriteReg4(val);break;
                case 2:this.doWriteReg5(val);break;
                case 3:this.doWriteReg6(val);break;
                default:throw "unknown command 0x" + val.toString(16);
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

DMA.prototype.doWriteReg3 = function(val) {
    if (((val >> 2) & 0x07) != 0) {
        throw "search/match not supported yet";
    }
    
    if ((val & 0x20) == 0x20) {
        this.intEnabled = true;
    }
    
    if ((val & 0x40) == 0x40) {
        /* start DMA */
        
        this.execTransfer();
    }
    
}

DMA.prototype.doWriteReg4 = function(val) {
    this.transferMode = (val >> 5) & 0x03;
    this.log("WR4 transfer mode = " + this.transferMode);
    
    var that = this;
    
    if ((val & 0x04) != 0) {
        /* Port B low byte */
        this.dataHandlers.push(function(b) {
            that.portBStart &= 0xff00;
            that.portBStart |= b & 0xff;
            that.log("WR4 port B start = 0x" + that.portBStart.toString(16));
        });
    }
    
    if ((val & 0x08) != 0) {
        /* Port B high byte */
        this.dataHandlers.push(function(b) {
            that.portBStart &= 0x00ff;
            that.portBStart |= (b & 0xff) << 8;
            that.log("WR4 port B start = 0x" + that.portBStart.toString(16));
        });
    }
    
    if ((val & 0x10) != 0) {
        /* interrupt control byte */
        this.dataHandlers.push(function(b) {
            that.log("WR4 interrupt control = " + b.toString(16));
            
            that.intOnMatch = (b & 0x01) == 0x01;
            that.intOnBlockEnd = (b & 0x02) == 0x02;
            
            if ((b & 0x04) == 0x04) {
                throw "pulse requested";
            }
            
            if ((b & 0x40) == 0x40) {
                throw "int on ready";
            }
            
            if ((b & 0x20) == 0x20) {
                throw "mod. int vector";
            }
            
            if ((b & 0x08) != 0) {
                that.dataHandlers.push(function(b) {
                    that.log("WR4 pulse control = " + b.toString(16));
                });
            }
            
            if ((b & 0x10) != 0) {
                that.dataHandlers.push(function(b) {
                    that.intVector = b;
                });
            }
        });
    }
    
}

DMA.prototype.doWriteReg5 = function(val) {
    var rdy = (val >> 3) & 1;
    var ce  = (val >> 4) & 1;
    var res = (val >> 5) & 1;
    
    this.log("WR5 rdy=" + rdy + ", ce=" + ce + ", restart=" + res);
}

DMA.prototype.doWriteReg6 = function(val) {
    switch (val) {
        case 0xa3:
            this.log("reset and disable interrupts")
            this.intUnderService = false;
            this.intPending = false;
            this.intEnabled = false;
            break;
            
        case 0xc3:
            this.log("reset");
            this.intUnderService = false;
            this.intPending = false;
            this.intEnabled = false;
//            this.resetBus();
//            this.resetAutoRepeat();
//            this.resetWait();
            /* reset port A/B to standard U880 timing */
            break;
            
        case 0xcf:
            this.log("load");
            this.portAddrA = this.portAStart;
            this.portAddrB = this.portBStart;
            this.byteCount = this.blockLength;
            break;
            
        default:
            throw "unknown register 6 value " + val.toString(16);
    }
}

DMA.prototype.readPortB = function() {
    if (this.portBDest == 0) {
        /* memory */
        throw "up";
    } else {
        /* I/O */
        var result = this.ioSys.readByte(this.portAddrB);
        this.portAddrB += this.portBDelta;
        return result;
    }
}

DMA.prototype.writePortA = function(val) {
    if (this.portADest == 0) {
        /* memory */
        this.memory.writeByte(this.portAddrA, val);
        this.portAddrA += this.portADelta;
    } else {
        throw "mem write";
    }
}

DMA.prototype.isReady = function(signal) {
    if (!this.waitReady) {
        this.log("did not wait for ready");
        return;
    }
    
    while (true) {
//        this.log(this.byteCount + " bytes remaining");
        
        if (this.direction == 0) {
            /* B -> A */
            this.writePortA(this.readPortB());
        } else {
            this.writePortB(this.readPortA());
        }
        
        if ((--this.byteCount == -1) || !this.sigReady.isAsserted()) {
            break;
        }
    }
    
    if (this.byteCount == -1) {
        this.log("block done");
        
        this.waitReady = false;
        if (this.intEnabled && this.intOnBlockEnd) {
            this.interrupt();
        } else {
            throw "up";
        }
    }
}

DMA.prototype.interrupt = function() {
    this.intPending = true;
    this.sigIeo.setAsserted(true);
}

DMA.prototype.acceptInterrupt = function() {
    this.intUnderService = true;
    return this.intVector;
}

DMA.prototype.interruptFinish = function() {
    this.intUnderService = false;
    this.intPending = false;
    this.sigIeo.setAsserted(false);
}

DMA.prototype.execTransfer = function() {
    this.log("starting transfer");
    
    this.waitReady = true;
    this.sigReady.wait(this.isReady.bind(this));
}

DMA.prototype.toString = function() {
    return "DMA";
}