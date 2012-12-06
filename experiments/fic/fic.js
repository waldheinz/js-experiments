
function Block() {
    this.pos = [];
    this.channel = -1;
    this.transform = 0;
    
    this.brightness = 0;
    this.contrast = 1;
    
    this.error = Number.POSITIVE_INFINITY;
}

/* common code for encoder and decoder */

function createMipMap(image, minSize) {
    var mip = image.makePowerOfTwo();
    var mipmap = [];
    
    while (mip.width > minSize) {
        mip = mip.halfSize();
        //        this.log("created " + mip);
        mipmap.unshift(mip);
    }
    
    return mipmap;
}

function extractStats(fimg) {
    var bcount = 0;
    var errSum = 0;
    var errMin = Number.POSITIVE_INFINITY;
    var errMax = 0;
    
    for (var c=0; c < fimg.channels.length; c++) {
        var chn = fimg.channels[c];
        
        for (var x=0; x < chn.length; x++) {
            var col = chn[x];
            
            for (var y=0; y < col.length; y++) {
                var b = col[y];
                
                if (b.error < 0) {
                    throw "negative error found";
                }
                
                bcount++;
                errSum += b.error;
                errMin = Math.min(errMin, b.error);
                errMax = Math.max(errMax, b.error);
            }
        }
    }
    
    return [errMin, errSum / bcount, errMax];
}

function Decoder(comp, enlarge) {
    if (!comp) {
        throw "no data given";
    }
    
    this.blocks = comp.channels;
    this.blocksX = this.blocks[0].length;
    this.blocksY = this.blocks[0][0].length;
    this.size = 1 << (comp.sizeExp + enlarge);
    this.image = createImage(
        this.size * this.blocksX,
        this.size * this.blocksY,
        comp.channelCount);
}

Decoder.prototype.extract = function(ranges, pos, channel) {
    var sx = 0;
    var sy = 0;
    var d = this.size;
    
    for (var i=0; i < pos.length; i++) {
        sx <<= 1;
        sy <<= 1;
        
        switch (pos[i]) {
            case 0: /* top left */
                continue;
                    
            case 1: /* top right */
                sx += d;
                continue;
                    
            case 2: /* bottom left */
                sy += d;
                continue;
                    
            case 3: /* bottom right */
                sx += d;
                sy += d;
                continue;
                    
            default:
                throw "illegal pos " + pos[i];
        }
    }
    
    return ranges[pos.length].copy(sx, sy, this.size, this.size, channel);
}

Decoder.prototype.onePass = function() {
    var ranges = createMipMap(this.image, this.size);
    
    for (var c=0; c < this.image.channelCount(); c++) {
        for (var blockY=0; blockY < this.blocksY; blockY++) {
            var destY = this.size * blockY;

            for (var blockX=0; blockX < this.blocksX; blockX++) {
                var destX = this.size * blockX;
                var block = this.blocks[c][blockX][blockY];
                var tile = this.extract(ranges,
                    block.pos, block.channel);

                tile.transform(block.transform);
                tile.adjust(block.brightness, block.contrast);
                
                this.image.blit(tile, 0, c, destX, destY);
            }
        }
    }
}

/**
* creates a new encoder of specified domain size.
*/
function Encoder(image, sizeExp, listener) {
    this.channels = image.splitChannels();
    this.channelCount = image.channelCount();
    this.sizeExp = parseInt(sizeExp);
    this.domainSize = 1 << sizeExp;
    this.listener = listener;
    this.width = image.width;
    this.height = image.height;
    this.domainsX = Math.ceil(this.width / this.domainSize);
    this.domainsY = Math.ceil(this.height / this.domainSize);
    
    this.domains = [];
    this.data = this.emptyData();
    this.ranges = [];
    this.log("created encoder (ds=" + this.domainSize +
        ", dx=" + this.domainsX + ", dy=" + this.domainsY + ")");
}

Encoder.prototype.log = function(message) {
    if (this.listener && this.listener.onmessage) {
        this.listener.onmessage(message);
    }
}

