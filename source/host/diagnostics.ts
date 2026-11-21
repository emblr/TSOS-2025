namespace TSOS {
    export class Diagnostics {
        private static memoryCells: HTMLTableCellElement[] = [];
        private static cpuCells: HTMLTableCellElement[] = [];
        private static pcbCells: HTMLTableCellElement[] = [];

        private static hex(value: number, width: number = 2): string {
            return value.toString(16).toUpperCase().padStart(width, "0");
        }

        private static row(body: HTMLElement, values: string[]): HTMLTableCellElement[] {
            const row = document.createElement("tr");
            const cells = values.map(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
                return cell;
            });
            body.appendChild(row);
            return cells;
        }

        public static init(): void {
            const memoryBody = document.getElementById("memoryState");
            const cpuBody = document.getElementById("cpuState");
            const pcbBody = document.getElementById("pcbState");
            if (!memoryBody || !cpuBody || !pcbBody) {
                return;
            }
            memoryBody.replaceChildren();
            cpuBody.replaceChildren();
            pcbBody.replaceChildren();
            this.memoryCells = [];
            for (let address = 0; address < 256; address += 16) {
                const cells = this.row(memoryBody, Array(16).fill("--"));
                const label = document.createElement("th");
                label.scope = "row";
                label.textContent = "0x" + this.hex(address, 4);
                cells[0].parentElement!.prepend(label);
                cells.forEach((cell, column) => {
                    cell.title = "Address 0x" + this.hex(address + column, 4);
                });
                this.memoryCells.push(...cells);
            }
            this.cpuCells = this.row(cpuBody, Array(7).fill("--"));
            this.pcbCells = this.row(pcbBody, ["--", "Not loaded", "--", "--", "--", "--", "--", "--"]);
        }

        private static updateRow(cells: HTMLTableCellElement[], values: string[]): void {
            cells.forEach((cell, index) => {
                if (cell.textContent !== values[index]) {
                    cell.textContent = values[index];
                }
            });
        }

        public static update(): void {
            Control.hostUpdateStepControls();
            if (!_Memory || !_CPU || !_MemoryManager) {
                return;
            }
            const bytes = _Memory.snapshot();
            this.memoryCells.forEach((cell, address) => {
                const value = this.hex(bytes[address]);
                const changed = cell.textContent !== "--" && cell.textContent !== value;
                cell.classList.toggle("memory-changed", changed);
                cell.classList.toggle("memory-pc", _CPU.isExecuting && address === _CPU.PC);
                if (cell.textContent !== value) {
                    cell.textContent = value;
                }
            });
            this.updateRow(this.cpuCells, [this.hex(_CPU.PC), this.hex(_CPU.IR), this.hex(_CPU.Acc),
                this.hex(_CPU.Xreg), this.hex(_CPU.Yreg), String(_CPU.Zflag),
                _CPU.isExecuting ? (_Kernel.singleStep ? "Waiting for step" : "Running") : "Idle"]);
            const process = _MemoryManager.currentProcess;
            if (process) {
                this.updateRow(this.pcbCells, [String(process.pid), process.state, this.hex(process.PC),
                    this.hex(process.IR), this.hex(process.Acc), this.hex(process.Xreg), this.hex(process.Yreg), String(process.Zflag)]);
            } else {
                this.updateRow(this.pcbCells, ["--", "Not loaded", "--", "--", "--", "--", "--", "--"]);
            }
        }
    }
}
