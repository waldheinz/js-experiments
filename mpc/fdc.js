
/**
 * The 8272 FDC (Floppy Disk Controller).
 */
function FDC() {
    
    this.STATUS = {
        REQUEST_FOR_MASTER  : 0x80,
        DATA_INPUT          : 0x40,
        NON_DMA_MODE        : 0x20,
        BUSY                : 0x10,
        DRIVE_MASK          : 0x0f
    }
    
    this.ARGMASK = {
        SK_MASK             : 0x20,
        MT_MASK             : 0x80,
        DRIVE_MASK          : 0x03,
        HEAD_MASK           : 0x04,
        HEAD_DRIVE_MASK     : this.HEAD_MASK | this.DRIVE_MASK
    }
    
    this.regStatus  = this.STATUS.REQUEST_FOR_MASTER;
    this.regStatus3 = 0;
    
    /* reading commands / arguments */
    this.currentCommand = 0;
    this.argsCount = -1;
    this.args = new Uint8Array(9);
    
    this.resultIdx = 0;
    this.results = new Uint8Array(7);
    
    this.interruptRequested = false;
}

FDC.prototype.log = function(message) {
    console.log("fdc: " + message);
}

FDC.prototype.isInterruptRequested = function() {
    return this.interruptRequested;
}

FDC.prototype.readByte = function(sd) {
    if (sd == 0) {
        /* read status */
        this.log("read status");
        return this.regStatus;
    } else {
        /* read data */
        
        if (this.resultIdx < 0) {
            throw "fdc empty";
        } else {
            var result = this.results[this.resultIdx--];
            
            if (this.resultIdx < 0) {
                this.setIdle();
            }
            
            return result;
        }
        
    }
}

FDC.prototype.writeByte = function(sd, val) {
    if (sd == 0) {
        /* write data */
        throw "invalid status write";
    } else {
        /* write command */
        this.writeCommand(val);
    }
}

FDC.prototype.writeCommand = function(val) {
    this.regStatus |= this.STATUS.BUSY;
    
    if (this.argsCount == -1) {
        /* read command */
        this.currentCommand = val;
        this.argsCount++;
    } else {
        this.args[this.argsCount++] = val;
        
        switch (this.currentCommand) {
            case 0x04: /* sense drive status */
                if (this.argsCount == 1) {
                    this.log("sense drive status");
                    this.regStatus3 = this.args[0] & this.ARGMASK.HEAD_DRIVE_MASK;
                    this.results[0] = this.regStatus3;
                    this.resultIdx = 0;
                    this.setResultMode();
                }
                break;
                
            default:
                throw "unknown command 0x" + val.toString(16);
        }
    }
}

FDC.prototype.setResultMode = function() {
//    this.dmaReq             = false;
//    this.tStatesTillIOReq   = 0;
//    this.tStatesTillOverrun = 0;
    this.regStatus &= this.STATUS.DRIVE_MASK;
    this.regStatus |= this.STATUS.BUSY;
    this.regStatus |= this.STATUS.DATA_INPUT;
    this.regStatus |= this.STATUS.REQUEST_FOR_MASTER;
}

FDC.prototype.setIdle = function() {
    this.regStatus &= this.STATUS.DRIVE_MASK;
    this.regStatus |= this.STATUS.REQUEST_FOR_MASTER;
    this.argsCount = -1;
    this.resultIdx = -1;
//    this.eotReached     = false;
//    this.tcEnabled      = false;
//    this.tcFired        = false;
//    this.executingDrive = null;
//    this.curCmd         = Command.INVALID;
}
