/**
 * Mouse event handling for terminal UI
 *
 * Parses SGR mouse events and provides a clean event-driven API.
 * Supports mouse motion, clicks, scroll, and drag.
 *
 * Mouse tracking is enabled/disabled via the Terminal feature toggle.
 * Usage:
 *   const mouse = new MouseHandler();
 *   mouse.on('click', (ev) => console.log(ev));
 *   mouse.start();
 */

import { EventEmitter } from 'node:events';
import { Terminal, ANSI } from './Terminal.js';

/**
 * Mouse button
 */
export type MouseButton = 'left' | 'middle' | 'right' | 'none' | 'wheelUp' | 'wheelDown';

/**
 * Mouse event type
 */
export type MouseEventType =
  | 'click'
  | 'dblclick'
  | 'mousedown'
  | 'mouseup'
  | 'mousemove'
  | 'drag'
  | 'wheel'
  | 'scroll';

/**
 * Mouse event data
 */
export interface MouseEvent {
  /** Event type */
  type: MouseEventType;
  /** Mouse button */
  button: MouseButton;
  /** Column (1-indexed) */
  x: number;
  /** Row (1-indexed) */
  y: number;
  /** Whether shift key was pressed */
  shift: boolean;
  /** Whether alt key was pressed */
  alt: boolean;
  /** Whether ctrl key was pressed */
  ctrl: boolean;
  /** Whether meta key was pressed */
  meta: boolean;
  /** Timestamp of the event */
  timestamp: number;
}

/**
 * Mouse event handler callback
 */
export type MouseEventCallback = (event: MouseEvent) => void;

/**
 * Mouse event names for EventEmitter
 */
export interface MouseEvents {
  click: [MouseEvent];
  dblclick: [MouseEvent];
  mousedown: [MouseEvent];
  mouseup: [MouseEvent];
  mousemove: [MouseEvent];
  drag: [MouseEvent];
  wheel: [MouseEvent];
  scroll: [MouseEvent];
  /** Any mouse event */
  '*': [MouseEvent];
  /** Non-mouse stdin data (keyboard input, escape sequences, etc.) */
  data: [Buffer];
}

/**
 * Mouse handler
 *
 * Provides mouse event handling for terminal applications.
 * Requires SGR mouse mode (supported by most modern terminals).
 */
export class MouseHandler extends EventEmitter {
  private enabled: boolean = false;
  private terminal: Terminal;
  private rawMode: boolean = false;
  /** Debounce threshold for click vs double-click (ms) */
  private clickTimeout: number = 300;
  private lastClick: { button: MouseButton; x: number; y: number; time: number } | null = null;
  private lastButton: MouseButton = 'none';
  private isDragging: boolean = false;
  /** Buffer for partial SGR sequences */
  private buffer: string = '';

  constructor(terminal?: Terminal) {
    super();
    this.terminal = terminal ?? Terminal.get();
  }