Encoder.prototype.progress = function() {
    this.rangesDone++;
    
    if (this.listener && this.listener.onprogress) {
        this.listener.onprogress(this.rangesDone, this.rangeCount);
    }
}

Encoder.prototype.progressImage = function() {
    
    if (this.listener && this.listener.onImageProgress) {
        this.listener.onImageProgress(this.data);
    }
}

Encoder.prototype.encode = function() {
    this.log("preparing encode");
    
    for (var c=0; c < this.channelCount; c++) {
        this.ranges.push(createMipMap(this.channels[c], this.domainSize));
        
        var dom = [];
        for (var domainX=0; domainX < this.domainsX; domainX++) {
            var imgCol = [];
        
            for (var domainY=0; domainY < this.domainsY; domainY++) {
                var left = domainX * this.domainSize;
                var top = domainY * this.domainSize;
            
                var img = this.channels[c].copy(
                    left, top, this.domainSize, this.domainSize);
            
                imgCol.push(img);
            }
        
            dom.push(imgCol);
        }
        
        this.domains.push(dom);
    }
    
    
    this.log("starting compression");
    
    /* for progress reporting */
    this.rangeCount = 0;
    
    for (var i=0; i < this.ranges[0].length; i++) {
        this.rangeCount += Math.pow(4, i);
    }
    
    this.rangesDone = 0;
    
    this.encodeRec([], 0, 0);
    
    return this.data;
}

Encoder.prototype.encodeRec = function(pos, offX, offY) {
    /* test the transforms of this range */
    
    for (var c=0; c < this.channelCount; c++) {
        var mip = this.ranges[c][pos.length];
        
        var range = mip.copy(offX, offY, this.domainSize, this.domainSize);
        this.checkDomains(range, pos, c);
    }
    
//    this.log("pos " + pos);
    this.progress();
    this.progressImage();
    
    /* recurse for the four possible splits */
    if (this.ranges[0].length > (pos.length + 1)) {
        this.encodeRec(pos.slice(0, pos.length).concat(0),
            offX * 2, offY * 2);
        
        this.encodeRec(pos.slice(0, pos.length).concat(3),
            offX * 2 + this.domainSize, offY * 2 + this.domainSize);
        
        this.encodeRec(pos.slice(0, pos.length).concat(1),
            offX * 2 + this.domainSize, offY * 2);
        
        this.encodeRec(pos.slice(0, pos.length).concat(2),
            offX * 2, offY * 2 + this.domainSize);
        
    }
}

Encoder.prototype.checkDomains = function(range, pos, rChn) {
    for (var dChn=0; dChn < this.channelCount; dChn++) {
        for (var domainY=0; domainY < this.domainsY; domainY++) {
            for (var domainX=0; domainX < this.domainsX; domainX++) {
                var d = this.data.channels[dChn][domainX][domainY];
                
                if (d.error < 1) {
                    continue;
                }
                
                var domain = this.domains[dChn][domainX][domainY];
                
                for (var trans=0; trans < Image.TRANSFORM_COUNT; trans++) {
                    var r = range.copy(0, 0, this.domainSize, this.domainSize);
                    r.transform(trans);
                    var m = domain.match(r);
                    
                    var error = m[0];
                    
                    if (error < d.error) {
                        d.brightness = m[1];
                        d.contrast = m[2];
                        d.pos = pos;
                        d.channel = rChn;
                        d.error = error;
                        d.transform = trans;
                        d.posX = domainX;
                        d.posY = domainY;
                    }
                }
            }
        }
    }
}

Encoder.prototype.emptyData = function() {
    var data = [];
    
    for (var c=0; c < this.channelCount; c++) {
        var domains = new Array();
    
        for (var blockX=0; blockX < this.domainsX; blockX++) {
            var line = new Array();
            domains.push(line);

            for (var blockY=0; blockY < this.domainsY; blockY++) {
                line.push(new Block());
            }
        }
        
        data.push(domains);
    }
    
    return {
        sizeExp : this.sizeExp,
        channelCount : this.channelCount,
        channels : data
    };
}
 