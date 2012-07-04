
function ROM(resName) {
    this.resName = resName;
    this.ready = false;
    this.data = null;
}

ROM.prototype.load = function(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.resName);
    xhr.responseType = 'arraybuffer';
    var that = this;
    xhr.onload = function() {
        if (this.status == 0 || this.status == 200) {
            that.data = new Uint8Array(this.response);
            console.log(that.resName + " loaded (" + that.data.length + " bytes)");
            
            cb();
        } else {
            console.log("unexpected status code " + this.status);
        }
    }
    
    xhr.send();
}

ROM.prototype.getByte = function(addr) {
    return this.data[addr];
}

function RAM(size) {
    this.data = new Uint8Array(size);
    for (var i=0; i < this.data.length; i++) {
        this.data[i] = Math.random() * 255;
    }
    this.init = new Uint8Array(size);
    for (i=0; i < this.data.length; i++) {
        this.init[i] = 0;
    }
}

RAM.prototype.writeByte = function(addr, val) {
    if (addr < this.data.length) {
        this.data[addr] = val;    
        this.init[addr] = 1;
    }
}

RAM.prototype.getByte = function(addr) {
    if (addr < this.data.length) {
        if (this.init[addr] == 0) throw "uninitialized read from 0x" + addr.toString(16);
        return this.data[addr] & 0xff;
    } else {
        return 0xff;
    }
}

function Memory() {
    this.rom = new ROM('roms/mpc_e82cc1a2.rom');
    this.ram = new RAM(64 * 1024);
    this.romAt0 = true;
    
    /* we will load the ROM */
    this.roms = [this.rom];
    this.nextRom = 0;
}

Memory.prototype.ioWrite = function() {
    if (this.romAt0) {
        console.log("mem: disable ROM at 0x0");
        this.romAt0 = false;
    }
}

Memory.prototype.onload = function(cb) {
    var that = this;
    
    return function() {
        that.nextRom++;
        
        if (that.nextRom == that.roms.length) {
            console.log("all ROM files loaded.");
            cb();
        } else {
            that.roms[that.nextRom].load(that.onload(cb));
        }
    }
}

Memory.prototype.load = function(cb) {
    console.log("loading ROM files...");
    this.roms[this.nextRom].load(this.onload(cb));
}

Memory.prototype.getByte = function(addr) {
    if (this.romAt0 && addr < 0x1000) {
        return this.rom.getByte(addr);
    } else if (addr >= 0xc000 && addr < 0xd000){
        return this.rom.getByte(addr - 0xc000);
    } else {
        return this.ram.getByte(addr);
    }
}

Memory.prototype.writeByte = function(addr, val) {    
//    console.log("MEM write 0x" + addr.toString(16) + " = 0x" + val.toString(16));
    
    if ((this.romAt0 && addr < 0x1000) || (addr >= 0xc000 && addr < 0xd000)) {
        throw "write to ROM at " + addr.toString(16);
    }
    
    val = val & 0xff;
    
    this.ram.writeByte(addr, val);
}
