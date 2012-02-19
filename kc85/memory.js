
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
}

RAM.prototype.writeByte = function(addr, val) {
    if (addr < this.data.length) {
        this.data[addr] = val;    
    }
}

RAM.prototype.getByte = function(addr) {
    if (addr < this.data.length) {
        return this.data[addr] & 0xff;
    } else {
        return 0xff;
    }
}

function Memory(irm) {
    this.caos = new ROM('roms/caos31_e000.bin');
    this.ram = new RAM(16 * 1024);
    this.irm = irm;
    
    this.count = 1;
}

Memory.prototype.onload = function(cb) {
    var that = this;
    
    return function() {
        that.count--;
    
        if (that.count == 0) {
            console.log("all ROM files loaded.");
            cb();
        }
    }
}

Memory.prototype.load = function(cb) {
    console.log("loading ROM files...");
    this.caos.load(this.onload(cb));
}

Memory.prototype.getByte = function(addr) {
    if (addr >= 0xe000) {
        return this.caos.getByte(addr - 0xe000);
    } else if (addr >= 0x8000 && addr < 0xc000) {
        return this.irm.getByte(addr - 0x8000);
    } else {
        return this.ram.getByte(addr);
    }
}

Memory.prototype.writeByte = function(addr, val) {
    val = val & 0xff;
    
    if (addr >= 0x8000 && addr < 0xc000) {
        this.irm.writeByte(addr - 0x8000, val);
    } else {
        this.ram.writeByte(addr, val);
    }
}
