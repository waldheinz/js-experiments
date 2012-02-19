
/**
 * Creates a new IRM instance using the specified element as screen container.
 */
function IRM(contElem) {
    this.data = new Uint8Array(16 * 1024);
    this.dirty = true;
}

IRM.prototype.writeByte = function(addr, val) {
    if (addr < this.data.length) {
        throw "ooo";
        this.data[addr] = val;
    }
}

IRM.prototype.getByte = function(addr) {
    return this.data[addr] & 0xff;
}
