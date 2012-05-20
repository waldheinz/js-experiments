
"use strict";

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
    
    this.STATUS3 = {
        WRITE_PROTECTED     : 0x40,
        READY               : 0x20,
        TRACK_0             : 0x10,
        TWO_SIDE            : 0x08
    }
    
    this.ARGMASK = {
        SK_MASK             : 0x20,
        MT_MASK             : 0x80,
        DRIVE_MASK          : 0x03,
        HEAD_MASK           : 0x04,
        HEAD_DRIVE_MASK     : this.HEAD_MASK | this.DRIVE_MASK
    }
    
    this.regStatusMain = this.STATUS.REQUEST_FOR_MASTER;
    this.regStatus0 = 0;
    this.regStatus1 = 0;
    this.regStatus2 = 0;
    this.regStatus3 = 0;
    this.stepRateMillis = 0;
    this.dmaMode = false;
    
    /* reading commands / arguments */
    this.currentCommand = 0;
    this.argsCount = -1;
    this.args = new Uint8Array(9);
    this.eotReached = false;
    this.resultIdx = 0;
    this.results = new Uint8Array(7);
    this.interruptRequested = false;
    this.tcEnabled = false;
    this.fdds = new Array(4); /* the connected floppy disk drives */
    this.sigReady = new Signal("FDC ready");
    
    this.activeDrive = null;
    this.sectorStream = null;
}

FDC.prototype.log = function(message) {
    console.log("fdc: " + message);
}

FDC.prototype.tcFired = function() {
    this.log("TC fired");
    
    switch (this.currentCommand) {
        case 0x46: /* read data */
            if (this.tcEnabled) {
                this.stopExecution();
            } else {
                throw "up";
            }
            break;
            
        default:
            throw "can't handle command 0x" + this.currentCommand.toString(16);
    }
}

FDC.prototype.attachDrive = function(idx, fdd) {
    this.fdds[idx] = fdd;
}

FDC.prototype.isInterruptRequested = function() {
    return this.interruptRequested;
}

