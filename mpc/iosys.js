
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

function IOSys(irm) {
    this.irm = irm;
    this.pio_13 = new Z80PIO("PIO_13");
}

IOSys.prototype.readByte = function(port) {
    console.log("read port 0x" + port.toString(16));
    return 0xff;
}

IOSys.prototype.writeByte = function(port, val) {
    switch (port & 0xff) {
        case 0xee: /* port a */
        case 0xef: /* port b */
            this.pio_13.writeCtrl(port & 1, val);
            break;
            
        case 0xec: /* port a */
        case 0xed: /* port b */
            this.pio_13.writeData(port & 1, val);
            break;
            
        default:
            /* should check modules */
            console.log("unhandled port 0x" + port.toString(16) + " = 0x" + val.toString(16));
    }
}