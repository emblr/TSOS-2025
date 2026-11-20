"use strict";
/* ------------
     Console.ts

     The OS Console - stdIn and stdOut by default.
     Note: This is not the Shell. The Shell is the "command line interface" (CLI) or interpreter for this console.
     ------------ */
var TSOS;
(function (TSOS) {
    class Console {
        currentFont;
        currentFontSize;
        currentXPosition;
        currentYPosition;
        buffer;
        history;
        currentLine;
        scrollOffset;
        // Submitted commands are separate from the console's output scrollback.
        commandHistory = [];
        historyIndex = 0;
        inputDraft = "";
        // scrollOffset measures pixels above the live bottom view.
        constructor(currentFont = _DefaultFontFamily, currentFontSize = _DefaultFontSize, currentXPosition = 0, currentYPosition = _DefaultFontSize, buffer = "", history = [], currentLine = "", scrollOffset = 0) {
            this.currentFont = currentFont;
            this.currentFontSize = currentFontSize;
            this.currentXPosition = currentXPosition;
            this.currentYPosition = currentYPosition;
            this.buffer = buffer;
            this.history = history;
            this.currentLine = currentLine;
            this.scrollOffset = scrollOffset;
        }
        init() {
            this.clearScreen();
            this.resetXY();
        }
        clearScreen() {
            _DrawingContext.clearRect(0, 0, _Canvas.width, _Canvas.height);
            this.history = [];
            this.currentLine = "";
            this.scrollOffset = 0;
        }
        clearCanvasPixels() {
            _DrawingContext.clearRect(0, 0, _Canvas.width, _Canvas.height);
        }
        resetXY() {
            this.currentXPosition = 0;
            this.currentYPosition = this.currentFontSize;
        }
        handleInput() {
            while (_KernelInputQueue.getSize() > 0) {
                // Get the next character from the kernel input queue.
                var chr = _KernelInputQueue.dequeue();
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
                }
                else if (chr === String.fromCharCode(8)) { // Backspace
                    this.backspace();
                }
                else if (chr === String.fromCharCode(9)) { // Tab
                    this.completeCommand();
                }
                else if (chr === "ArrowUp") {
                    this.recallCommand(-1);
                }
                else if (chr === "ArrowDown") {
                    this.recallCommand(1);
                }
                else {
                    // This is a "normal" character, so ...
                    // ... draw it on the screen...
                    this.putText(chr);
                    // ... and add it to our buffer.
                    this.buffer += chr;
                }
                // TODO: Add a case for Ctrl-C that would allow the user to break the current program.
            }
        }
        recallCommand(direction) {
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
        backspace() {
            // Only the input buffer is editable; never erase the prompt or output.
            if (this.buffer.length === 0) {
                return;
            }
            this.replaceInput(this.buffer.slice(0, -1));
        }
        replaceInput(text) {
            // Preserve the existing prompt, including a customized prompt string.
            this.currentLine = this.currentLine.slice(0, this.currentLine.length - this.buffer.length) + text;
            this.buffer = text;
            this.currentXPosition = _DrawingContext.measureText(this.currentFont, this.currentFontSize, this.currentLine);
            this.scrollOffset = 0;
            let lineHeight = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
            this.currentYPosition = this.redrawHistoryWindow(0, lineHeight);
        }
        completeCommand() {
            // Complete the command word only; do not change its arguments.
            const input = /^(\s*)(\S*)$/.exec(this.buffer);
            if (!input) {
                return;
            }
            const matches = _OsShell.getCommandMatches(input[2]);
            if (matches.length === 1) {
                this.replaceInput(input[1] + matches[0]);
            }
            else if (matches.length > 1) {
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
        putText(text) {
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
                let offset = _DrawingContext.measureText(this.currentFont, this.currentFontSize, text);
                this.currentLine += text;
                this.currentXPosition = this.currentXPosition + offset;
            }
        }
        redrawHistoryWindow(scrollOffset, offset) {
            // Include the unfinished prompt/input without committing it to history.
            let allLines = this.history.concat([this.currentLine]);
            this.clearCanvasPixels();
            let linesPerScreen = Math.max(1, Math.floor(_Canvas.height / offset));
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
        advanceLine() {
            this.history.push(this.currentLine);
            this.currentLine = "";
            this.currentXPosition = 0;
            /*
             * Font size measures from the baseline to the highest point in the font.
             * Font descent measures from the baseline to the lowest point in the font.
             * Font height margin is extra spacing between the lines.
             */
            let offset = this.currentFontSize + _DrawingContext.fontDescent(this.currentFont, this.currentFontSize) + _FontHeightMargin;
            let nextYPosition = this.currentYPosition + offset;
            let linesPerScreen = Math.max(1, Math.floor(_Canvas.height / offset));
            if (this.scrollOffset !== 0 || this.history.length + 1 > linesPerScreen) {
                this.scrollOffset = 0;
                this.currentYPosition = this.redrawHistoryWindow(0, offset);
            }
            else {
                this.currentYPosition = nextYPosition;
            }
        }
        scroll(params) {
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
            }
            else if (deltaMode === 2) {
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
    TSOS.Console = Console;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=console.js.map