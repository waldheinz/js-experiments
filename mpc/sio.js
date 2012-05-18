
/*
 * SIO
 */

function SIO(name, clock) {
    this.name = name;
    this.clock = clock;
    
    this.channels = [
        new SIO_Channel(this.name + " Ch A"),
        new SIO_Channel(this.name + " Ch B")
    ];
}

SIO.prototype.log = function(message) {
    console.log(this.name + ": " + message);
}

SIO.prototype.readByte = function(port) {
    var channel = this.channels[port & 1];
    var cmdOrData = (port & 2) >> 1; /* 0 = data, 1 = command */
    
    return (cmdOrData == 0) ?
        channel.readData() :
        channel.readReg();
}

SIO.prototype.writeByte = function(port, val) {
    var channel = this.channels[port & 1];
    var cmdOrData = (port & 2) >> 1; /* 0 = data, 1 = command */
    
    if (cmdOrData == 0) {
        channel.writeData(val);
    } else {
        channel.writeReg(val);
    }
    
}

function SIO_Channel(name) {
    this.name = name;
    
    /** register pointer */
    this.regPtr = 0;
    this.writeRegs = new Array(7); /* register 0 is not included here */
    
    this.transmitUnderrun = true;
}

SIO_Channel.prototype.log = function(message) {
    console.log(this.name + ": " + message);
}

SIO_Channel.prototype.getStatusReg = function() {
    var result = 0;
    
    result |= 0 << 0; /* receive character available */
    result |= 0 << 1; /* interrupt pending */
    result |= 1 << 2; /* transmit buffer empty */
    result |= 0 << 3; /* DCD (data carrier detect) */
    result |= 0 << 4; /* sync / hunt */
    result |= 0 << 5; /* CTS (clear to send) */
    result |= (this.transmitUnderrun ? 1 : 0) << 6;
    result |= 0 << 7; /* break /abort */
    
    return result;
}

SIO_Channel.prototype.readReg = function() {
    this.log("read register " + this.regPtr);
    
    switch (this.regPtr) {
        case 0: /* status */
            return this.getStatusReg();
            
        default:
            throw "can't read register " + this.regPtr;
    }
    
    throw "up";
}

SIO_Channel.prototype.reset = function() {
    this.log("reset");
    
    this.regPtr = 0;
    this.transmitUnderrun = true;
    
    for (var i=0; i < this.writeRegs.length; i++) {
        this.writeRegs[i] = 0;
    }
}

SIO_Channel.prototype.execCommand = function(cmd) {
    switch (cmd) {
        case 0: /* NOP */
            break;
            
        case 3: /* channel reset */
            this.reset();
            break;
            
        default:
            throw "unknown command " + cmd;
    }
}

SIO_Channel.prototype.resetCrc = function(crc) {
    switch (crc) {
        case 0: /* NOP */
            break;
            
        default:
            throw "unknown crc reset " + crc;
    }
}

SIO_Channel.prototype.writeReg = function(val) {
    switch (this.regPtr) {
        case 0:
            this.regPtr = val & 7;
            this.execCommand((val >> 3) & 7);
            this.resetCrc((val >> 6) & 3);
            break;
        
        default:
            this.log("reg " + this.regPtr + " = 0x" + val.toString(16));
            this.writeRegs[this.regPtr - 1] = val;
            this.regPtr = 0;
    }
}
