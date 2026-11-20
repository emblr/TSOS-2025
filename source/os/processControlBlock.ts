namespace TSOS {
    export type ProcessState = "loaded" | "running" | "terminated";

    export class ProcessControlBlock {
        public state: ProcessState = "loaded";
        public PC: number = 0;
        public IR: number = 0;
        public Acc: number = 0;
        public Xreg: number = 0;
        public Yreg: number = 0;
        public Zflag: number = 0;

        constructor(public readonly pid: number) {
        }
    }
}
