
/**
 * The 8272 FDC (Floppy Disk Controller).
 */
function FDC() {
    this.interruptRequested = false;
}

FDC.prototype.isInterruptRequested = function() {
    return this.interruptRequested;
}
