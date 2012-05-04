
function Z80PIOPort(name) {
    this.name = name;
    this.mode = 0;
    this.waitMask = false;
    this.regMask = 0;
    this.regDataOut = 0;
}

function Z80PIO(name) {
    this.name = name;
    this.portA = new Z80PIOPort(name + " (Port A)");
    this.portB = new Z80PIOPort(name + " (Port B)");
    this.ports = [this.portA, this.portB];
}

Z80PIOPort.prototype.writeData = function(val) {
    console.log(this.name + ": set data " + val.toString(16));
    this.regDataOut = val;
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

Z80PIO.prototype.writeData = function(port, val) {
    this.ports[port].writeData(val);
}

Z80PIO.prototype.writeCtrl = function(port, val) {
    this.ports[port].writeCtrl(val);
}

/*
 * SIO
 */

function Z80SIO(name) {
    this.name = name;
}

Z80SIO.prototype.readByte = function(port) {
    var p = port & 3;
    
    console.log(this.name + ": read " + p.toString(2));
    return 0xff;
}

Z80SIO.prototype.writeByte = function(port, val) {
    var p = port & 3;
    
    console.log(this.name + ": write " + p.toString(2) + " = " + val);
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

function IOSys(gdc) {
    this.gdc = gdc;
    this.ctc_21_1 = new Z80CTC("CTC_21.1");
    this.pio_13 = new Z80PIO("PIO_13");
    this.sio_18_1 = new Z80SIO("SIO_18.1");
}

IOSys.prototype.readByte = function(port) {
    var p = port & 0xff;
    
    switch (p) {
        case 0x70: /* 01110000 */
        case 0x71: /* 01110001 */
            return this.gdc.readByte(port & 1);
            
        case 0xe7: /* 11100111 */
            this.sio_18_1.readByte(p);
            return 0xff;
            
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
            
        default:
            console.log("port 0x" + p.toString(16) + " = 0x" + val.toString(16));
            throw "up";
    }
}