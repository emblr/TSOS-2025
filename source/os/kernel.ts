/* ------------
     Kernel.ts

     Routines for the Operating System, NOT the host.

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */

module TSOS {

    export class Kernel {
        public isShutdown: boolean = false;
        public singleStep: boolean = false;
        private pendingSteps: number = 0;
        //
        // OS Startup and Shutdown Routines
        //
        public krnBootstrap() {      // Page 8. {
            Control.hostLog("bootstrap", "host");  // Use hostLog because we ALWAYS want this, even if _Trace is off.

            // Initialize our global queues.
            _KernelInterruptQueue = new Queue();  // A (currently) non-priority queue for interrupt requests (IRQs).
            _KernelBuffers = new Array();         // Buffers... for the kernel.
            _KernelInputQueue = new Queue();      // Where device input lands before being processed out somewhere.
            _MemoryManager = new MemoryManager(_MemoryAccessor, _Memory.size);

            // Initialize the console.
            _Console = new Console();             // The command line interface / console I/O device.
            _Console.init();

            // Initialize standard input and output to the _Console.
            _StdIn  = _Console;
            _StdOut = _Console;

            // Load the Keyboard Device Driver
            this.krnTrace("Loading the keyboard device driver.");
            _krnKeyboardDriver = new DeviceDriverKeyboard();     // Construct it.
            _krnKeyboardDriver.driverEntry();                    // Call the driverEntry() initialization routine.
            this.krnTrace(_krnKeyboardDriver.status);

            //
            // ... more?
            //

            // Enable the OS Interrupts.  (Not the CPU clock interrupt, as that is done in the hardware sim.)
            this.krnTrace("Enabling the interrupts.");
            this.krnEnableInterrupts();

            // Launch the shell.
            this.krnTrace("Creating and Launching the shell.");
            _OsShell = new Shell();
            _OsShell.init();

            // Finally, initiate student testing protocol.
            if (_GLaDOS) {
                _GLaDOS.afterStartup();
            }
        }

        public krnShutdown() {
            this.isShutdown = true;
            this.pendingSteps = 0;
            _CPU.isExecuting = false;
            if (_MemoryManager.currentProcess && _MemoryManager.currentProcess.state === "running") {
                _CPU.saveState(_MemoryManager.currentProcess);
                _MemoryManager.currentProcess.state = "terminated";
            }
            this.krnTrace("begin shutdown OS");
            // TODO: Check for running processes.  If there are some, alert and stop. Else...
            // ... Disable the Interrupts.
            this.krnTrace("Disabling the interrupts.");
            this.krnDisableInterrupts();
            //
            // Unload the Device Drivers?
            // More?
            //
            this.krnTrace("end shutdown OS");
        }


        public krnOnCPUClockPulse() {
            if (this.isShutdown) {
                return;
            }
            /* This gets called from the host hardware simulation every time there is a hardware clock pulse.
               This is NOT the same as a TIMER, which causes an interrupt and is handled like other interrupts.
               This, on the other hand, is the clock pulse from the hardware / VM / host that tells the kernel
               that it has to look for interrupts and process them if it finds any.                          
            */

            // Check for an interrupt, if there are any. Page 560
            if (_KernelInterruptQueue.getSize() > 0) {
                // Process the first interrupt on the interrupt queue.
                // TODO (maybe): Implement a priority queue based on the IRQ number/id to enforce interrupt priority.
                var interrupt = _KernelInterruptQueue.dequeue();
                this.krnInterruptHandler(interrupt.irq, interrupt.params);
            } else if (_CPU.isExecuting) { // If there are no interrupts then run one CPU cycle if there is anything being processed.
                if (this.singleStep) {
                    if (this.pendingSteps === 0) {
                        return;
                    }
                    this.pendingSteps--;
                }
                _CPU.cycle();
            } else {                       // If there are no interrupts and there is nothing being executed then just be idle.
                this.krnTrace("Idle");
            }
        }


        //
        // Interrupt Handling
        //
        public krnEnableInterrupts() {
            // Keyboard
            Devices.hostEnableKeyboardInterrupt();
            Devices.hostEnableScrollInterrupt();
        }

        public krnDisableInterrupts() {
            // Keyboard
            Devices.hostDisableKeyboardInterrupt();
            Devices.hostDisableScrollInterrupt();
            // Put more here.
        }

