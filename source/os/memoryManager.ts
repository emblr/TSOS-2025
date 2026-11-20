namespace TSOS {
    export class MemoryManager {
        public currentProcess: ProcessControlBlock | null = null;
        private nextPid: number = 0;

        constructor(private accessor: MemoryAccessor, private capacity: number) {
        }

        public load(program: number[]): ProcessControlBlock {
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
            this.currentProcess = new ProcessControlBlock(this.nextPid++);
            return this.currentProcess;
        }
    }
}