FDC.prototype.readByte = function(sd) {
    if (sd == 0) {
        /* read status */
        this.log("read status");
        return this.regStatusMain;
    } else {
        /* read data */
        this.log("read results");
        
        if (this.resultIdx < 0) {
            throw "fdc empty";
        } else {
            this.interruptRequested = false;
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

FDC.prototype.getArg0Drive = function() {
    return this.fdds[this.args[0] & 0x03];
}

FDC.prototype.writeCommand = function(val) {
    this.regStatusMain |= this.STATUS.BUSY;
    
    if (this.argsCount == -1) {
        /* read command */
        this.currentCommand = val;
        this.argsCount++;
    } else {
        this.args[this.argsCount++] = val;
        
        switch (this.currentCommand) {
            case 0x03: /* specify */
                if (this.argsCount == 2) {
                    this.stepRateMillis = 16 - ((this.args[0] >> 4) & 0x0f);
                    this.dmaMode        = ((this.args[1] & 0x01) == 0);
                    
                    this.log("specify srt="
                        + this.stepRateMillis + ", dma=" + this.dmaMode);
                    
                    this.setIdle();
                }
                break;
                
            case 0x04: /* sense drive status */
                if (this.argsCount == 1) {
                    this.doSenseDriveStatus();
                }
                break;
                
            case 0x07: /* recalibrate */
                if (this.argsCount == 2) {
                    this.doRecalibrate();
                }
                break;
                
            case 0x46: /* read data */
                if (this.argsCount == 9) {
                    this.doReadFromDisk();
                }
                break;
                
            default:
                throw "unknown command 0x" + this.currentCommand.toString(16);
        }
    }
}

FDC.prototype.getArgDataLen = function() {
    var sizeCode = this.args[5] & 0x0F;
    
    if (sizeCode > 0) {
        return 128 << sizeCode;
    } else {
        return this.args[8];
    }
}

FDC.prototype.doReadFromDisk = function() {
    this.log("starting read");
    
    this.setExecMode();
    this.clearStatusRegs0to2();
    this.tcEnabled = true;
    
    this.sectorIdCyl      = this.args[1];
    this.sectorIdHead     = this.args[2];
    this.sectorIdRec      = this.args[3];
    this.sectorIdSizeCode = this.args[4];
    
    var fdd = this.fdds[this.args[0] & 0x03];
    
    if (fdd && fdd.isReady()) {
        this.activeDrive = fdd;
        this.sigReady.assert();
    } else {
        this.regStatusMain = 0xd8 | (this.args[0] & 0x07);
        this.stopExecution();
    }
}

FDC.prototype.doRecalibrate = function() {
    this.log("recalibrate");
    this.setIdle();
}

FDC.prototype.doSenseDriveStatus = function() {
    this.log("sense drive status");
    
    this.regStatus3 = this.args[0] & this.ARGMASK.HEAD_DRIVE_MASK;
    var fdd = this.getArg0Drive();

    if (fdd) {
        this.regStatus3 |= this.STATUS3.TWO_SIDE;

        if (fdd.getCylinder() == 0) {
            this.regStatus3 |= this.STATUS3.TRACK_0;
        }

        if (fdd.isReady()) {
            this.regStatus3 |= this.STATUS3.READY;
        }

        if (fdd.isReadOnly()) {
            this.regStatus3 |= this.STATUS3.WRITE_PROTECTED;
        }
    } else {
        this.log("sense unconnected drive " + (this.args[0] & 3));
    }

    this.results[0] = this.regStatus3;
    this.resultIdx = 0;
    this.setResultMode();
}

FDC.prototype.stopExecution = function() {
    this.activeDrive = null;
    this.sigReady.setAsserted(false);
    
    this.results[0]   = this.sectorIdSizeCode;
    this.results[1]   = this.sectorIdRec;
    this.results[2]   = this.sectorIdHead;
    this.results[3]   = this.sectorIdCyl;
    this.results[4]   = this.regStatus2;
    this.results[5]   = this.regStatus1;
    this.results[6]   = this.regStatus0;
    this.resultIdx    = 6;
    this.regStatusMain &= 0xF8;
    this.regStatusMain |= (this.args[0] & 0x07);
    this.interruptRequested = true;
    this.setResultMode();
}

FDC.prototype.clearStatusRegs0to2 = function() {
    this.regStatus0 = 0;
    this.regStatus1 = 0;
    this.regStatus2 = 0;
}

FDC.prototype.setExecMode = function() {
    this.regStatusMain &= 0x3F;		// kein Datentransfer moeglich
    this.regStatusMain |= 0x10;		// Busy
    
    if (!this.dmaMode) {
        this.regStatusMain |= 0x20;
    }
}

FDC.prototype.setResultMode = function() {
    //    this.dmaReq             = false;
    //    this.tStatesTillIOReq   = 0;
    //    this.tStatesTillOverrun = 0;
    this.regStatusMain &= this.STATUS.DRIVE_MASK;
    this.regStatusMain |= this.STATUS.BUSY;
    this.regStatusMain |= this.STATUS.DATA_INPUT;
    this.regStatusMain |= this.STATUS.REQUEST_FOR_MASTER;
}

FDC.prototype.setIdle = function() {
    this.regStatusMain &= this.STATUS.DRIVE_MASK;
    this.regStatusMain |= this.STATUS.REQUEST_FOR_MASTER;
    this.argsCount = -1;
    this.resultIdx = -1;
    this.eotReached = false;
//    this.tcEnabled      = false;
//    this.tcFired        = false;
    this.activeDrive = null;
    this.currentCommand = 0;
}

FDC.prototype.getArgHead = function() {
    return (this.args[0] >> 2) & 0x01;
}

FDC.prototype.nextSector = function() {
    if (this.sectorIdRec == this.args[5]) {
        if((this.currentCommand & 0x80) != 0 ) {
            // Multi Track
            if ((this.args[0] & 0x04) == 0 ) {
                // Seite 0
                this.sectorIdRec = 1;
                this.args[0] |= 0x04;
            } else {
                // Seite 1
                this.eotReached  = true;
                this.sectorIdRec = 1;
                this.sectorIdCyl++;
                this.args[0] &= ~0x04;
            }
        } else {
            this.eotReached  = true;
            this.sectorIdRec = 1;
            this.sectorIdCyl++;
        }
    } else {
        this.sectorIdRec++;
    }
}

FDC.prototype.readDma = function() {
    if (!this.dmaMode) {
        throw "not in dma mode";
    }
    
    if (this.sectorStream == null) {
        
        var sec = this.activeDrive.readSector(
            this.getArgHead(),
            this.sectorIdCyl,
            this.sectorIdRec);
            
        this.sectorStream = sec.getStream();
        this.nextSector();
    }
    
    var result = this.sectorStream.nextByte();
    
    if (!this.sectorStream.hasByte()) {
        this.sectorStream = null;
    }
    
    return result;
}

/**
 * A Floppy Disk Drive.
 */
function FDD(name) {
    this.name = name;
    this.cylinder = 0;
    this.disk = null;
}

FDD.prototype.log = function(message) {
    console.log(this.name + ": " + message);
}

FDD.prototype.readSector = function(head, cyl, rec) {
    this.log("reading " + head + ", " + cyl + ", " + rec);
    
    var cylinder = this.disk.sides[head][cyl];
    console.log(cylinder[rec-1]);
    return cylinder[rec-1];
}

FDD.prototype.getCylinder = function() {
    return this.cylinder;
}

FDD.prototype.isReady = function() {
    return (this.disk != null);
}

FDD.prototype.isReadOnly = function() {
    return false; // this.isReady() ? this.disk.isReadOnly() : true;
}

FDD.prototype.loadDisk = function(disk) {
    this.disk = disk;
    this.log("loaded disk " + disk.toString());
}
