
DMA = function() {
    
}

DMA.prototype.log = function(message) {
    console.log("DMA: " + message);
}

DMA.prototype.writeByte = function(val) {
    
    if ((val & 0x80) == 0x80) {
        /* bit 7 is set */
        
        if ((val & 0x03) == 0x03) {
            /* bit 0 and 1 are set */
            this.doWriteReg6(val);
        }
        
    } else {
        throw "unknown command 0x" + val.toString(16);
    }
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