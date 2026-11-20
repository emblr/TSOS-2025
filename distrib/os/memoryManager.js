"use strict";
var TSOS;
(function (TSOS) {
    class MemoryManager {
        accessor;
        capacity;
        currentProcess = null;
        nextPid = 0;
        constructor(accessor, capacity) {
            this.accessor = accessor;
            this.capacity = capacity;
        }
        load(program) {
            // Validate everything before clearing the previous program.
            if (program.length === 0) {
                throw new Error("Program input is empty.");
            }
            if (program.length > this.capacity) {
                throw new Error("Program exceeds " + this.capacity + "-byte memory.");
            }
            if (program.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 0xFF)) {
                throw new Error("Program contains an invalid byte.");
            }
            if (this.currentProcess && this.currentProcess.state === "running") {
                throw new Error("Cannot load while a program is running.");
            }
            this.accessor.clear();
            for (let address = 0; address < program.length; address++) {
                this.accessor.write(address, program[address]);
            }
            // Part Two has one memory slot. A new load replaces its old process.
            if (this.currentProcess) {
                this.currentProcess.state = "terminated";
            }
            this.currentProcess = new TSOS.ProcessControlBlock(this.nextPid++);
            return this.currentProcess;
        }
    }
    TSOS.MemoryManager = MemoryManager;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=memoryManager.js.map