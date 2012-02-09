
function Z80(mem) {
    this.mem = mem;
    
    /* registers */
    this.regPC = 0x0; /* program counter */
    this.regSP = 0x0; /* stack pointer */
    
    /* internal state */
    this.instTStates = 0;
    
    this.reset();
}

Z80.prototype.reset = function() {
    console.log("CPU reset");
    
    this.regPC = 0xF000;
    this.regSP = 0x0;
    
    this.instTStates = 0;
}

Z80.prototype.run = function() {
    console.log("starting CPU...");
    
    while (true) {
        console.log(this.toString());
        this.step();
    }
}

/**
 * see http://www.z80.info/decoding.htm
 */
Z80.prototype.step = function() {
    var op = this.nextByte();
    var x = (op >> 6) & 0x03;
    var y = (op >> 3) & 0x07;
    var z = op & 0x07;
    var p = (y >> 1) & 0x3;
    var q = y & 0x01;
    
    switch (op) {
        /* prefix bytes */
        case 0xcb: case 0xdd: case 0xed: case 0xfd:
            throw "prefixed instruction";
            break;
    }
    
    switch (x) {
        case 0:
            switch (z) {
                case 1:
                    if (q == 0) {
                        /* LD rp[p], nn */
                        this.writeRegPairImm(p);
                        
                        
                        
                    } else {
                        
                    }
                    
                    return;
            }
            
            throw "internal error";
            
        case 3:
            switch (z) {
                case 3:
                    switch (y) {
                        case 0: /* JP nn */
                            this.regPC = this.nextWord();
                            this.instTStates += 10;
                            return;
                            
                        case 6: /* DI */
                            this.iff1 = false;
                            this.iff2 = false;
                            this.lastInstWasEIorDI = true;
                            this.instTStates += 4;
                            return;
                            
                    }
                    
                    throw "internal error";
                    
                case 5:
                    if (q == 0) {
                        
                    } else {
                        /* CALL nn */
                        var nn = this.nextWord();
                        this.push(this.regPC);
                        this.regPC = nn;
                        this.instTStates += 17;
                        return;
                    }
            }
    }

    throw ("unknown opcode 0x" + op.toString(2) +
           " (x=" + x + ", y=" + y + ", z=" + z + ")");
}

Z80.prototype.push = function(val) {
    this.regSP = (this.regSP - 1) & 0xffff;
    this.mem.writeByte(this.regSP, val >> 8);
    this.regSP = (this.regSP - 1) & 0xffff;
    this.mem.writeByte(this.regSP, val & 0xff);
}

/**
 * Write register pair with immediate value.
 */
Z80.prototype.writeRegPairImm = function(r) {
    var val = this.nextWord();
    
    switch (r) {
        case 3:
            this.regSP = val;
            break;
            
        default:
            throw "illegal register " + r;
    }
    
    this.instTStates += 10;
}

Z80.prototype.nextByte = function() {
    var result = this.mem.getByte(this.regPC);
    this.regPC = (this.regPC + 1) & 0xFFFF;
    return (result & 0xff);
}

Z80.prototype.nextWord = function() {
    var lo = this.nextByte();
    var hi = this.nextByte();
    return ((hi << 8) | lo) & 0xffff;
}

Z80.prototype.toString = function() {
    return "Z80 {PC=0x" + this.regPC.toString(16) +
        ", SP=0x" + this.regSP.toString(16) +
        "}";
}
