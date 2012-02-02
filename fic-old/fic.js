
function Block() {
    this.color = new Color(0, 0, 0);
    this.pos = [];
    this.transform = 0;
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

function Decoder(comp, image) {
    if (!comp) {
        throw "no data given";
    }
    
    if (!image) {
        throw "no image given";
    }
    
    this.blocks = comp.data;
    this.blocksX = this.blocks.length;
    this.blocksY = this.blocks[0].length;
    this.size = 1 << comp.sizeExp;
    this.image = image;
}

Decoder.prototype.extract = function(ranges, pos) {
    var sx = 0;
    var sy = 0;
    
    for (var i=0; i < pos.length; i++) {
        sx <<= 1;
        sy <<= 1;
        
        var d = this.size;
        
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
    
    return ranges[pos.length].copy(sx, sy, this.size, this.size);
}

Decoder.prototype.onePass = function() {
    var ranges = createMipMap(this.image, this.size);
        
    for (var blockY=0; blockY < this.blocksY; blockY++) {
        var destY = this.size * blockY;
            
        for (var blockX=0; blockX < this.blocksX; blockX++) {
            var destX = this.size * blockX;
            var block = this.blocks[blockX][blockY];
            var tile = this.extract(ranges, block.pos, block.transform);
            
            tile.transform(block.transform);
            tile.colorize(block.color, 0.5);
            
            this.image.draw(tile, destX, destY);
        }
    }
}

/**
* creates a new encoder of specified domain size.
*/
function Encoder(image, sizeExp, listener) {
    this.image = image;
    this.sizeExp = sizeExp;
    this.domainSize = 1 << sizeExp;
    this.listener = listener;
    this.width = image.width;
    this.height = image.height;
    this.domainsX = Math.ceil(this.width / this.domainSize);
    this.domainsY = Math.ceil(this.height / this.domainSize);
    
    this.domains = [];
    this.domainColors = [];
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
    this.log("creating scaled range images");
    
    this.ranges = createMipMap(this.image, this.domainSize);
    
    this.log("created " + this.ranges.length + " versions");
    
    this.log("precomputing domain data");
        
    for (var domainX=0; domainX < this.domainsX; domainX++) {
        var imgCol = [];
        var colorCol = [];
            
        this.domains.push(imgCol);
        this.domainColors.push(colorCol);
        
        for (var domainY=0; domainY < this.domainsY; domainY++) {
            var left = domainX * this.domainSize;
            var top = domainY * this.domainSize;
            
            var img = this.image.copy(
                left, top, this.domainSize, this.domainSize);
            
            imgCol.push(img);
            colorCol.push(img.avgColor());
        }
    }
    
    this.log("starting compression");
    
    /* for progress reporting */
    this.rangeCount =
        (Math.pow(4, this.ranges.length - 1) + 1) * Image.TRANSFORM_COUNT;
    this.rangesDone = 0;
    
    this.encodeRec([], 0, 0);
    
    return this.data;
}

Encoder.prototype.encodeRec = function(pos, offX, offY) {
    /* test the transforms of this range */
    var mip = this.ranges[pos.length];
    
    for (var trans=0; trans < Image.TRANSFORM_COUNT; trans++) {
        var range = mip.copy(offX, offY, this.domainSize, this.domainSize);
        this.checkDomains(range, pos);
        this.progress();
    }
    
    /* recurse for the four possible splits */
    if (this.ranges.length > (pos.length + 1)) {
        this.progressImage();
        
        this.encodeRec(pos.slice(0).concat(0),
            offX * 2, offY * 2);
            
        this.encodeRec(pos.slice(0).concat(1),
            offX * 2 + this.domainSize, offY * 2);
        
        this.encodeRec(pos.slice(0).concat(2),
            offX * 2, offY * 2 + this.domainSize);
        
        this.encodeRec(pos.slice(0).concat(3),
            offX * 2 + this.domainSize, offY * 2 + this.domainSize);
    }
}

Encoder.prototype.checkDomains = function(range, pos) {
    for (var domainY=0; domainY < this.domainsY; domainY++) {
        for (var domainX=0; domainX < this.domainsX; domainX++) {
            var d = this.data.data[domainX][domainY];
            
            if (d.error == 0) {
                continue;
            }
            
            var domain = this.domains[domainX][domainY];
            var dc = this.domainColors[domainX][domainY];
            var rc = range.avgColor();
            
            var dcWeight = 2;
            var rcWeight = 1;
            
            var sr = (dcWeight * dc.red - rcWeight * rc.red);
            var sg = (dcWeight * dc.green - rcWeight * rc.green);
            var sb = (dcWeight * dc.blue - rcWeight * rc.blue);
            var shift = new Color(sr, sg, sb);
            
            for (var trans=0; trans < Image.TRANSFORM_COUNT; trans++) {
                var r = range.copy(0, 0, this.domainSize, this.domainSize);
                r.transform(trans);
                r.colorize(shift, 0.5);
                
                var error = domain.difference(r, d.error);
                
                if (error < d.error) {
                    d.color = shift;
                    d.pos = pos;
                    d.error = error;
                    d.transform = trans;
                    d.posX = domainX;
                    d.posY = domainY;
                }
            }
        }
    }
}

Encoder.prototype.emptyData = function() {
    var domains = new Array();
        
    for (var blockX=0; blockX < this.domainsX; blockX++) {
        var line = new Array();
        domains.push(line);
            
        for (var blockY=0; blockY < this.domainsY; blockY++) {
            line.push(new Block());
        }
    }
        
    return {
        sizeExp : this.sizeExp,
        data : domains
    };
}
 