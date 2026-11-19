/* ------------
     Console.ts

     The OS Console - stdIn and stdOut by default.
     Note: This is not the Shell. The Shell is the "command line interface" (CLI) or interpreter for this console.
     ------------ */

module TSOS {

    export class Console {

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
                // Check to see if it's "special" (enter or ctrl-c) or "normal" (anything else that the keyboard device driver gave us).
                if (chr === String.fromCharCode(13)) { // the Enter key
                    // The enter key marks the end of a console command, so ...
                    // ... tell the shell ...
                    _OsShell.handleInput(this.buffer);
                    // ... and reset our buffer.
                    this.buffer = "";
                } else {
                    // This is a "normal" character, so ...
                    // ... draw it on the screen...
                    this.putText(chr);
                    // ... and add it to our buffer.
                    this.buffer += chr;
                }
                // TODO: Add a case for Ctrl-C that would allow the user to break the current program.
            }
        }

        public putText(text): void {
            /*  My first inclination here was to write two functions: putChar() and putString().
                Then I remembered that JavaScript is (sadly) untyped and it won't differentiate
                between the two. (Although TypeScript would. But we're compiling to JavaScipt anyway.)
                So rather than be like PHP and write two (or more) functions that
                do the same thing, thereby encouraging confusion and decreasing readability, I
                decided to write one function and use the term "text" to connote string or char.
            */

            if (text !== "") {
                if (this.scrollOffset !== 0) {
                    let lineHeight = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
                    this.scrollOffset = 0;
                    this.currentYPosition = this.redrawHistoryWindow(0, lineHeight);
                }
                // Draw the text at the current X and Y coordinates.
                _DrawingContext.drawText(this.currentFont, this.currentFontSize, this.currentXPosition, this.currentYPosition, text);
                let offset: number = _DrawingContext.measureText(this.currentFont, this.currentFontSize, text);
                this.currentLine += text;
                this.currentXPosition = this.currentXPosition + offset;
            }
        }

        public redrawHistoryWindow(scrollOffset: number, offset: number): number {

            // Include the unfinished prompt/input without committing it to history.
            let allLines = this.history.concat([this.currentLine]);
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
            // At the bottom, this is the baseline of the current input line.
            return this.currentFontSize + this.history.length * offset - viewportTop;
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
            let nextYPosition = this.currentYPosition + offset;
            let linesPerScreen = Math.max(1, Math.floor(_Canvas.height / offset));
            if (this.scrollOffset !== 0 || this.history.length + 1 > linesPerScreen) {
                this.scrollOffset = 0;
                this.currentYPosition = this.redrawHistoryWindow(0, offset);
            } else {
                this.currentYPosition = nextYPosition;
            }

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
            let maxOffset = Math.max(0, this.history.length + 1 - linesPerScreen) * offset;
            let nextOffset = Math.max(0, Math.min(maxOffset, this.scrollOffset - deltaY));
            if (nextOffset === this.scrollOffset) {
                return;
            }
            this.scrollOffset = nextOffset;
            this.redrawHistoryWindow(this.scrollOffset, offset);
        }
    }
}
