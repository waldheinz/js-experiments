
function Z80PIO() {
    
}

function IOSys(irm) {
    this.irm = irm;
    this.pio = new Z80PIO();
}

IOSys.prototype.readByte = function(port) {
//    throw "rup " + port.toString(16);
    console.log("read port 0x" + port.toString(16));
    return 0xff;
}

IOSys.prototype.writeByte = function(port, val) {
    console.log("write port 0x" + port.toString(16) + " = 0x" + val.toString(16));
    switch (port & 0xff) {
        case 0x80:
            
        case 0x88:
//            this.pio.writePortA(val);
//            m = this.pio.fetchOutValuePortA( false );
//            this.caosE000Enabled  = ((m & 0x01) != 0);
//            this.ram0Enabled      = ((m & 0x02) != 0);
//            this.irmEnabled       = ((m & 0x04) != 0);
//            this.ram0Writeable    = ((m & 0x08) != 0);
//            this.basicC000Enabled = ((m & 0x80) != 0);
            break;
            
        case 0x89:
//            this.pio.writePortB(val);
//            m = this.pio.fetchOutValuePortB( false );
//            this.blinkEnabled = ((m & 0x80) != 0);
            break;
            
        default:
            /* should check modules */
    }
}