/* ------------
     Console.ts

     The OS Console - stdIn and stdOut by default.
     Note: This is not the Shell. The Shell is the "command line interface" (CLI) or interpreter for this console.
     ------------ */

module TSOS {

    export class Console {

        // Submitted commands are separate from the console's output scrollback.
        public commandHistory: string[] = [];
        public historyIndex: number = 0;
        public inputDraft: string = "";

        // scrollOffset measures pixels above the live bottom view.
        constructor(public currentFont = _DefaultFontFamily,
            public currentFontSize = _DefaultFontSize,
            public currentXPosition = 0,
            public currentYPosition = _DefaultFontSize,
            public buffer = "",
            public history: string[] = [],
            public currentLine: string = "",
            public scrollOffset = 0) {
        }

        public init(): void {
            this.clearScreen();
            this.resetXY();
        }

        public clearScreen(): void {
            _DrawingContext.clearRect(0, 0, _Canvas.width, _Canvas.height);
            this.history = [];
            this.currentLine = "";
            this.scrollOffset = 0;
        }

        public clearCanvasPixels(): void {
            _DrawingContext.clearRect(0, 0, _Canvas.width, _Canvas.height);
        }

        public resetXY(): void {
            this.currentXPosition = 0;
            this.currentYPosition = this.currentFontSize;
        }

        public handleInput(): void {
            while (_KernelInputQueue.getSize() > 0) {
                // Get the next character from the kernel input queue.
                var chr = _KernelInputQueue.dequeue();
                // Handle cancellation even while a program owns console output.
                if (chr === "CtrlC") {
                    this.buffer = "";
                    this.inputDraft = "";
                    this.historyIndex = this.commandHistory.length;
                    const process = _MemoryManager.currentProcess;
                    if (process && process.state === "running") {
                        _Kernel.krnTerminateProcess(process.pid, "Interrupted by Ctrl-C.");
                    } else {
                        this.putText("^C");
                        this.advanceLine();
                        _OsShell.putPrompt();
                    }
                    continue;
                }
                // The running program owns stdout until it terminates.
                if (_MemoryManager.currentProcess && _MemoryManager.currentProcess.state === "running") {
                    continue;
                }
                // Check to see if it's "special" (enter or ctrl-c) or "normal" (anything else that the keyboard device driver gave us).
                if (chr === String.fromCharCode(13)) { // the Enter key
                    if (this.buffer.trim() !== "") {
                        this.commandHistory.push(this.buffer);
                    }
                    this.historyIndex = this.commandHistory.length;
                    this.inputDraft = "";
                    // The enter key marks the end of a console command, so ...
                    // ... tell the shell ...
                    _OsShell.handleInput(this.buffer);
                    // ... and reset our buffer.
                    this.buffer = "";
                    if (_Kernel.isShutdown) {
                        return;
                    }
                } else if (chr === String.fromCharCode(8)) { // Backspace
                    this.backspace();
                } else if (chr === String.fromCharCode(9)) { // Tab
                    this.completeCommand();
                } else if (chr === "ArrowUp") {
                    this.recallCommand(-1);
                } else if (chr === "ArrowDown") {
                    this.recallCommand(1);
                } else {
                    // This is a "normal" character, so ...
                    // ... draw it on the screen...
                    this.putText(chr);
                    // ... and add it to our buffer.
                    this.buffer += chr;
                }
            }
        }

        public recallCommand(direction: number): void {
            const nextIndex = Math.max(0, Math.min(this.commandHistory.length, this.historyIndex + direction));
            if (nextIndex === this.historyIndex) {
                return;
            }
            if (this.historyIndex === this.commandHistory.length) {
                this.inputDraft = this.buffer;
            }
            this.historyIndex = nextIndex;
            this.replaceInput(nextIndex === this.commandHistory.length
                ? this.inputDraft
                : this.commandHistory[nextIndex]);
        }

        public backspace(): void {
            // Only the input buffer is editable; never erase the prompt or output.
            if (this.buffer.length === 0) {
                return;
            }
            this.replaceInput(this.buffer.slice(0, -1));
        }

        public replaceInput(text: string): void {
            // Preserve the existing prompt, including a customized prompt string.
            this.currentLine = this.currentLine.slice(0, this.currentLine.length - this.buffer.length) + text;
            this.buffer = text;
            this.scrollOffset = 0;
            let lineHeight = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
            this.currentYPosition = this.redrawHistoryWindow(0, lineHeight);
        }

