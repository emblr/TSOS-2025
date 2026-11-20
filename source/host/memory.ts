/* Adapted from the CMPT 221 tsiraM memory model: one 256-byte bank. */
namespace TSOS {
    export class Memory {
        public readonly size: number = 0x100;
        private readonly bytes = new Uint8Array(this.size);
        private MAR: number = 0;
        private MDR: number = 0;

        public init(): void {
            this.bytes.fill(0);
            this.MAR = 0;
            this.MDR = 0;
        }

        public getMAR(): number {
            return this.MAR;
        }

        public getMDR(): number {
            return this.MDR;
        }

        public setMAR(address: number): void {
            if (!Number.isInteger(address) || address < 0 || address >= this.size) {
                throw new RangeError("Memory address must be an integer from 0 to 255.");
            }
            this.MAR = address;
        }

        public setMDR(value: number): void {
            if (!Number.isInteger(value) || value < 0 || value > 0xFF) {
                throw new RangeError("Memory value must be an integer from 0 to 255.");
            }
            this.MDR = value;
        }

        public read(): void {
            this.MDR = this.bytes[this.MAR];
        }

        public write(): void {
            this.bytes[this.MAR] = this.MDR;
        }
    }
}
