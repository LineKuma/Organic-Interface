/**
 * Terminal capability detection and feature management
 *
 * Detects terminal capabilities (color depth, unicode support, etc.)
 * and provides feature toggles for modern terminal features.
 */

/**
 * Terminal color depth
 */
export type ColorDepth = 'truecolor' | '256' | '16' | '8' | 'none';

/**
 * Terminal feature flags
 */
export interface TerminalFeatures {
  /** Whether mouse events are supported */
  mouse: boolean;
  /** Whether true color (24-bit) is supported */
  trueColor: boolean;
  /** Whether 256 colors are supported */
  colors256: boolean;
  /** Whether unicode is supported */
  unicode: boolean;
  /** Whether emoji rendering is reliable */
  emoji: boolean;
  /** Whether alternate screen buffer is available */
  alternateScreen: boolean;
  /** Whether the terminal supports bracketed paste */
  bracketedPaste: boolean;
  /** Whether the terminal supports focus events */
  focusEvents: boolean;
  /** Whether the terminal supports cursor visibility control */
  cursorControl: boolean;
  /** Whether the terminal supports resize events */
  resizeEvents: boolean;
  /** Detected color depth */
  colorDepth: ColorDepth;
  /** Terminal width (columns) */
  width: number;
  /** Terminal height (rows) */
  height: number;
  /** Whether stdin is a TTY */
  isTTY: boolean;
  /** Terminal type ($TERM) */
  termType: string;
  /** Terminal program ($TERM_PROGRAM) */
  termProgram: string;
}

/**
 * Feature toggle configuration
 *
 * All features default to 'auto' (detect from terminal capabilities).
 * Users can override to 'on' or 'off' to force enable/disable.
 */
export interface FeatureConfig {
  mouse: 'auto' | 'on' | 'off';
  trueColor: 'auto' | 'on' | 'off';
  colors256: 'auto' | 'on' | 'off';
  unicode: 'auto' | 'on' | 'off';
  emoji: 'auto' | 'on' | 'off';
  alternateScreen: 'auto' | 'on' | 'off';
  bracketedPaste: 'auto' | 'on' | 'off';
  focusEvents: 'auto' | 'on' | 'off';
  cursorControl: 'auto' | 'on' | 'off';
  resizeEvents: 'auto' | 'on' | 'off';
  /** Force a specific color depth */
  colorDepth: 'auto' | ColorDepth;
  /** Force a specific terminal width */
  width: 'auto' | number;
  /** Force a specific terminal height */
  height: 'auto' | number;
}

/**
 * Default feature configuration (all auto-detect)
 */
export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  mouse: 'auto',
  trueColor: 'auto',
  colors256: 'auto',
  unicode: 'auto',
  emoji: 'auto',
  alternateScreen: 'auto',
  bracketedPaste: 'auto',
  focusEvents: 'auto',
  cursorControl: 'auto',
  resizeEvents: 'auto',
  colorDepth: 'auto',
  width: 'auto',
  height: 'auto',
};

/**
 * Terminal manager
 *
 * Detects terminal capabilities and manages feature toggles.
 * Call `Terminal.init()` once at startup, then use `Terminal.features`
 * to check available capabilities.
 */
export class Terminal {
  private static instance: Terminal | null = null;
  private _features: TerminalFeatures;
  private _config: FeatureConfig;

  private constructor(config?: Partial<FeatureConfig>) {
    this._config = { ...DEFAULT_FEATURE_CONFIG, ...config } as FeatureConfig;
    this._features = this.detectFeatures();
  }

  /**
   * Initialize the terminal manager (singleton)
   */
  static init(config?: Partial<FeatureConfig>): Terminal {
    if (!Terminal.instance) {
      Terminal.instance = new Terminal(config);
    }
    return Terminal.instance;
  }

  /**
   * Get the terminal manager instance
   */
  static get(): Terminal {
    if (!Terminal.instance) {
      Terminal.instance = new Terminal();
    }
    return Terminal.instance;
  }

  /**
   * Reset the terminal manager (for testing)
   */
  static reset(): void {
    Terminal.instance = null;
  }

  /**
   * Get current terminal features
   */
  get features(): Readonly<TerminalFeatures> {
    return this._features;
  }

  /**
   * Get current feature configuration
   */
  get config(): Readonly<FeatureConfig> {
    return this._config;
  }

  /**
   * Update feature configuration and re-detect
   */
  updateConfig(config: Partial<FeatureConfig>): void {
    this._config = { ...this._config, ...config };
    this._features = this.detectFeatures();
  }

  /**
   * Check if a specific feature is available
   */
  isAvailable(feature: keyof TerminalFeatures): boolean {
    return this._features[feature] === true;
  }

