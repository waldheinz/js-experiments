
function IOSys() {
    
}

IOSys.prototype.readByte = function(port) {
    console.log("read io from 0x" + port.toString(16));
    
    return 0xff;
}
