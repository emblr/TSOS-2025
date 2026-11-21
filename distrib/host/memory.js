"use strict";
/* Adapted from the CMPT 221 tsiraM memory model: one 256-byte bank. */
var TSOS;
(function (TSOS) {
    class Memory {
        size = 0x100;
        bytes = new Uint8Array(this.size);
        MAR = 0;
        MDR = 0;
        init() {
            this.bytes.fill(0);
            this.MAR = 0;
            this.MDR = 0;
        }
        getMAR() {
            return this.MAR;
        }
        snapshot() {
            // Viewing memory must not change MAR/MDR or expose the backing array.
            return Array.from(this.bytes);
        }
        getMDR() {
            return this.MDR;
        }
        setMAR(address) {
            if (!Number.isInteger(address) || address < 0 || address >= this.size) {
                throw new RangeError("Memory address must be an integer from 0 to 255.");
            }
            this.MAR = address;
        }
        setMDR(value) {
            if (!Number.isInteger(value) || value < 0 || value > 0xFF) {
                throw new RangeError("Memory value must be an integer from 0 to 255.");
            }
            this.MDR = value;
        }
        read() {
            this.MDR = this.bytes[this.MAR];
        }
        write() {
            this.bytes[this.MAR] = this.MDR;
        }
    }
    TSOS.Memory = Memory;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=memory.js.map