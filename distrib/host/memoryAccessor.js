"use strict";
/* Host-side memory access, adapted from tsiraM's MMU without its CPU dependency. */
var TSOS;
(function (TSOS) {
    class MemoryAccessor {
        memory;
        constructor(memory) {
            this.memory = memory;
        }
        read(address) {
            this.memory.setMAR(address);
            this.memory.read();
            return this.memory.getMDR();
        }
        write(address, value) {
            this.memory.setMAR(address);
            this.memory.setMDR(value);
            this.memory.write();
        }
        clear() {
            this.memory.init();
        }
    }
    TSOS.MemoryAccessor = MemoryAccessor;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=memoryAccessor.js.map