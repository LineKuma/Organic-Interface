/**
 * TextService - Text interaction service for Kernel
 *
 * Provides text output formatting, ANSI color support, table formatting,
 * list formatting, streaming output, and spinner animations.
 */

import process from 'node:process';

// ==================== Type Definitions ====================

/**
 * Print options for text output
 */
export interface PrintOptions {
  /** Prefix to prepend to the text */
  prefix?: string;
  /** Suffix to append to the text */
  suffix?: string;
  /** Number of spaces to indent */
  indent?: number;
  /** Whether to include timestamp */
  timestamp?: boolean;
  /** Newline after output */
  newline?: boolean;
}

/**
 * Table data structure
 */
export interface TableData {
  /** Column headers */
  headers: string[];
  /** Table rows */
  rows: string[][];
}

/**
 * Table formatting options
 */
export interface TableOptions {
  /** Whether to draw borders */
  borders?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Maximum column width */
  maxWidth?: number;
  /** Custom column widths */
  columnWidths?: number[];
}

/**
 * List formatting options
 */
export interface ListOptions {
  /** Bullet character */
  bullet?: string;
  /** Indentation level */
  indent?: number;
  /** Numbered list */
  numbered?: boolean;
  /** Starting number for numbered list */
  startNumber?: number;
}

/**
 * Stream options for text streaming
 */
export interface StreamOptions {
  /** Whether to flush immediately */
  flush?: boolean;
  /** End with newline */
  endWithNewline?: boolean;
  /** Prefix for each chunk */
  prefix?: string;
}

/**
 * Text style for styled output
 */
export interface TextStyle {
  /** Text color */
  color?: TextColor;
  /** Text background color */
  background?: TextColor;
  /** Bold text */
  bold?: boolean;
  /** Dim text */
  dim?: boolean;
  /** Italic text */
  italic?: boolean;
  /** Underlined text */
  underline?: boolean;
  /** Blinking text */
  blink?: boolean;
  /** Inverse colors */
  inverse?: boolean;
  /** Hidden text */
  hidden?: boolean;
  /** Strikethrough text */
  strikethrough?: boolean;
}

/**
 * Available text colors
 */
export type TextColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

/**
 * Spinner frame type
 */
export type SpinnerFrames = 'dots' | 'line' | 'pipe' | 'moon' | 'ball' | 'arrow';

/**
 * TextStream interface for streaming output
 */
export interface TextStream {
  /** Write a chunk of text */
  write(chunk: string): void;
  /** Write a chunk with newline */
  writeln(chunk?: string): void;
  /** Flush the stream */
  flush(): void;
  /** End the stream */
  end(): void;
}

/**
 * Spinner controller interface
 */
export interface SpinnerController {
  /** Start the spinner */
  start(message?: string): void;
  /** Stop the spinner */
  stop(): void;
  /** Stop with success message */
  success(message?: string): void;
  /** Stop with error message */
  error(message?: string): void;
  /** Stop with custom message and style */
  stopWithMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void;
}

// ==================== ANSI Constants ====================

const ANSI_COLORS: Record<TextColor, string> = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

const ANSI_STYLES: Record<string, string> = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',
};

const SPINNER_FRAMES: Record<SpinnerFrames, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '—', '\\'],
  pipe: ['┤', '┘', '┴', '├', '┬', '┼'],
  moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
  ball: ['◐', '◓', '◑', '◒'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
};

// ==================== TextService Implementation ====================

/**
 * TextService configuration
 */
export interface TextServiceConfig {
  /** Enable ANSI color output */
  enableColor?: boolean;
  /** Enable timestamp in print output */
  enableTimestamp?: boolean;
  /** Default indent level */
  defaultIndent?: number;
  /** Default table options */
  defaultTableOptions?: TableOptions;
  /** Detect terminal capabilities */
  detectTerminal?: boolean;
}

/**
 * TextService - Text interaction service for Kernel
 *
 * Provides text output formatting, ANSI color support, table formatting,
 * list formatting, streaming output, and spinner animations.
 *
 * All CLI text-level input/output support, with optional GUI extensions.
 */
export class TextService {
  private readonly enableColor: boolean;
  private readonly enableTimestamp: boolean;
  private readonly defaultIndent: number;
  private readonly defaultTableOptions: TableOptions;
  private isTTY: boolean;

  constructor(config: TextServiceConfig = {}) {
    this.enableColor = config.enableColor ?? true;
    this.enableTimestamp = config.enableTimestamp ?? false;
    this.defaultIndent = config.defaultIndent ?? 0;
    this.defaultTableOptions = config.defaultTableOptions ?? {
      borders: true,
      align: 'left',
      maxWidth: 80,
    };
    this.isTTY = config.detectTerminal !== false ? process.stdout.isTTY : false;
  }

  // ==================== Basic Output ====================

