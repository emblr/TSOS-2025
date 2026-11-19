/* ------------
     Devices.ts

     Routines for the hardware simulation, NOT for our client OS itself.
     These are static because we are never going to instantiate them, because they represent the hardware.
     In this manner, it's A LITTLE BIT like a hypervisor, in that the Document environment inside a browser
     is the "bare metal" (so to speak) for which we write code that hosts our client OS.
     But that analogy only goes so far, and the lines are blurred, because we are using TypeScript/JavaScript
     in both the host and client environments.

     This (and simulation scripts) is the only place that we should see "web" code, like
     DOM manipulation and TypeScript/JavaScript event handling, and so on.  (Index.html is the only place for markup.)

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */

module TSOS {

    export class Devices {

        constructor() {
            _hardwareClockID = -1;
        }

        //
        // Hardware/Host Clock Pulse
        //
        public static hostClockPulse(): void {
            // Increment the hardware (host) clock.
            _OSclock++;
            // Call the kernel clock pulse event handler.
            _Kernel.krnOnCPUClockPulse();
        }

        //
        // Keyboard Interrupt, a HARDWARE Interrupt Request. (See pages 560-561 in our text book.)
        //
        public static hostEnableKeyboardInterrupt(): void {
            // Listen for key press (keydown, actually) events in the Document
            // and call the simulation processor, which will in turn call the
            // OS interrupt handler.
            document.addEventListener("keydown", Devices.hostOnKeypress, false);
        }

        public static hostDisableKeyboardInterrupt(): void {
            document.removeEventListener("keydown", Devices.hostOnKeypress, false);
        }

        public static hostOnKeypress(event): void {
            // The canvas element CAN receive focus if you give it a tab index, which we have.
            // Check that we are processing keystrokes only from the canvas's id (as set in index.html).
            if (event.target.id === "display") {
                event.preventDefault();
                // Note the pressed key code in the params (Mozilla-specific).
                var params = new Array(event.which, event.shiftKey);
                // Enqueue this interrupt on the kernel interrupt queue so that it gets to the Interrupt handler.
                _KernelInterruptQueue.enqueue(new Interrupt(KEYBOARD_IRQ, params));
            }
        }

        public static hostEnableScrollInterrupt(): void{
            document.addEventListener("wheel", Devices.hostOnWheel, { passive: false });
        }

        public static hostDisableScrollInterrupt(): void{
            document.removeEventListener("wheel", Devices.hostOnWheel, false);
        }

        public static hostOnWheel(event): void {
            if(event.target.id === "display"){
                event.preventDefault();
                if (event.deltaY === 0) {
                    return;
                }
                let params = [event.deltaY, event.deltaMode];
                // A trackpad can generate many events between hardware ticks.
                // Combine adjacent movements without crossing a keyboard interrupt
                // or a direction change, preserving FIFO input ordering.
                let pending = _KernelInterruptQueue.q;
                let last = pending[pending.length - 1];
                if (last && last.irq === SCROLL_IRQ &&
                    last.params[1] === event.deltaMode &&
                    Math.sign(last.params[0]) === Math.sign(event.deltaY)) {
                    last.params[0] += event.deltaY;
                    return;
                }
                _KernelInterruptQueue.enqueue(new Interrupt(SCROLL_IRQ, params));
            }
        }
    }
}
