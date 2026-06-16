/**
 * Screen buffer management for terminal UI
 *
 * Manages alternate screen buffer, terminal resize events,
 * cursor visibility, and screen clearing.
 */

import { EventEmitter } from 'node:events';
import { Terminal, ANSI } from './Terminal.js';

/**
 * Resize event data
 */
export interface ResizeEvent {
  width: number;
  height: number;
}

/**
 * Screen events
 */
export interface ScreenEvents {
  resize: [ResizeEvent];
}

/**
 * Screen manager
 *
 * Manages the terminal screen buffer, cursor visibility,
 * and resize events.
 */
export class Screen extends EventEmitter {
  private terminal: Terminal;
  private altScreenActive: boolean = false;
  private cursorVisible: boolean = true;
  private resizeHandler: (() => void) | null = null;
  private exitHandler: (() => void) | null = null;
  private cleanupDone: boolean = false;

  constructor(terminal?: Terminal) {
    super();
    this.terminal = terminal ?? Terminal.get();
  }

  /**
   * Enter alternate screen buffer
   *
   * Saves the current screen and switches to a clean buffer.
   * Call `exitAltScreen()` to restore the original screen.
   */
  enterAltScreen(): void {
    if (this.altScreenActive) return;
    if (!this.terminal.features.alternateScreen) return;

    process.stdout.write(ANSI.altScreenOn);
    this.altScreenActive = true;
  }

  /**
   * Exit alternate screen buffer
   */
  exitAltScreen(): void {
    if (!this.altScreenActive) return;

    process.stdout.write(ANSI.altScreenOff);
    this.altScreenActive = false;
  }

  /**
   * Check if alternate screen is active
   */
  get isAltScreen(): boolean {
    return this.altScreenActive;
  }

  /**
   * Hide the cursor
   */
  hideCursor(): void {
    if (!this.terminal.features.cursorControl) return;
    if (!this.cursorVisible) return;

    process.stdout.write(ANSI.cursorHide);
    this.cursorVisible = false;
  }

  /**
   * Show the cursor
   */
  showCursor(): void {
    if (!this.terminal.features.cursorControl) return;
    if (this.cursorVisible) return;

    process.stdout.write(ANSI.cursorShow);
    this.cursorVisible = true;
  }

  /**
   * Move cursor to position (1-indexed)
   */
  moveTo(row: number, col: number): void {
    process.stdout.write(ANSI.moveTo(row, col));
  }

  /**
   * Move cursor relative
   */
  moveUp(n: number = 1): void {
    process.stdout.write(ANSI.up(n));
  }

  moveDown(n: number = 1): void {
    process.stdout.write(ANSI.down(n));
  }

  moveRight(n: number = 1): void {
    process.stdout.write(ANSI.right(n));
  }

  moveLeft(n: number = 1): void {
    process.stdout.write(ANSI.left(n));
  }

  /**
   * Clear the entire screen
   */
  clear(): void {
    process.stdout.write(ANSI.clearScreen);
  }

  /**
   * Clear from cursor to end of line
   */
  clearLine(): void {
    process.stdout.write(ANSI.eraseLine);
  }

  /**
   * Clear from cursor to end of screen
   */
  clearDown(): void {
    process.stdout.write(ANSI.eraseDown);
  }

  /**
   * Save cursor position
   */
  saveCursor(): void {
    process.stdout.write(ANSI.saveCursor);
  }

  /**
   * Restore cursor position
   */
  restoreCursor(): void {
    process.stdout.write(ANSI.restoreCursor);
  }

  /**
   * Write raw text to stdout
   */
  write(text: string): void {
    process.stdout.write(text);
  }

  /**
   * Enable resize event listening
   */
  listenResize(): void {
    if (this.resizeHandler) return;
    if (!this.terminal.features.resizeEvents) return;

    this.resizeHandler = (): void => {
      this.terminal.refreshDimensions();
      const dims = this.terminal.dimensions;
      this.emit('resize', { width: dims.width, height: dims.height });
    };

    process.stdout.on('resize', this.resizeHandler);
  }

  /**
   * Stop listening for resize events
   */
  unlistenResize(): void {
    if (this.resizeHandler) {
      process.stdout.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  /**
   * Setup cleanup on process exit (SIGINT, SIGTERM, exit)
   */
  setupCleanup(): void {
    if (this.cleanupDone) return;

    const cleanup = (): void => {
      if (this.cleanupDone) return;
      this.cleanupDone = true;
      this.restore();
    };

    this.exitHandler = cleanup;
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * Restore terminal to normal state
   */
  restore(): void {
    this.showCursor();
    this.exitAltScreen();
    this.unlistenResize();
    process.stdout.write(ANSI.mouseOff);
    process.stdout.write(ANSI.reset);
  }

  /**
   * Get terminal dimensions
   */
  get dimensions(): { width: number; height: number } {
    return this.terminal.dimensions;
  }

  // ── Event overrides ──────────────────────────────────────────

  on<E extends keyof ScreenEvents>(event: E, listener: (...args: ScreenEvents[E]) => void): this {
    return super.on(event, listener);
  }

  emit<E extends keyof ScreenEvents>(event: E, ...args: ScreenEvents[E]): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * Create a screen manager
 */
export function createScreen(terminal?: Terminal): Screen {
  return new Screen(terminal);
}

/**
 * Run a function in alternate screen mode
 * Automatically enters and exits the alternate screen buffer.
 */
export async function inAlternateScreen(fn: (screen: Screen) => Promise<void>): Promise<void> {
  const screen = new Screen();
  screen.enterAltScreen();
  screen.hideCursor();
  screen.setupCleanup();

  try {
    await fn(screen);
  } finally {
    screen.restore();
  }
}
