"use strict";
var TSOS;
(function (TSOS) {
    class ProcessControlBlock {
        pid;
        state = "loaded";
        PC = 0;
        IR = 0;
        Acc = 0;
        Xreg = 0;
        Yreg = 0;
        Zflag = 0;
        constructor(pid) {
            this.pid = pid;
        }
    }
    TSOS.ProcessControlBlock = ProcessControlBlock;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=processControlBlock.js.map