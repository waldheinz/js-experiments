
/*
 * PIO
 */

function Z80PIOPort(name) {
    this.name = name;
    this.mode = 0;
    this.waitMask = false;
    this.regMask = 0;
    this.regDataOut = 0;
    this.readDataFunc = function() {
        throw (this.name + ": no data read function");
    }
    
    this.writeDataFunc = function(val) {
        throw (this.name + ": no data write function");
    }
}

function Z80PIO(name) {
    this.name = name;
    this.portA = new Z80PIOPort(name + " (Port A)");
    this.portB = new Z80PIOPort(name + " (Port B)");
    this.ports = [this.portA, this.portB];
}

Z80PIOPort.prototype.readData = function() {
    console.log(this.name + ": read data ");
    var input = this.readDataFunc() & this.regMask;
    input |= this.regDataOut & ~ this.regMask;
    return input;
}

Z80PIOPort.prototype.writeData = function(val) {
    console.log(this.name + ": set data " + val.toString(2) + "b");
    this.regDataOut = val;
    this.writeDataFunc(val);
}

Z80PIOPort.prototype.writeCtrl = function(val) {
    if (this.waitMask) {
        this.regMask = val;
        console.log(this.name + ": set IO mask " + val.toString(2));
        this.waitMask = false;
    } else {
        var op = val & 0xf;
        
        switch (op) {
            case 0xf:

                this.setMode((val & 0xc0) >> 6);
                break;

            default:
                throw "can't handle mode " + op.toString(16);
        }
    }
}

Z80PIOPort.prototype.setMode = function(mode) {
    console.log(this.name + ": set mode " + mode);
    this.mode = 3;
    
    if (mode == 3) {
        this.waitMask = true;
    }
}

Z80PIO.prototype.readData = function(port, val) {
    this.ports[port].readData(val);
}

Z80PIO.prototype.writeData = function(port, val) {
    this.ports[port].writeData(val);
}

Z80PIO.prototype.writeCtrl = function(port, val) {
    this.ports[port].writeCtrl(val);
}

/*
 * CTC
 */

function Z80CTC(name) {
    this.name = name;
}

Z80CTC.prototype.readByte = function(port) {
    var p = port & 3;
    
    console.log(this.name + ": read " + p.toString(2));
    return 0xff;
}

Z80CTC.prototype.writeByte = function(port, val) {
    var p = port & 3;
    
    console.log(this.name + ": write " + p.toString(2) + " = " + val);
}


/*
 * IOSys
 */

function IOSys(gdc, fdc, sio_18_1) {
    this.gdc = gdc;
    this.fdc = fdc;
    this.dma = new DMA(this);
    this.ctc_21_1 = new Z80CTC("CTC_21.1");
    this.pio_13 = new Z80PIO("PIO_13");
    
    this.pio_13.portA.readDataFunc = function() {
        if (fdc.isInterruptRequested()) {
            return 1 << 7;
        } else {
            return 0;
        }
    }
    
    this.pio_13.portA.writeDataFunc = function(val) {
        var mode = val & 7; /* goes to X2.1 Mo0 - Mo2, Mo0 - Mo1 used in FDC */
    }
    
    this.sio_18_1 = sio_18_1;
    
    this.interruptSources = [
        sio_18_1
    ];
}

IOSys.prototype.getInterruptSource = function() {
    for (var i=0; i < this.interruptSources.length; i++) {
        var is = this.interruptSources[i];
        if (is.interruptPending()) {
            return is;
        }
    }
    
    return null;
}

IOSys.prototype.readByte = function(port) {
    var p = port & 0xff;
    
    switch (p) {
        case 0x70: /* 01110000 */
        case 0x71: /* 01110001 */
            return this.gdc.readByte(port & 1);
            
        case 0xe5: /* 11100101 */
        case 0xe7: /* 11100111 */
            return this.sio_18_1.readByte(p & 3);
            
        case 0xec: /* 11101100 : pio 13, port a */
        case 0xed: /* 11101101 : pio 13, port b */
            return this.pio_13.readData(p & 1);
            
        case 0xf8: /* 11111000 : FDC_1 status (CS_7) */
        case 0xf9: /* 11111001 : FDC_1 data */
            return this.fdc.readByte(p & 1);
            
        case 0xfd: /* 11111101 : DACK to FDC */
            
            
        default:
            console.log("XXX unimplemented read port 0x" + p.toString(16));
            throw "up";
            return 0xff;
    }
}

IOSys.prototype.writeByte = function(port, val) {
    var p = port & 0xff;
    
    switch (p) {
        case 0x70: /* 01110000 */
        case 0x71: /* 01110001 */
            this.gdc.writeByte(p & 1, val);
            break;
            
        case 0xe7: /* 11100111 */
            this.sio_18_1.writeByte(p, val);
            break;
            
        case 0xec: /* 11101100 : port a */
        case 0xed: /* 11101101 : port b */
            this.pio_13.writeData(p & 1, val);
            break;
            
        case 0xee: /* 11101110 : port a */
        case 0xef: /* 11101111 : port b */
            this.pio_13.writeCtrl(p & 1, val);
            break;
            
        case 0xf4: /* 11110100 */
            this.ctc_21_1.writeByte(port, val);
            break;
            
        case 0xf9: /* 11111001 : FDC command */
            this.fdc.writeByte(p & 1, val);
            break;
            
        case 0xff: /* 11111111 : DMA */
            this.dma.writeByte(val);
            break;
            
        default:
            console.log("port 0x" + p.toString(16) + " = 0x" + val.toString(16));
            throw "up";
    }
}