        public krnInterruptHandler(irq, params) {
            if (this.isShutdown) {
                return;
            }
            // This is the Interrupt Handler Routine.  See pages 8 and 560.
            // Trace our entrance here so we can compute Interrupt Latency by analyzing the log file later on. Page 766.
            this.krnTrace("Handling IRQ~" + irq);

            // Invoke the requested Interrupt Service Routine via Switch/Case rather than an Interrupt Vector.
            // TODO: Consider using an Interrupt Vector in the future.
            // Note: There is no need to "dismiss" or acknowledge the interrupts in our design here.
            //       Maybe the hardware simulation will grow to support/require that in the future.
            switch (irq) {
                case TIMER_IRQ:
                    this.krnTimerISR();               // Kernel built-in routine for timers (not the clock).
                    break;
                case KEYBOARD_IRQ:
                    _krnKeyboardDriver.isr(params);   // Kernel mode device driver
                    _StdIn.handleInput();
                    break;
                case SCROLL_IRQ:
                    _StdOut.scroll(params);
                    break;
                case SYSCALL_IRQ:
                    this.krnSystemCall(params[0], params[1], params[2]);
                    break;
                case PROCESS_EXIT_IRQ:
                    this.krnTerminateProcess(params[0], params[1]);
                    break;
                default:
                    this.krnTrapError("Invalid Interrupt Request. irq=" + irq + " params=[" + params + "]");
            }
        }

        public krnSetSingleStep(enabled: boolean): void {
            if (this.isShutdown) {
                return;
            }
            this.singleStep = enabled;
            this.pendingSteps = 0;
            this.krnTrace("Single step " + (enabled ? "enabled" : "disabled"));
        }

        public krnRequestStep(): void {
            if (!this.isShutdown && this.singleStep && _CPU.isExecuting) {
                this.pendingSteps++;
            }
        }

        public krnRunProgram(pid: number): void {
            const process = _MemoryManager.currentProcess;
            if (!process || process.pid !== pid) {
                throw new Error("PID " + pid + " is not loaded in memory.");
            }
            if (process.state !== "loaded") {
                throw new Error("Process is " + process.state + ". Load a program before running it.");
            }
            _CPU.init();
            this.pendingSteps = 0;
            process.state = "running";
            _CPU.saveState(process);
            _CPU.isExecuting = true;
            this.krnTrace("Running PID " + pid);
        }

        public krnSystemCall(pid: number, operation: number, value: number): void {
            const process = _MemoryManager.currentProcess;
            if (!process || process.pid !== pid || process.state !== "running") {
                return;
            }
            if (operation === 1) {
                _StdOut.putText(String(value));
            } else if (operation === 2) {
                let text = "";
                try {
                    // A missing terminator faults at the memory boundary instead of hanging.
                    for (let address = value; ; address++) {
                        const byte = _MemoryAccessor.read(address);
                        if (byte === 0) {
                            break;
                        }
                        text += String.fromCharCode(byte);
                    }
                    for (const character of text) {
                        if (character === "\n") {
                            _StdOut.advanceLine();
                        } else {
                            _StdOut.putText(character);
                        }
                    }
                } catch (error) {
                    this.krnTerminateProcess(pid, "String is not terminated within memory.");
                }
            } else {
                this.krnTerminateProcess(pid, "Unknown system call X=" + operation + ".");
            }
        }

        public krnTerminateProcess(pid: number, reason: string = ""): void {
            const process = _MemoryManager.currentProcess;
            if (!process || process.pid !== pid || process.state !== "running") {
                return;
            }
            _CPU.isExecuting = false;
            _CPU.saveState(process);
            process.state = "terminated";
            this.pendingSteps = 0;
            if (_StdOut.currentXPosition > 0) {
                _StdOut.advanceLine();
            }
            if (reason !== "") {
                _StdOut.putText("PID " + pid + ": " + reason);
                _StdOut.advanceLine();
            }
            this.krnTrace("Terminated PID " + pid + (reason ? ": " + reason : ""));
            _OsShell.putPrompt();
        }

        public krnTimerISR() {
            // The built-in TIMER (not clock) Interrupt Service Routine (as opposed to an ISR coming from a device driver). {
            // Check multiprogramming parameters and enforce quanta here. Call the scheduler / context switch here if necessary.
            // Or do it elsewhere in the Kernel. We don't really need this.
        }

        //
        // System Calls... that generate software interrupts via tha Application Programming Interface library routines.
        //
        // Some ideas:
        // - ReadConsole
        // - WriteConsole
        // - CreateProcess
        // - ExitProcess
        // - WaitForProcessToExit
        // - CreateFile
        // - OpenFile
        // - ReadFile
        // - WriteFile
        // - CloseFile


        //
        // OS Utility Routines
        //
        public krnTrace(msg: string) {
             // Check globals to see if trace is set ON.  If so, then (maybe) log the message.
             if (_Trace) {
                if (msg === "Idle") {
                    // We can't log every idle clock pulse because it would quickly lag the browser quickly.
                    if (_OSclock % 10 == 0) {
                        // Check the CPU_CLOCK_INTERVAL in globals.ts for an
                        // idea of the tick rate and adjust this line accordingly.
                        Control.hostLog(msg, "OS");
                    }
                } else {
                    Control.hostLog(msg, "OS");
                }
             }
        }

        public krnTrapError(msg) {
            Control.hostLog("OS ERROR - TRAP: " + msg);
            this.krnShutdown();
            _StatusMessage = "Kernel error - reset to restart.";
            Control.hostShowBSOD(String(msg));
        }
    }
}
