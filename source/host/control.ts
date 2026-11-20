/* ------------
     Control.ts

     Routines for the hardware simulation, NOT for our client OS itself.
     These are static because we are never going to instantiate them, because they represent the hardware.
     In this manner, it's A LITTLE BIT like a hypervisor, in that the Document environment inside a browser
     is the "bare metal" (so to speak) for which we write code that hosts our client OS.
     But that analogy only goes so far, and the lines are blurred, because we are using TypeScript/JavaScript
     in both the host and client environments.

     This (and other host/simulation scripts) is the only place that we should see "web" code, such as
     DOM manipulation and event handling, and so on.  (Index.html is -- obviously -- the only place for markup.)

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */

//
// Control Services
//
module TSOS {

    export class Control {

        public static hostInit(): void {
            // This is called from index.html's onLoad event via the onDocumentLoad function pointer.

            // Get a global reference to the canvas.  TODO: Should we move this stuff into a Display Device Driver?
            _Canvas = <HTMLCanvasElement>document.getElementById('display');

            // Get a global reference to the drawing context.
            _DrawingContext = _Canvas.getContext("2d");

            // Enable the added-in canvas text functions (see canvastext.ts for provenance and details).
            CanvasTextFunctions.enable(_DrawingContext);   // Text functionality is now built in to the HTML5 canvas. But this is old-school, and fun, so we'll keep it.

            // Clear the log text box.
            // Use the TypeScript cast to HTMLInputElement
            (<HTMLInputElement> document.getElementById("taHostLog")).value="";

            // Set focus on the start button.
            // Use the TypeScript cast to HTMLInputElement
            (<HTMLInputElement> document.getElementById("btnStartOS")).focus();

            // Check for our testing and enrichment core, which
            // may be referenced here (from index.html) as function Glados().
            if (typeof Glados === "function") {
                // function Glados() is here, so instantiate Her into
                // the global (and properly capitalized) _GLaDOS variable.
                _GLaDOS = new Glados();
                _GLaDOS.init();
            }

            Control.hostUpdateTaskbar();
        }

        public static hostLog(msg: string, source: string = "?"): void {
            // Note the OS CLOCK.
            var clock: number = _OSclock;

            // Note the REAL clock in milliseconds since January 1, 1970.
            var now: number = new Date().getTime();

            // Build the log string.
            var str: string = "({ clock:" + clock + ", source:" + source + ", msg:" + msg + ", now:" + now  + " })"  + "\n";

            // Update the log console.
            var taLog = <HTMLInputElement> document.getElementById("taHostLog");
            taLog.value = str + taLog.value;

            // TODO in the future: Optionally update a log database or some streaming service.
        }


        //
        // Host Events
        //
        public static hostBtnStartOS_click(btn): void {
            // Disable the (passed-in) start button...
            btn.disabled = true;

            // .. enable the Halt and Reset buttons ...
            (<HTMLButtonElement>document.getElementById("btnHaltOS")).disabled = false;
            (<HTMLButtonElement>document.getElementById("btnReset")).disabled = false;

            // .. set focus on the OS console display ...
            document.getElementById("display").focus();

            // Initialize the physical memory and its access interface before booting the OS.
            _Memory = new Memory();
            _Memory.init();
            _MemoryAccessor = new MemoryAccessor(_Memory);

            // ... Create and initialize the CPU (because it's part of the hardware)  ...
            _CPU = new Cpu();  // Note: We could simulate multi-core systems by instantiating more than one instance of the CPU here.
            _CPU.init();       //       There's more to do, like dealing with scheduling and such, but this would be a start. Pretty cool.

            // ... then set the host clock pulse ...
            _hardwareClockID = setInterval(Devices.hostClockPulse, CPU_CLOCK_INTERVAL);
            // .. and call the OS Kernel Bootstrap routine.
            _Kernel = new Kernel();
            _Kernel.krnBootstrap();  // _GLaDOS.afterStartup() will get called in there, if configured.
        }

        public static hostBtnHaltOS_click(btn): void {
            Control.hostLog("Emergency halt", "host");
            Control.hostLog("Attempting Kernel shutdown.", "host");
            // Call the OS shutdown routine.
            _Kernel.krnShutdown();
            // Stop the interval that's simulating our clock pulse.
            clearInterval(_hardwareClockID);
            // TODO: Is there anything else we need to do here?
        }

        public static hostBtnReset_click(btn): void {
            // The easiest and most thorough way to do this is to reload (not refresh) the document.
            location.reload();
        }

        public static hostReadProgramInput(): string {
            return (<HTMLTextAreaElement>document.getElementById("taProgramInput")).value;
        }

        public static hostShowBSOD(message: string): void {
            _DrawingContext.save();
            _DrawingContext.fillStyle = "#163b78";
            _DrawingContext.fillRect(0, 0, _Canvas.width, _Canvas.height);
            _DrawingContext.fillStyle = "#ffffff";
            _DrawingContext.textAlign = "left";
            _DrawingContext.textBaseline = "top";
            _DrawingContext.font = "24px monospace";
            _DrawingContext.fillText("THE WATCH HAS ENDED", 24, 40, _Canvas.width - 48);
            _DrawingContext.font = "16px monospace";
            _DrawingContext.fillText("StarkOS encountered a kernel error.", 24, 90, _Canvas.width - 48);
            // The console overrides measureText, so wrap using monospace columns.
            const columns = Math.max(1, Math.floor((_Canvas.width - 48) / 10));
            const lines = message.match(new RegExp(".{1," + columns + "}", "g")) || [];
            let y = 140;
            for (const line of lines) {
                if (y > _Canvas.height - 90) {
                    break;
                }
                _DrawingContext.fillText(line, 24, y, _Canvas.width - 48);
                y += 22;
            }
            _DrawingContext.fillText("Click Reset to restart the system.", 24, _Canvas.height - 50, _Canvas.width - 48);
            _DrawingContext.restore();
            _Canvas.setAttribute("aria-label", "StarkOS kernel error: " + message + ". Click Reset to restart.");
        }

        public static hostUpdateTaskbar(): void{
            const clock = document.getElementById("taskbarClock");
            const status = document.getElementById("taskbarStatus");
            if (clock){
                clock.textContent = US_FORMAT.format(new Date());
            }
            if(status){
                status.textContent = _StatusMessage;
            }
        }
    }

}
