
function IOSys() {
    
}

IOSys.prototype.readByte = function(port) {
//    console.log("read io from 0x" + port.toString(16));
    
    return 0xff;
}

IOSys.prototype.writeByte = function(port, val) {
//    console.log("write to io port 0x" + port.toString(16)
//        + "(0x" + val.toString(16) + ")");
}