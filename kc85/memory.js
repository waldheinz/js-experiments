
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
    if (addr > this.data.length) {
        throw "address out of bounds";
    } 
    
    this.data[addr] = val;
}

RAM.prototype.getByte = function(addr) {
    return this.data[addr] & 0xff;
}

function Memory() {
    this.caos = new ROM('roms/caos34.853');
    this.ram = new RAM(32 * 1024);
    
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
    } else {
        return this.ram.getByte(addr);
    }
}

Memory.prototype.writeByte = function(addr, val) {
    val = val & 0xff;
    this.ram.writeByte(addr, val);
}
