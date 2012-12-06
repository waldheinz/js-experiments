
Keyboard = function(sioPort) {
    this.sioPort = sioPort;
}

Keyboard.prototype.log = function(message) {
    console.log("keyboard: " + message);
}

Keyboard.prototype.keyDown = function(key) {
//    this.log(key + " down");
    this.sioPort.receivedByte(key);
}

Keyboard.prototype.keyUp = function(key) {
    this.log(key + " up");
}