  /**
   * Print text to stdout
   */
  print(text: string, options: PrintOptions = {}): void {
    const {
      prefix = '',
      suffix = '',
      indent = this.defaultIndent,
      timestamp = this.enableTimestamp,
      newline = false,
    } = options;

    const parts: string[] = [];

    if (timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (prefix) {
      parts.push(prefix);
    }

    if (indent > 0) {
      parts.push(' '.repeat(indent));
    }

    parts.push(text);

    if (suffix) {
      parts.push(suffix);
    }

    const output = parts.join(' ') + (newline ? '\n' : '');
    process.stdout.write(output);
  }

  /**
   * Print text followed by newline
   */
  println(text = ''): void {
    process.stdout.write(text + '\n');
  }

  // ==================== Formatting Output ====================

  /**
   * Format data as a table
   */
  formatTable(data: TableData, options: TableOptions = {}): string {
    const opts = { ...this.defaultTableOptions, ...options };
    const { headers, rows } = data;
    const { borders, align, maxWidth, columnWidths } = opts;

    // Calculate column widths
    const calculatedWidths = columnWidths ?? this.calculateColumnWidths(
      [headers, ...rows],
      maxWidth ?? 80
    );

    const lines: string[] = [];

    // Build top border
    if (borders) {
      const topBorder = '┌' + calculatedWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
      lines.push(topBorder);
    }

    // Build header row
    const headerCells = headers.map((h, i) => this.alignText(h, calculatedWidths[i], align));
    if (borders) {
      lines.push('│' + headerCells.join('│') + '│');
    } else {
      lines.push(headerCells.join('  '));
    }

    // Build header separator
    if (borders) {
      const headerSep = '├' + calculatedWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
      lines.push(headerSep);
    }

    // Build data rows
    for (const row of rows) {
      const cells = row.map((cell, i) => this.alignText(cell, calculatedWidths[i], align));
      if (borders) {
        lines.push('│' + cells.join('│') + '│');
      } else {
        lines.push(cells.join('  '));
      }
    }

    // Build bottom border
    if (borders) {
      const bottomBorder = '└' + calculatedWidths.map(w => '─'.repeat(w)).join('┴') + '┘';
      lines.push(bottomBorder);
    }

    return lines.join('\n');
  }

  /**
   * Format items as a list
   */
  formatList(items: string[], options: ListOptions = {}): string {
    const {
      bullet = '•',
      indent = 0,
      numbered = false,
      startNumber = 1,
    } = options;

    const indentStr = ' '.repeat(indent);
    const lines = items.map((item, index) => {
      if (numbered) {
        return `${indentStr}${startNumber + index}. ${item}`;
      }
      return `${indentStr}${bullet} ${item}`;
    });

    return lines.join('\n');
  }

  /**
   * Format a section with title and content
   */
  formatSection(title: string, content: string, options: { border?: boolean } = {}): string {
    const { border = true } = options;
    const lines: string[] = [];

    if (border) {
      const borderChar = '═';
      const borderLine = borderChar.repeat(title.length + 4);
      lines.push(borderLine);
    }

    lines.push(`  ${title}  `);

    if (border) {
      const borderChar = '═';
      const borderLine = borderChar.repeat(title.length + 4);
      lines.push(borderLine);
    }

    lines.push('');
    lines.push(content);

    return lines.join('\n');
  }

  // ==================== Styled Output (ANSI) ====================

  /**
   * Apply style to text using ANSI codes
   */
  styled(text: string, style: TextStyle): string {
    if (!this.enableColor || !this.isTTY) {
      return text;
    }

    const codes: string[] = [];

    if (style.background) {
      codes.push(this.getBackgroundCode(style.background));
    } else if (style.color) {
      codes.push(ANSI_COLORS[style.color]);
    }

    if (style.bold) codes.push(ANSI_STYLES.bold);
    if (style.dim) codes.push(ANSI_STYLES.dim);
    if (style.italic) codes.push(ANSI_STYLES.italic);
    if (style.underline) codes.push(ANSI_STYLES.underline);
    if (style.blink) codes.push(ANSI_STYLES.blink);
    if (style.inverse) codes.push(ANSI_STYLES.inverse);
    if (style.hidden) codes.push(ANSI_STYLES.hidden);
    if (style.strikethrough) codes.push(ANSI_STYLES.strikethrough);

    return codes.join('') + text + ANSI_STYLES.reset;
  }

  /**
   * Print success message (green)
   */
  success(text: string): string {
    return this.styled(text, { color: 'green', bold: true });
  }

  /**
   * Print error message (red)
   */
  error(text: string): string {
    return this.styled(text, { color: 'red', bold: true });
  }

  /**
   * Print warning message (yellow)
   */
  warning(text: string): string {
    return this.styled(text, { color: 'yellow', bold: true });
  }

  /**
   * Print info message (cyan)
   */
  info(text: string): string {
    return this.styled(text, { color: 'cyan' });
  }

  // ==================== Streaming Output ====================

  /**
   * Create a text stream for continuous output
   */
  createStream(options: StreamOptions = {}): TextStream {
    const {
      flush = false,
      endWithNewline = true,
      prefix = '',
    } = options;

    let buffer = '';
    let isActive = true;

    return {
      write(chunk: string): void {
        if (!isActive) return;
        const output = prefix + chunk;
        process.stdout.write(output);
      },

      writeln(chunk = ''): void {
        if (!isActive) return;
        process.stdout.write(prefix + chunk + '\n');
      },

      flush(): void {
        if (buffer) {
          process.stdout.write(buffer);
          buffer = '';
        }
      },

      end(): void {
        isActive = false;
        if (buffer && endWithNewline) {
          process.stdout.write(buffer + '\n');
          buffer = '';
        }
      },
    };
  }

  // ==================== Progress Display ====================

  /**
   * Generate a progress bar string
   */
  progress(current: number, total: number, message = '', options: { width?: number; showPercent?: boolean } = {}): string {
    const { width = 40, showPercent = true } = options;
    const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentStr = showPercent ? ` ${percent.toFixed(0)}%` : '';

    return `[${bar}]${percentStr} ${current}/${total} ${message}`;
  }

  /**
   * Create a spinner controller
   */
  spinner(type: SpinnerFrames = 'dots'): SpinnerController {
    let frameIndex = 0;
    let currentMessage = '';
    let isRunning = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const frames = SPINNER_FRAMES[type];
    const self = this;

    const clearLine = (): void => {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
    };

    const render = (): void => {
      clearLine();
      const frame = frames[frameIndex % frames.length];
      const output = self.enableColor
        ? `${self.styled(frame, { color: 'cyan' })} ${currentMessage || 'Loading...'}`
        : `${frame} ${currentMessage || 'Loading...'}`;
      process.stdout.write(output);
      frameIndex++;
    };

    return {
      start(message?: string): void {
        if (isRunning) return;
        isRunning = true;
        currentMessage = message ?? '';
        frameIndex = 0;
        render();
        intervalId = setInterval(render, 100);
      },

      stop(): void {
        if (!isRunning) return;
        isRunning = false;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        clearLine();
      },

      success(message?: string): void {
        this.stop();
        const msg = message ?? currentMessage ?? 'Done';
        process.stdout.write(self.success(`✓ ${msg}`) + '\n');
      },

      error(message?: string): void {
        this.stop();
        const msg = message ?? currentMessage ?? 'Failed';
        process.stdout.write(self.error(`✗ ${msg}`) + '\n');
      },

      stopWithMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
        this.stop();
        const styledMsg = type === 'success'
          ? self.success(`✓ ${message}`)
          : type === 'error'
          ? self.error(`✗ ${message}`)
          : type === 'warning'
          ? self.warning(`⚠ ${message}`)
          : self.info(`ℹ ${message}`);
        process.stdout.write(styledMsg + '\n');
      },
    };
  }