  /**
   * Enable a specific feature
   */
  enable(feature: keyof FeatureConfig): void {
    (this._config as unknown as Record<string, string>)[feature] = 'on';
    this._features = this.detectFeatures();
  }

  /**
   * Disable a specific feature
   */
  disable(feature: keyof FeatureConfig): void {
    (this._config as unknown as Record<string, string>)[feature] = 'off';
    this._features = this.detectFeatures();
  }

  /**
   * Get the effective color depth
   */
  get colorDepth(): ColorDepth {
    return this._features.colorDepth;
  }

  /**
   * Get terminal dimensions
   */
  get dimensions(): { width: number; height: number } {
    return { width: this._features.width, height: this._features.height };
  }

  /**
   * Refresh terminal dimensions (call after resize)
   */
  refreshDimensions(): void {
    this._features.width = this.resolveNum(this._config.width, () => process.stdout.columns || 80);
    this._features.height = this.resolveNum(this._config.height, () => process.stdout.rows || 24);
  }

  /**
   * Detect all terminal features
   */
  private detectFeatures(): TerminalFeatures {
    const isTTY = process.stdout.isTTY === true;
    const termType = process.env.TERM || '';
    const termProgram = process.env.TERM_PROGRAM || '';

    return {
      mouse: this.resolve('mouse', () => isTTY && this.supportsMouse(termType, termProgram)),
      trueColor: this.resolve('trueColor', () => this.detectTrueColor()),
      colors256: this.resolve('colors256', () => this.detect256Color()),
      unicode: this.resolve('unicode', () => this.detectUnicode()),
      emoji: this.resolve('emoji', () => this.detectEmoji()),
      alternateScreen: this.resolve('alternateScreen', () => isTTY),
      bracketedPaste: this.resolve('bracketedPaste', () => isTTY),
      focusEvents: this.resolve(
        'focusEvents',
        () => isTTY && this.supportsFocusEvents(termType, termProgram)
      ),
      cursorControl: this.resolve('cursorControl', () => isTTY),
      resizeEvents: this.resolve('resizeEvents', () => isTTY),
      colorDepth: this.resolveColorDepth(),
      width: this.resolveNum(this._config.width, () => process.stdout.columns || 80),
      height: this.resolveNum(this._config.height, () => process.stdout.rows || 24),
      isTTY,
      termType,
      termProgram,
    };
  }

  /**
   * Resolve a feature toggle: auto|on|off -> boolean
   */
  private resolve(key: keyof FeatureConfig, detectFn: () => boolean): boolean {
    const value = this._config[key];
    if (value === 'on') return true;
    if (value === 'off') return false;
    return detectFn();
  }

  /**
   * Resolve a numeric config value
   */
  private resolveNum(value: 'auto' | number, detectFn: () => number): number {
    if (value === 'auto') return detectFn();
    return value;
  }

  /**
   * Resolve color depth
   */
  private resolveColorDepth(): ColorDepth {
    const configDepth = this._config.colorDepth;
    if (configDepth !== 'auto') return configDepth;

    const colorterm = process.env.COLORTERM || '';
    const term = process.env.TERM || '';

    // True color detection
    if (colorterm === 'truecolor' || colorterm === '24bit' || term.includes('24bit')) {
      return 'truecolor';
    }

    // 256 color detection
    if (term.includes('256') || process.env.TERM_PROGRAM === 'iTerm.app') {
      return '256';
    }

    // 16 color detection
    if (term.includes('color') || term.includes('xterm')) {
      return '16';
    }

    // 8 color fallback
    if (process.env.TERM !== 'dumb') {
      return '8';
    }

    return 'none';
  }

  /**
   * Detect true color support
   */
  private detectTrueColor(): boolean {
    const colorterm = process.env.COLORTERM || '';
    if (colorterm === 'truecolor' || colorterm === '24bit') return true;

    const term = process.env.TERM || '';
    if (term.includes('24bit')) return true;

    // Check for known true color terminals
    const termProgram = process.env.TERM_PROGRAM || '';
    if (termProgram === 'iTerm.app' && process.env.TERM_PROGRAM_VERSION) {
      const version = parseFloat(process.env.TERM_PROGRAM_VERSION);
      if (version >= 3) return true;
    }

    if (termProgram === 'WezTerm') return true;
    if (termProgram === 'ghostty') return true;
    if (termProgram === 'kitty') return true;

    return false;
  }

  /**
   * Detect 256 color support
   */
  private detect256Color(): boolean {
    const term = process.env.TERM || '';
    if (term.includes('256color')) return true;
    if (term.includes('256')) return true;
    if (process.env.TERM_PROGRAM === 'iTerm.app') return true;
    return false;
  }

  /**
   * Detect unicode support
   */
  private detectUnicode(): boolean {
    const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE || '';
    return lang.toLowerCase().includes('utf-8') || lang.toLowerCase().includes('utf8');
  }

