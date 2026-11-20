/* Host-side memory access, adapted from tsiraM's MMU without its CPU dependency. */
namespace TSOS {
    export class MemoryAccessor {
        constructor(private memory: Memory) {
        }

        public read(address: number): number {
            this.memory.setMAR(address);
            this.memory.read();
            return this.memory.getMDR();
        }

        public write(address: number, value: number): void {
            this.memory.setMAR(address);
            this.memory.setMDR(value);
            this.memory.write();
        }

        public clear(): void {
            this.memory.init();
        }
    }
}