  // ==================== Helper Methods ====================

  /**
   * Calculate optimal column widths for a table
   */
  private calculateColumnWidths(rows: string[][], maxWidth: number): number[] {
    if (rows.length === 0) return [];

    const numCols = Math.max(...rows.map(r => r.length));
    const widths: number[] = new Array(numCols).fill(0);

    // Find max width for each column
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        const cellLength = this.stripAnsi(row[i]).length;
        widths[i] = Math.max(widths[i], cellLength);
      }
    }

    // Distribute available width proportionally
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + (numCols - 1) * 2;
    const availableWidth = maxWidth - numCols - 1; // Account for borders and separators

    if (totalWidth > availableWidth) {
      const scale = availableWidth / totalWidth;
      for (let i = 0; i < numCols; i++) {
        widths[i] = Math.max(3, Math.floor(widths[i] * scale));
      }
    }

    return widths;
  }

  /**
   * Align text within a column
   */
  private alignText(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
    const cleanText = this.stripAnsi(text);
    const padding = Math.max(0, width - cleanText.length);

    if (align === 'right') {
      return ' '.repeat(padding) + text;
    } else if (align === 'center') {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + text + ' '.repeat(right);
    }

    // left align
    return text + ' '.repeat(padding);
  }

  /**
   * Strip ANSI codes from text for length calculation
   */
  private stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get ANSI background color code
   */
  private getBackgroundCode(color: TextColor): string {
    const bgColors: Record<TextColor, string> = {
      black: '\x1b[40m',
      red: '\x1b[41m',
      green: '\x1b[42m',
      yellow: '\x1b[43m',
      blue: '\x1b[44m',
      magenta: '\x1b[45m',
      cyan: '\x1b[46m',
      white: '\x1b[47m',
      gray: '\x1b[100m',
      brightRed: '\x1b[101m',
      brightGreen: '\x1b[102m',
      brightYellow: '\x1b[103m',
      brightBlue: '\x1b[104m',
      brightMagenta: '\x1b[105m',
      brightCyan: '\x1b[106m',
      brightWhite: '\x1b[107m',
    };
    return bgColors[color];
  }
}