  /**
   * Start listening for mouse events
   */
  start(): void {
    if (this.enabled) return;
    if (!this.terminal.features.mouse) {
      return; // Silently skip if mouse is not available
    }

    this.enabled = true;

    // Enable raw mode on stdin
    if (process.stdin.isTTY) {
      this.rawMode = true;
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    // Enable SGR mouse tracking
    process.stdout.write(ANSI.mouseOn);

    // Listen for data
    process.stdin.on('data', this.onData);
  }

  /**
   * Stop listening for mouse events
   */
  stop(): void {
    if (!this.enabled) return;

    this.enabled = false;

    // Disable mouse tracking
    process.stdout.write(ANSI.mouseOff);

    // Restore terminal mode
    process.stdin.off('data', this.onData);
    if (this.rawMode) {
      process.stdin.setRawMode(false);
      this.rawMode = false;
    }
    process.stdin.pause();

    this.removeAllListeners();
  }

  /**
   * Check if mouse handler is active
   */
  get isActive(): boolean {
    return this.enabled;
  }

  /**
   * Set click debounce threshold (ms)
   */
  setClickTimeout(ms: number): void {
    this.clickTimeout = ms;
  }

  // ── Event overrides with typing ──────────────────────────────

  on<E extends keyof MouseEvents>(event: E, listener: (...args: MouseEvents[E]) => void): this {
    return super.on(event, listener);
  }

  once<E extends keyof MouseEvents>(event: E, listener: (...args: MouseEvents[E]) => void): this {
    return super.once(event, listener);
  }

  off<E extends keyof MouseEvents>(event: E, listener: (...args: MouseEvents[E]) => void): this {
    return super.off(event, listener);
  }

  emit<E extends keyof MouseEvents>(event: E, ...args: MouseEvents[E]): boolean {
    // Also emit '*' for mouse events (not 'data' events)
    if (event !== '*' && event !== 'data') {
      super.emit('*', ...args);
    }
    return super.emit(event, ...args);
  }

  // ── Private methods ──────────────────────────────────────────

  /**
   * Process stdin data for mouse events
   *
   * SGR mouse sequences have the form: \x1b[<Cb;Cx;CyM (press) or \x1b[<Cb;Cx;Cym (release)
   * Non-mouse data is forwarded via the 'data' event for keyboard input handling.
   */
  private onData = (data: Buffer): void => {
    const str = data.toString();

    // If we have a partial buffer, try to complete it
    if (this.buffer) {
      this.buffer += str;
      this.processBuffer();
      return;
    }

    // Check for full SGR mouse sequence in one chunk
    if (str.startsWith('\x1b[<') && /[Mm]$/.test(str)) {
      this.buffer = str;
      this.processBuffer();
      return;
    }

    // Check for potential start of SGR sequence
    if (str.startsWith('\x1b[')) {
      // Could be start of SGR mouse sequence or other escape sequence
      if (str.includes('<')) {
        // Likely SGR mouse - buffer it
        this.buffer = str;
        this.processBuffer();
        return;
      }
      // Other escape sequence (cursor keys, etc.) - forward as data
      this.emit('data', data);
      return;
    }

    // Start of escape sequence (single \x1b)
    if (str === '\x1b') {
      this.buffer = '\x1b';
      return;
    }

    // Regular keyboard input - forward as data
    this.emit('data', data);
  };

  /**
   * Process the buffered escape sequence
   *
   * Attempts to match SGR mouse sequences. If the buffer doesn't match
   * and is clearly not mouse-related, it's flushed as a data event.
   */
  private processBuffer(): void {
    // SGR mouse sequence: \x1b[<Cb;Cx;CyM or \x1b[<Cb;Cx;Cym
    const sgrMatch = this.buffer.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (sgrMatch) {
      const cb = parseInt(sgrMatch[1], 10);
      const x = parseInt(sgrMatch[2], 10);
      const y = parseInt(sgrMatch[3], 10);
      const release = sgrMatch[4] === 'm';

      const event = this.parseSGR(cb, x, y, release);
      if (event) {
        this.handleEvent(event);
      }

      this.buffer = '';
      return;
    }

    // If the buffer doesn't look like an SGR mouse sequence, flush it
    // SGR mouse always has \x1b[< pattern
    if (!this.buffer.startsWith('\x1b[<')) {
      this.emit('data', Buffer.from(this.buffer, 'utf-8'));
      this.buffer = '';
      return;
    }

    // Buffer is too long without matching - likely corrupted, flush it
    if (this.buffer.length > 50) {
      this.emit('data', Buffer.from(this.buffer, 'utf-8'));
      this.buffer = '';
    }
  }

  /**
   * Parse SGR mouse parameters into MouseEvent
   *
   * SGR Cb encoding:
   *   bits 0-1: button (0=left, 1=middle, 2=right, 3=release)
   *   bit 2: shift
   *   bit 3: alt/meta
   *   bit 4: ctrl
   *   bit 5: motion (1 if motion)
   *   bit 6: wheel (1 if wheel event)
   *   bit 7: additional button
   */
  private parseSGR(cb: number, x: number, y: number, release: boolean): MouseEvent | null {
    // Extract button
    const buttonBits = cb & 0b11;
    let button: MouseButton;
    let eventType: MouseEventType;

    // Check for wheel event (bit 6)
    if (cb & 64) {
      button = buttonBits === 0 ? 'wheelUp' : 'wheelDown';
      eventType = 'wheel';
    } else {
      switch (buttonBits) {
        case 0:
          button = 'left';
          break;
        case 1:
          button = 'middle';
          break;
        case 2:
          button = 'right';
          break;
        case 3:
          button = 'none';
          break;
        default:
          button = 'none';
      }

      // Determine event type
      if (release) {
        eventType = 'mouseup';
      } else if (cb & 32) {
        // Motion bit set
        if (buttonBits === 3) {
          eventType = 'mousemove';
        } else {
          eventType = 'drag';
        }
      } else {
        eventType = 'mousedown';
      }
    }

    // Extract modifiers
    const shift = (cb & 4) !== 0;
    const alt = (cb & 8) !== 0;
    const ctrl = (cb & 16) !== 0;
    const meta = (cb & 8) !== 0;

    return {
      type: eventType,
      button,
      x,
      y,
      shift,
      alt,
      ctrl,
      meta,
      timestamp: Date.now(),
    };
  }

  /**
   * Handle a mouse event (emit with proper type resolution)
   */
  private handleEvent(event: MouseEvent): void {
    // Track drag state
    if (event.type === 'mousedown') {
      this.lastButton = event.button;
      this.isDragging = false;
    } else if (event.type === 'drag') {
      if (!this.isDragging) {
        this.isDragging = true;
      }
    } else if (event.type === 'mouseup') {
      this.isDragging = false;
      this.lastButton = 'none';
    }

    // Double-click detection
    if (event.type === 'mousedown') {
      const now = Date.now();
      if (
        this.lastClick &&
        this.lastClick.button === event.button &&
        Math.abs(this.lastClick.x - event.x) <= 1 &&
        Math.abs(this.lastClick.y - event.y) <= 1 &&
        now - this.lastClick.time < this.clickTimeout
      ) {
        this.emit('dblclick', { ...event, type: 'dblclick' });
        this.emit('click', { ...event, type: 'click' });
        this.lastClick = null;
        return;
      }
      this.lastClick = { button: event.button, x: event.x, y: event.y, time: now };
    }

    // Emit the event
    if (event.type === 'wheel') {
      this.emit('wheel', event);
      this.emit('scroll', event);
    } else {
      this.emit(event.type, event);

      // Emit click on mouseup (if not dragging)
      if (event.type === 'mouseup' && !this.isDragging) {
        this.emit('click', { ...event, type: 'click' });
      }
    }
  }
}

/**
 * Create a mouse handler
 */
export function createMouseHandler(terminal?: Terminal): MouseHandler {
  return new MouseHandler(terminal);
}