        public completeCommand(): void {
            // Complete the command word only; do not change its arguments.
            const input = /^(\s*)(\S*)$/.exec(this.buffer);
            if (!input) {
                return;
            }
            const matches = _OsShell.getCommandMatches(input[2]);
            if (matches.length === 1) {
                this.replaceInput(input[1] + matches[0]);
            } else if (matches.length > 1) {
                const savedInput = this.buffer;
                this.buffer = "";
                this.advanceLine();
                for (const command of matches) {
                    this.putText(command);
                    this.advanceLine();
                }
                _OsShell.putPrompt();
                this.replaceInput(savedInput);
            }
        }

        public putText(text: string): void {
            /*  My first inclination here was to write two functions: putChar() and putString().
                Then I remembered that JavaScript is (sadly) untyped and it won't differentiate
                between the two. (Although TypeScript would. But we're compiling to JavaScipt anyway.)
                So rather than be like PHP and write two (or more) functions that
                do the same thing, thereby encouraging confusion and decreasing readability, I
                decided to write one function and use the term "text" to connote string or char.
            */

            if (text !== "") {
                // Keep logical lines intact so wrapping never changes shell input.
                const lines = text.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0) {
                        this.advanceLine();
                    }
                    this.currentLine += lines[i];
                }
                this.scrollOffset = 0;
                const lineHeight = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
                this.currentYPosition = this.redrawHistoryWindow(0, lineHeight);
            }
        }

        private displayRows(): string[] {
            const rows: string[] = [];
            for (const line of this.history.concat([this.currentLine])) {
                let row = "";
                let width = 0;
                for (const character of line) {
                    const characterWidth = _DrawingContext.measureText(this.currentFont, this.currentFontSize, character);
                    if (row !== "" && width + characterWidth > _Canvas.width) {
                        rows.push(row);
                        row = "";
                        width = 0;
                    }
                    row += character;
                    width += characterWidth;
                }
                rows.push(row);
            }
            return rows;
        }

        public redrawHistoryWindow(scrollOffset: number, offset: number): number {

            // Scrolling counts rendered rows, including wrapped portions of a line.
            let allLines = this.displayRows();
            this.clearCanvasPixels();
            let linesPerScreen: number = Math.max(1, Math.floor(_Canvas.height / offset));
            let bottomTop = Math.max(0, allLines.length - linesPerScreen) * offset;
            let viewportTop = Math.max(0, bottomTop - scrollOffset);
            let start = Math.floor(viewportTop / offset);
            let end = Math.min(allLines.length, Math.ceil((viewportTop + _Canvas.height) / offset));
            // Keep fractional wheel movement; the canvas clips rows at its edges.
            for (let i = start; i < end; i++) {
                let rowY = this.currentFontSize + i * offset - viewportTop;
                _DrawingContext.drawText(this.currentFont, this.currentFontSize, 0, rowY, allLines[i]);
            }
            if (scrollOffset === 0) {
                this.currentXPosition = _DrawingContext.measureText(this.currentFont, this.currentFontSize, allLines[allLines.length - 1]);
            }
            // At the bottom, this is the baseline of the current input line.
            return this.currentFontSize + (allLines.length - 1) * offset - viewportTop;
        }

        public advanceLine(): void {
            this.history.push(this.currentLine);
            this.currentLine = "";
            this.currentXPosition = 0;
            /*
             * Font size measures from the baseline to the highest point in the font.
             * Font descent measures from the baseline to the lowest point in the font.
             * Font height margin is extra spacing between the lines.
             */
            let offset: number = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
            this.scrollOffset = 0;
            this.currentYPosition = this.redrawHistoryWindow(0, offset);

        }

        public scroll(params): void {
            let deltaY = params[0];
            if (!Number.isFinite(deltaY) || deltaY === 0) {
                return;
            }
            let offset = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
            let linesPerScreen = Math.max(1, Math.floor(_Canvas.height / offset));
            // Wheel devices report pixels (0), lines (1), or pages (2).
            let deltaMode = params[1] || 0;
            if (deltaMode === 1) {
                deltaY *= offset;
            } else if (deltaMode === 2) {
                deltaY *= linesPerScreen * offset;
            }
            let maxOffset = Math.max(0, this.displayRows().length - linesPerScreen) * offset;
            let nextOffset = Math.max(0, Math.min(maxOffset, this.scrollOffset - deltaY));
            if (nextOffset === this.scrollOffset) {
                return;
            }
            this.scrollOffset = nextOffset;
            this.redrawHistoryWindow(this.scrollOffset, offset);
        }
    }
}
