/* ------------
     CPU.ts

     Routines for the host CPU simulation, NOT for the OS itself.
     In this manner, it's A LITTLE BIT like a hypervisor,
     in that the Document environment inside a browser is the "bare metal" (so to speak) for which we write code
     that hosts our client OS. But that analogy only goes so far, and the lines are blurred, because we are using
     TypeScript/JavaScript in both the host and client environments.

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */

module TSOS {

    export class Cpu {

        constructor(public PC: number = 0,
                    public Acc: number = 0,
                    public Xreg: number = 0,
                    public Yreg: number = 0,
                    public Zflag: number = 0,
                    public isExecuting: boolean = false,
                    public IR: number = 0) {

        }

        public init(): void {
            this.PC = 0;
            this.Acc = 0;
            this.Xreg = 0;
            this.Yreg = 0;
            this.Zflag = 0;
            this.isExecuting = false;
            this.IR = 0;
        }

        public cycle(): void {
            if (!this.isExecuting) {
                return;
            }
            const process = _MemoryManager.currentProcess;
            if (!process || process.state !== "running") {
                this.isExecuting = false;
                return;
            }
            _Kernel.krnTrace("CPU cycle PID " + process.pid);
            try {
                // One complete instruction per eligible hardware tick.
                this.IR = this.fetchByte();
                switch (this.IR) {
                    case 0xA9: this.Acc = this.fetchByte(); break;
                    case 0xAD: this.Acc = _MemoryAccessor.read(this.fetchAddress()); break;
                    case 0x8D: _MemoryAccessor.write(this.fetchAddress(), this.Acc); break;
                    case 0x6D: this.Acc = (this.Acc + _MemoryAccessor.read(this.fetchAddress())) & 0xFF; break;
                    case 0xA2: this.Xreg = this.fetchByte(); break;
                    case 0xAE: this.Xreg = _MemoryAccessor.read(this.fetchAddress()); break;
                    case 0xA0: this.Yreg = this.fetchByte(); break;
                    case 0xAC: this.Yreg = _MemoryAccessor.read(this.fetchAddress()); break;
                    case 0xEA: break;
                    case 0x00:
                        this.isExecuting = false;
                        _KernelInterruptQueue.enqueue(new Interrupt(PROCESS_EXIT_IRQ, [process.pid, ""]));
                        break;
                    case 0xEC:
                        this.Zflag = this.Xreg === _MemoryAccessor.read(this.fetchAddress()) ? 1 : 0;
                        break;
                    case 0xD0: {
                        const offset = this.fetchByte();
                        if (this.Zflag === 0) {
                            // The logical address space wraps within the 256-byte bank.
                            this.PC = (this.PC + offset) & 0xFF;
                        }
                        break;
                    }
                    case 0xEE: {
                        const address = this.fetchAddress();
                        _MemoryAccessor.write(address, (_MemoryAccessor.read(address) + 1) & 0xFF);
                        break;
                    }
                    case 0xFF:
                        _KernelInterruptQueue.enqueue(new Interrupt(SYSCALL_IRQ, [process.pid, this.Xreg, this.Yreg]));
                        break;
                    default:
                        throw new Error("Invalid opcode " + this.IR.toString(16).toUpperCase().padStart(2, "0") + ".");
                }
            } catch (error) {
                this.isExecuting = false;
                const message = error instanceof Error ? error.message : "CPU execution failed.";
                _KernelInterruptQueue.enqueue(new Interrupt(PROCESS_EXIT_IRQ, [process.pid, message]));
            }
            this.saveState(process);
        }

        private fetchByte(): number {
            const value = _MemoryAccessor.read(this.PC);
            this.PC = (this.PC + 1) & 0xFF;
            return value;
        }

        private fetchAddress(): number {
            const low = this.fetchByte();
            const high = this.fetchByte();
            return low | (high << 8);
        }

        public saveState(process: ProcessControlBlock): void {
            process.PC = this.PC;
            process.IR = this.IR;
            process.Acc = this.Acc;
            process.Xreg = this.Xreg;
            process.Yreg = this.Yreg;
            process.Zflag = this.Zflag;
        }
    }
}
