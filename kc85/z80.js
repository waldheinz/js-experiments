
var BIT = [1, 2, 4, 8, 16, 32, 64, 128]

function Z80(mem) {
    this.mem = mem;
    
    /* registers */
    this.regA = 0x0;
    this.regB = 0x0;
    this.regC = 0x0;
    this.regD = 0x0;
    this.regE = 0x0;
    
    this.regPC = 0x0; /* program counter */
    this.regSP = 0x0; /* stack pointer */
    
    /* flags */
    this.flag = {
        sign    : false,
        zero    : false,
        half    : false,
        n       : false,
        carry   : false,
        three   : false,
        five    : false
    }
    
    /* internal state */
    this.instTStates = 0;
    
    this.reset();
}

Z80.prototype.reset = function() {
    console.log("CPU reset");
    
    this.regA = 0x0;
    this.regB = 0x0;
    this.regC = 0x0;
    this.regD = 0x0;
    this.regE = 0x0;
    
    this.regPC = 0xF000;
    this.regSP = 0x0;
    
    this.flag = {
        sign    : false,
        zero    : false,
        half    : false,
        n       : false,
        carry   : false,
        three   : false,
        five    : false
    }
    
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
                        throw "unimplemented";
                    }
                    
                    return;
                    
                case 4:
                    /* 8-bit INC */
                    this.setReg(y, this.getReg(y) + 1);
                    return;
            }
            
            break;
            
        case 2:
            /* ALU operations */
            this.doALU(y, this.getReg(z));
            return;
            
        case 3:
            switch (z) {
//                case 0:
//                    /* RET cc[y] (conditional return) */
//                    switch (y) {
//                        
//                    }
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

/**
 * Reads a 8-bit register.
 */
Z80.prototype.getReg = function(r) {
    switch (r) {
        case 0  : return this.regB;
        case 7  : return this.regA;
        default : throw "unknown register " + r;
    }
}

/**
 * Writes a 8-bit register.
 */
Z80.prototype.setReg = function(r, val) {
    val = val & 0xff;
    
    switch (r) {
        case 0 : this.regB = val; break;
        default : throw "unknown register " + r;
    }
}

Z80.prototype.doALU = function(op, val) {
    switch(op) {
        case 5: /* XOR */
            this.regA       = (this.regA ^ val) & 0xFF;
            this.flag.sign  = ((this.regA & BIT[7]) != 0);
            this.flag.zero  = (this.regA == 0);
            this.flag.half  = false;
            this.flag.n     = false;
            this.flag.carry = false;
            this.flag.five  = ((this.regA & BIT[5]) != 0);
            this.flag.three = ((this.regA & BIT[3]) != 0);
            
            break;
            
        default:
            throw "unknown op " + op;
    }
}

/**
 * Push a word onto the stack.
 */
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
        case 0:
            /* BC */
            this.regB = (val >> 8) & 0xFF;
            this.regC = val & 0xFF;
            break;
            
        case 1:
            /* DE */
            this.regD = (val >> 8) & 0xFF;
            this.regE = val & 0xFF;
            break;
            
        case 3:
            /* SP */
            this.regSP = val;
            break;
            
        default:
            throw "illegal register pair " + r;
    }
    
    this.instTStates += 20;
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
        ", A=0x" + this.regA.toString(16) +
        ", B=0x" + this.regB.toString(16) +
        ", C=0x" + this.regC.toString(16) +
        ", D=0x" + this.regD.toString(16) +
        ", E=0x" + this.regE.toString(16) +
        "}";
}
