
var BIT = [1, 2, 4, 8, 16, 32, 64, 128]

function Z80(mem, iosys) {
    this.mem = mem;
    this.iosys = iosys;
    
    /* registers */
    this.regA = 0x0;
    this.regB = 0x0;
    this.regC = 0x0;
    this.regD = 0x0;
    this.regE = 0x0;
    this.regH = 0x0;
    this.regL = 0x0;
    
    this.regPC = 0x0; /* program counter */
    this.regSP = 0x0; /* stack pointer */
    
    /* flags */
    this.flag = {
        sign    : false, /* set if the 2-complement value is negative (copy of MSB) */
        zero    : false, /* set if the value is zero */
        half    : false, /* half carry, carry from bit 3 to bit 4 */
        pv      : false, /* parity or overflow, parity set if even number of bits set; overflow set if the 2-complement result does not fit in the register */
        n       : false, /* subtract, set if the last operation was a subtraction */
        carry   : false, /* set if the result did not fit in the register */
        three   : false, /* undocumented, copy of bit 3 */
        five    : false  /* undocumented, copy of bit 5 */
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
    this.regH = 0x0;
    this.regL = 0x0;
    
    this.regPC = 0xF000;
    this.regSP = 0x0;
    
    this.flag = {
        sign    : false,
        zero    : false,
        half    : false,
        pv      : false,
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
    
    /* prefix bytes */
    switch (op) {
        case 0xed:
            this.stepPrefixED();
            return;
            
        case 0xcb: case 0xdd: case 0xfd:
            throw "prefixed instruction";
    }
    
    switch (x) {
        case 0:
            switch (z) {
                case 0:
                    if (y >= 4 && y <= 7) {
                        /* relative conditional jump (JR cc[y-4], d */
                        var d = this.nextByte();
                        
                        if (this.testCondition(y - 4)) {
                            this.doJmpRel(d);
                            this.instTStates += 12;
                        } else {
                            this.instTStates += 7;
                        }
                        
                        return;
                    }
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
                    this.setReg(y, this.instInc8(this.getReg(y)));
                    return;
                    
                case 6:
                    /* 8-bit load immediate */
                    this.setReg(y, this.nextByte());
                    return;
            }
            
            break;
            
        case 1:
            if (z != 6) {
                /* 8-bit loading LD r[y], r[z] */
                this.setReg(y, this.getReg(z));
                this.instTStates += 4;
            } else {
                throw "unimplemented";
            }
            
        case 2:
            /* ALU operations */
            this.doALU(y, this.getReg(z));
            return;
            
        case 3:
            switch (z) {
                case 0:
                    /* RET cc[y] (conditional return) */
                    if (this.testCondition(y)) {
                        this.regPC = this.pop();
                        this.instTStates += 11;
                    } else {
                        this.instTStates += 5;
                    }
                            
                    return;
                    
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
                    
                case 4: /* conditional CALL */
                    var nn = this.nextWord();
                    
                    if (this.testCondition(y)) {
                        this.push(this.regPC);
                        this.regPC = nn;
                        this.instTStates += 17;
                    } else {
                        this.instTStates += 10;
                    }
                    
                    return;
                    
                case 5:
                    if (q == 0) {
                        throw "unimplemented";
                    } else {
                        /* CALL nn */
                        nn = this.nextWord();
                        this.push(this.regPC);
                        this.regPC = nn;
                        this.instTStates += 17;
                        return;
                    }
            }
    }

    throw ("unknown opcode 0x" + op.toString(16) +
           " (x=" + x + ", y=" + y + ", z=" + z + ")");
}

Z80.prototype.stepPrefixED = function() {
    var op = this.nextByte();
    var x = (op >> 6) & 0x03;
    var y = (op >> 3) & 0x07;
    var z = op & 0x07;
    var q = y & 0x01;
    
    switch (x) {
        case 0: case 3:
            throw "unimplemented invalid";
            
        case 1:
            switch (z) {
                case 0:
                    /* input from port with 16-bit address */
                    if (y != 6) {
                        this.setReg(y, this.readPort());
                        this.instTStates += 12;
                        return;
                    } else {
                        throw "unimplemented";
                    }
            }
    }
    
    throw ("unknown opcode 0xED" + op.toString(16) +
           " (x=" + x + ", y=" + y + ", z=" + z + ")");
}

Z80.prototype.doJmpRel = function(off) {
    this.regPC = computeRelAddr(this.regPC, off);
}

Z80.prototype.readPort = function() {
    var result = this.iosys.readByte((this.regB << 8) | this.regC);
    this.flag.sign  = ((result & BIT[7]) != 0);
    this.flag.zero  = (result == 0);
    this.flag.half  = false;
    this.flag.n     = false;
    this.flag.five  = ((result & BIT[5]) != 0);
    this.flag.three = ((result & BIT[3]) != 0);
    this.updateParity(result);
    return result;
}

Z80.prototype.testCondition = function(c) {
    switch (c) {
        case 0  :return !this.flag.zero;
        case 1  :return this.flag.zero;
        default :throw "unknown condition " + c;
    }
}

/**
 * Reads a 8-bit register.
 */
Z80.prototype.getReg = function(r) {
    switch (r) {
        case 0  :return this.regB;
        case 1  :return this.regC;
        case 2  :return this.regD;
        case 3  :return this.regE;
        case 4  :return this.regH;
        case 5  :return this.regL;
        case 7  :return this.regA;
        default :throw "read from unknown register " + r;
    }
}

/**
 * Returns the contents of the H and L registers as one 16-bit value.
 */
Z80.prototype.getRegHL = function() {
    return ((this.regH << 8) | this.regL) & 0xFFFF;
}

/**
 * Writes a 8-bit register.
 */
Z80.prototype.setReg = function(r, val) {
    val = val & 0xff;
    
    switch (r) {
        case 0  :this.regB = val;break;
        case 3  :this.regE = val;break;
        case 4  :this.regH = val;break;
        case 5  :this.regL = val;break;
        case 6  : /* writes to (HL) in memory */
            this.mem.writeByte(this.getRegHL(), val);
            this.instTStates += 3;
            break;
        case 7  :this.regA = val;break;
        default :throw "write to unknown register " + r;
    }
}

Z80.prototype.doALU = function(op, val) {
    switch(op) {
        case 0: /* ADD */
            this.instAdd8(op, 0);
            break;
            
        case 4: /* AND */
            this.regA       = (this.regA & val) & 0xFF;
            this.flag.sign  = ((this.regA & BIT[7]) != 0);
            this.flag.zero  = (this.regA == 0);
            this.flag.half  = true;
            this.flag.n     = false;
            this.flag.carry = false;
            this.flag.five  = ((this.regA & BIT[5]) != 0);
            this.flag.three = ((this.regA & BIT[3]) != 0);
            this.updateParity(this.regA);
            break;
            
        case 5: /* XOR */
            this.regA       = (this.regA ^ val) & 0xFF;
            this.flag.sign  = ((this.regA & BIT[7]) != 0);
            this.flag.zero  = (this.regA == 0);
            this.flag.half  = false;
            this.flag.n     = false;
            this.flag.carry = false;
            this.flag.five  = ((this.regA & BIT[5]) != 0);
            this.flag.three = ((this.regA & BIT[3]) != 0);
            this.updateParity(this.regA);
            break;
            
        case 6: /* OR */
            this.regA       = (this.regA | val) & 0xFF;
            this.flag.sign  = ((this.regA & BIT[7]) != 0);
            this.flag.zero  = (this.regA == 0);
            this.flag.half  = false;
            this.flag.n     = false;
            this.flag.carry = false;
            this.flag.five  = ((this.regA & BIT[5]) != 0);
            this.flag.three = ((this.regA & BIT[3]) != 0);
            this.updateParity(this.regA);
            break;
            
        case 7: /* CP */
            var result = this.regA - val;
            var m      = this.regA ^ val ^ result;

            this.flag.sign  = ((result & BIT[7]) != 0);
            this.flag.zero  = ((result & 0xFF) == 0);
            this.flag.five  = ((val & BIT[5]) != 0);
            this.flag.half  = ((m & 0x10) != 0);
            this.flag.three = ((val & BIT[3]) != 0);
            this.flag.pv    = ((((m >> 1) ^ m) & 0x80) != 0);
            this.flag.n     = true;
            this.flag.carry = ((m & 0x100) != 0);
            break;
            
        default:
            throw "unknown op " + op;
    }
}

/**
 * Calculates and updates the parity flag.
 */
Z80.prototype.updateParity = function(val) {
    var cnt = 0; /* number of 1s */
    
    while (val != 0) {
        cnt++;
        val &= (val - 1);
    }
    
    this.flag.pv = (cnt & 1);/* if cnt is odd LSB is 1 */ 
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

Z80.prototype.pop = function() {
    var result = this.mem.getByte(this.regSP);
    this.regSP = (this.regSP + 1) & 0xFFFF;
    result |= (this.mem.getByte(this.regSP) << 8);
    this.regSP = (this.regSP + 1) & 0xFFFF;
    return result;
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
            
        case 2:
            this.regH = (val >> 8) & 0xFF;
            this.regL = val & 0xFF;
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

/**
 * Performs an 8-bit increment, updates the flags and returns the result.
 */
Z80.prototype.instInc8 = function(value) {
    /* determine half-carry flag */
    var result = (value & 0x0f) + 1;
    this.flag.half = ((result & 0xFFFFFFF0) != 0);
    
    /* perform calculation */
    result          = (value & 0xff) + 1;
    this.flag.sign  = ((result & BIT[7]) != 0);
    this.flag.zero  = ((result & 0xff) == 0);
    this.flag.pv    = (result != (result & 0xff));
    this.flag.n     = false;
    this.flag.five  = ((result & BIT[5]) != 0);
    this.flag.three = ((result & BIT[3]) != 0);
    
    return result & 0xff;
}

Z80.prototype.instAdd8 = function(op2, op3) {
    var result = this.regA + op2 + op3;
    var m      = this.regA ^ op2 ^ result;

    this.flag.sign  = ((result & BIT[7]) != 0);
    this.flag.zero  = ((result & 0xFF) == 0);
    this.flag.five  = ((result & BIT[5]) != 0);
    this.flag.half  = ((m & 0x10) != 0);
    this.flag.three = ((result & BIT[3]) != 0);
    this.flag.pv    = ((((m >> 1) ^ m) & 0x80) != 0);
    this.flag.n     = false;
    this.flag.carry = ((m & 0x100) != 0);
    this.regA       = result & 0xFF;
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
        ", H=0x" + this.regH.toString(16) +
        ", L=0x" + this.regL.toString(16) +
        "}";
}

/**
 * Find the relative address given a base and an offset. The offset is
 * interpreted as an 8-bit signed value (-128 .. +127).
 */
function computeRelAddr(base, off) {
    if ((off & BIT[7]) != 0) {
        off = (off & 0x7f) - 128;
    }
    
    return ((base + off) & 0xffff);
}