  /**
   * Detect emoji support
   */
  private detectEmoji(): boolean {
    if (!this.detectUnicode()) return false;

    const termProgram = process.env.TERM_PROGRAM || '';
    const supportedEmojis = [
      'iTerm.app',
      'WezTerm',
      'ghostty',
      'kitty',
      'vscode',
      'Hyper',
      'Windows Terminal',
      'alacritty',
    ];
    return supportedEmojis.some(t => termProgram.includes(t));
  }

  /**
   * Detect mouse support based on terminal type and program
   *
   * Checks both $TERM (capability) and $TERM_PROGRAM (actual terminal)
   * for comprehensive detection across terminal emulators.
   */
  private supportsMouse(termType: string, termProgram: string): boolean {
    const lowerTerm = termType.toLowerCase();
    const lowerProg = termProgram.toLowerCase();

    // Well-known terminal programs that support mouse
    const mousePrograms = [
      'iterm',
      'wezterm',
      'ghostty',
      'kitty',
      'alacritty',
      'vscode',
      'hyper',
      'windows terminal',
      'warp',
      'tabby',
    ];
    if (mousePrograms.some(t => lowerProg.includes(t))) return true;

    // Terminal type capabilities
    const mouseTerms = ['xterm', 'screen', 'tmux', 'rxvt', 'gnome', 'konsole'];
    if (mouseTerms.some(t => lowerTerm.includes(t))) return true;

    // Apple Terminal.app (TERM_PROGRAM=Apple_Terminal)
    if (lowerProg.includes('apple_terminal')) return true;

    return false;
  }

  /**
   * Detect focus event support
   *
   * Focus events (FocusIn/FocusOut) are supported by a subset of terminals.
   */
  private supportsFocusEvents(termType: string, termProgram: string): boolean {
    const lowerTerm = termType.toLowerCase();
    const lowerProg = termProgram.toLowerCase();

    // Terminals known to support focus events
    const focusPrograms = ['iterm', 'kitty', 'wezterm', 'ghostty'];
    if (focusPrograms.some(t => lowerProg.includes(t))) return true;

    if (lowerTerm.includes('xterm')) return true;

    return false;
  }
}

/**
 * Shorthand: get terminal instance
 */
export function terminal(): Terminal {
  return Terminal.get();
}

/**
 * Generic escape sequence builder
 */
export function esc(code: string): string {
  return `\x1b[${code}`;
}

/**
 * Common ANSI escape sequences
 */
export const ANSI = {
  /** Enable mouse tracking (SGR extended mode) */
  mouseOn: esc('?1000h') + esc('?1002h') + esc('?1006h'),
  /** Disable mouse tracking */
  mouseOff: esc('?1006l') + esc('?1002l') + esc('?1000l'),
  /** Enable alternate screen buffer */
  altScreenOn: esc('?1049h'),
  /** Disable alternate screen buffer */
  altScreenOff: esc('?1049l'),
  /** Enable bracketed paste */
  bracketedPasteOn: esc('?2004h'),
  /** Disable bracketed paste */
  bracketedPasteOff: esc('?2004l'),
  /** Enable focus event reporting */
  focusOn: esc('?1004h'),
  /** Disable focus event reporting */
  focusOff: esc('?1004l'),
  /** Show cursor */
  cursorShow: esc('?25h'),
  /** Hide cursor */
  cursorHide: esc('?25l'),
  /** Clear screen */
  clearScreen: esc('2J') + esc('H'),
  /** Save cursor position */
  saveCursor: esc('s'),
  /** Restore cursor position */
  restoreCursor: esc('u'),
  /** Move cursor to position (1-indexed) */
  moveTo: (row: number, col: number): string => esc(`${row};${col}H`),
  /** Move cursor up N rows */
  up: (n: number = 1): string => esc(`${n}A`),
  /** Move cursor down N rows */
  down: (n: number = 1): string => esc(`${n}B`),
  /** Move cursor right N columns */
  right: (n: number = 1): string => esc(`${n}C`),
  /** Move cursor left N columns */
  left: (n: number = 1): string => esc(`${n}D`),
  /** Erase from cursor to end of line */
  eraseLine: esc('K'),
  /** Erase from cursor to end of screen */
  eraseDown: esc('J'),
  /** Reset all attributes */
  reset: esc('0m'),
  /** Bold on */
  bold: esc('1m'),
  /** Dim on */
  dim: esc('2m'),
  /** Italic on */
  italic: esc('3m'),
  /** Underline on */
  underline: esc('4m'),
  /** Blink on */
  blink: esc('5m'),
  /** Inverse on */
  inverse: esc('7m'),
  /** Hidden on */
  hidden: esc('8m'),
  /** Strikethrough on */
  strikethrough: esc('9m'),
} as const;
