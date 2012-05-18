
function TeleDisk(url) {
    this.url = url;
    this.sides = 0;
}

TeleDisk.prototype.isReadOnly = function() {
    return true;
}

TeleDisk.prototype.log = function(message) {
    console.log("disk: " + message);
}

TeleDisk.prototype.load = function(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url);
    xhr.responseType = 'arraybuffer';
    var that = this;
    xhr.onload = function() {
        if (this.status == 0 || this.status == 200) {
            var data = new Uint8Array(this.response);
            that.log(that.url + " loaded (" + data.length + " bytes)");
            that.parse(new Stream(data));
            cb();
        } else {
            console.log("unexpected status code " + this.status);
        }
    }
    
    xhr.send();
}

TeleDisk.prototype.checkHeader = function(is) {
    var head0 = is.nextByte();
    var head1 = is.nextByte();
    var head2 = is.nextByte();
    
    if (String.fromCharCode(head0, head1) == "td") {
        throw "advanced compression not supported";
    } else if ((String.fromCharCode(head0, head1) != "TD") || head2 != 0) {
        throw "missing magic bytes TD";
    }
    
    is.skipByte();
    var version = is.nextByte();
    
    if (version != 0x15) {
        throw "version 0x" + version.toString(16) + " not supported";
    }
    
    is.skipBytes(2);
    var hasRemark = (is.nextByte() & 0x80) != 0;
    is.skipByte();
    var sideCount = is.nextByte();
    is.skipBytes(2); /* CRC */
    
    if ((sideCount < 1) || (sideCount > 2)) {
        throw "only support one or two sides, but found " + this.sides;
    }
    
    this.sides = new Array(sideCount);
    
    for (var i=0; i < sideCount; i++) {
        this.sides[i] = [];
    }
    
    if (hasRemark) {
        is.skipBytes(2); /* CRC */
        var len = is.nextWord();
        var year = is.nextByte() + 1900;
        var month = is.nextByte() + 1;
        var day = is.nextByte();
        var hour = is.nextByte();
        var minute = is.nextByte();
        var second = is.nextByte();
        var remark = "";
        
        while (len > 0) {
            var ch = is.nextByte();
            
            if ((ch <= 0x20) || (ch >= 0x7F)) {
                ch = 0x20;
            }
            
            remark += String.fromCharCode(ch);
            len--;
        }
        
        this.log("remark \"" + remark + "\"");
        this.log("created on " + day + "." + month + "." + year + ", " +
            hour + ":" + minute + ":" + second);
    } else {
        this.log("disk image has no remark section");
    }
}

TeleDisk.prototype.readSector = function(is, secBuf) {
    var len = is.nextWord();
    
    if (len > 0) {
        var encoding = is.nextByte();
        var pos = 0;
        len--;
        
        switch (encoding) {
            case 0:
                while ((len > 0) && (pos < secBuf.length)) {
                    secBuf[pos++] = is.nextByte();
                    len--;
                }
                break;
                
            case 1:
                if (len >= 4) {
		    var n  = is.nextWord();
		    var b0 = is.nextByte();
		    var b1 = is.nextByte();
		    len -= 4;
                    
		    while ((n > 0) && (pos < secBuf.length)) {
                        secBuf[pos++] = b0;
                        secBuf[pos++] = b1;
                        n--;
		    }
                }
                break;
                
            case 2:
                while (len >= 2) {
                    var t = is.nextByte();
                    n = is.nextByte();
                    len -= 2;
                    
                    switch (t) {
                        case 0:
                            while ((len > 0) && (n > 0) &&
                                (pos < secBuf.length)) {
                                   
                                secBuf[pos++] = is.nextByte();
                                len--;
                                n--;
                            }
                            
                            if (n > 0) {
                                throw "length mismatch " + n;
                            }
                            
                            break;

                        case 1:
                            if (len >= 2) {
                                b0 = is.nextByte();
                                b1 = is.nextByte();
                                len -= 2;
                                
                                while ((n > 0) && (pos < secBuf.length)) {
                                    secBuf[pos++] = b0;
                                    secBuf[pos++] = b1;
                                    n--;
                                }
                            }
                            break;
                            
                        default:
                            throw "unknown sector encoding 0x" + t.toString(16);
                    }
                }
                break;
                
            default:
                throw "unknown sector encoding 0x" + encoding.toString(16);
        }
        
        if (len > 0) {
            throw "we have " + len + " bytes remaining";
        }
    }
}

TeleDisk.prototype.parseTracks = function(is) {
    var sectorSize = 0;
    
    while (true) {
        var secCount = is.nextByte();
        var track = is.nextByte();
        var head = is.nextByte();
        is.skipByte();
        
        if ((secCount == 0xFF) || (secCount == -1) ||
            (track == -1) || (head == -1)) {
            
            break;
        }
        
        if ((head < 0) || (head > 1)) {
            throw "suspicious head " + head;
        }
        
        for (var i=0; i < secCount; i++) {
            var secTrack    = is.nextByte();
            var secHead     = is.nextByte();
            var secNum      = is.nextByte();
            var secSizeCode = is.nextByte();
            var secCtrl     = is.nextByte();
            is.skipByte(); /* CRC */
            
            var secBuf = null;
            
            if ((secSizeCode >= 0) && (secSizeCode <= 5)) {
                var secSize = 128 << secSizeCode;
                
                secBuf = new Uint8Array(secSize);
                
                if( sectorSize == 0 ) {
                    sectorSize = secSize;
                }
            } else {
                throw "sector size code 0x" + secSizeCode.toString(16) +
                    " not supported"
            }
            
            var crcError = ((secCtrl & 0x02) != 0);
            var deleted  = ((secCtrl & 0x04) != 0);
            
            if ((secCtrl & 0x30) == 0) {
                this.readSector(is, secBuf);
            } else {
                throw "up";
            }
            
            var side = this.sides[secHead];
            
            if (side[secTrack] === undefined) {
                side[secTrack] = [];
            }
            
            side[secTrack].push(new Sector(secBuf, crcError, deleted));
        }
    }
}

TeleDisk.prototype.parse = function(is) {
    this.checkHeader(is);
    this.parseTracks(is);
}

Sector = function(data, crcError, deleted) {
    this.data = data;
    this.crcError = crcError;
    this.deleted = deleted;
}

/**
 * Wraps an array so it can be used like a stream.
 */
Stream = function(arr) {
    this.arr = arr;
    this.pos = 0;
}

Stream.prototype.nextByte = function() {
    return this.arr[this.pos++];
}

Stream.prototype.nextWord = function() {
    var b0 = this.nextByte();
    var b1 = this.nextByte();
    return (b1 << 8) | b0;
}

Stream.prototype.skipByte = function() {
    this.pos++;
}

Stream.prototype.skipBytes = function(cnt) {
    this.pos += cnt;
}
