
function Z80Debug(z80, elem) {
    this.z80 = z80;
    this.breakPoints = [];
    this.running = false;
    this.cpuState = $('<pre>(nothing yet)</pre>');
    this.bpList = $('<pre></pre>');
    this.asciiDump = $('<pre></pre>');
    
    var bpInput = $('<input type="text"></input>', {
        "size" : 4,
        "maxlength" : 4,
        "id" : "bpInput"
    });
    var that = this;
    
    var bpEnter = $('<button></button>', {
        "click" : function() {
            var bp = parseInt(bpInput.val(), 16);
            
            if (!isNaN(bp)) {
                that.breakPoints.push(bp);
                that.updateBreakpoints.call(that);
            }
        }
    });
    
    if (elem) {
        this.cpuState.appendTo(elem);
        this.cpuState.text(this.z80.toString());
        $('<br>').appendTo(elem);
        $('<span>Breakpoints: </span>').appendTo(elem);
        this.bpList.appendTo(elem);
        bpInput.appendTo(elem);
        bpEnter.appendTo(elem);
        this.asciiDump.appendTo(elem);
    }
}

Z80Debug.prototype.start = function() {
    this.running = true;
    var self = this;
    
    setTimeout(function() {
        self.run();
    }, 0);
}

Z80Debug.prototype.stop = function() {
    this.running = false;
}

Z80Debug.prototype.step = function() {
    this.running = false;
    this.z80.step();
    this.cpuState.text(this.z80.toString());
//    this.z80.mem.irm.update();
}

/**
 * Runs the CPU until a breakpoint is hit.
 */
Z80Debug.prototype.run = function() {
    for (var i=0; i < 256 * 4; i++) {
//        this.cpuState.text(this.z80.toString());
        
        if (this.onBP() || !this.running) {
            this.cpuState.text(this.z80.toString());
            return;
        }
        
        this.z80.step();
    }
    
//    this.z80.mem.irm.update();
//    this.asciiDump.text(this.z80.mem.irm.dumpAscii());
    
    var self = this;
    
    setTimeout(function() {
        self.run();
    }, 0);
}

Z80Debug.prototype.reset = function() {
    this.z80.reset();
}

Z80Debug.prototype.updateBreakpoints = function() {
    console.log("up");
    
    var txt = "";
    
    for (var i=0; i < this.breakPoints.length; i++) {
        txt += this.breakPoints[i].toString(16);
        if (i < this.breakPoints.length - 1) {
            txt += ", ";
        }
    }
    
    this.bpList.text(txt)
}

/**
 * Determines if the Z80 PC is currently on a breakpoint.
 */
Z80Debug.prototype.onBP = function() {
    var pc = this.z80.regPC;
    
    for (var i=0; i < this.breakPoints.length; i++) {
        if (pc == this.breakPoints[i]) {
            return true;
        }
    }
    
    return false;
}
