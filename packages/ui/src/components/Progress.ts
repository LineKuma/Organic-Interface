/**
 * Progress display component
 */

import { createLogger, type Logger } from '@organic/utils';

/**
 * Progress style
 */
export type ProgressStyle = 'bar' | 'spinner' | 'dots' | 'percentage';

/**
 * Progress configuration
 */
export interface ProgressConfig {
  /** Total number of items */
  total: number;
  /** Current progress */
  current?: number;
  /** Progress label/title */
  label?: string;
  /** Progress style */
  style?: ProgressStyle;
  /** Show percentage */
  showPercentage?: boolean;
  /** Show elapsed time */
  showElapsed?: boolean;
  /** Custom logger */
  logger?: Logger;
  /** Update interval in ms (for spinner/dots) */
  updateInterval?: number;
}

/**
 * Progress state
 */
export interface ProgressState {
  /** Current progress value */
  current: number;
  /** Total progress value */
  total: number;
  /** Whether progress is complete */
  completed: boolean;
  /** Start timestamp */
  startTime: number;
  /** End timestamp (when completed) */
  endTime?: number;
  /** Elapsed time in ms */
  elapsed: number;
  /** Estimated remaining time in ms */
  remaining?: number;
  /** Current percentage (0-100) */
  percentage: number;
}

/**
 * Progress display component
 */
export class Progress {
  private logger: Logger;
  private config: Required<ProgressConfig>;
  private state: ProgressState;
  private intervalId?: ReturnType<typeof setInterval>;
  private lastUpdate: string = '';

  constructor(config: ProgressConfig, logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'progress' });

    this.config = {
      total: config.total,
      current: config.current ?? 0,
      label: config.label ?? 'Progress',
      style: config.style ?? 'bar',
      showPercentage: config.showPercentage ?? true,
      showElapsed: config.showElapsed ?? true,
      updateInterval: config.updateInterval ?? 100,
    };

    this.state = this.createInitialState();
  }

  /**
   * Start the progress display
   */
  start(): void {
    this.state = this.createInitialState();
    this.render();

    if (this.config.style === 'spinner' || this.config.style === 'dots') {
      this.startSpinner();
    }
  }

  /**
   * Update progress
   */
  update(current: number): ProgressState {
    this.state.current = Math.min(current, this.config.total);
    this.state.percentage = (this.state.current / this.config.total) * 100;
    this.state.elapsed = Date.now() - this.state.startTime;

    // Estimate remaining time
    if (this.state.current > 0) {
      const rate = this.state.current / this.state.elapsed;
      const remaining = this.config.total - this.state.current;
      this.state.remaining = remaining / rate;
    }

    if (this.state.current >= this.config.total) {
      this.state.completed = true;
      this.state.endTime = Date.now();
      this.complete();
    } else {
      this.render();
    }

    return this.getState();
  }

  /**
   * Increment progress by a value
   */
  increment(delta: number = 1): ProgressState {
    return this.update(this.state.current + delta);
  }

  /**
   * Mark progress as complete
   */
  complete(): void {
    this.stopSpinner();
    this.state.completed = true;
    this.state.current = this.config.total;
    this.state.percentage = 100;
    this.state.endTime = Date.now();
    this.render();
  }

  /**
   * Stop the progress display
   */
  stop(): void {
    this.stopSpinner();
  }

  /**
   * Get current state
   */
  getState(): Readonly<ProgressState> {
    return { ...this.state };
  }

  /**
   * Render progress based on style
   */
  private render(): void {
    let output: string;

    switch (this.config.style) {
      case 'bar':
        output = this.renderBar();
        break;
      case 'spinner':
        output = this.renderSpinner();
        break;
      case 'dots':
        output = this.renderDots();
        break;
      case 'percentage':
      default:
        output = this.renderPercentage();
    }

    // Clear previous line and write new
    if (this.lastUpdate) {
      process.stdout.write('\r' + ' '.repeat(this.lastUpdate.length) + '\r');
    }
    process.stdout.write(output);
    this.lastUpdate = output;
  }

  /**
   * Render progress bar style
   */
  private renderBar(): string {
    const width = 40;
    const filled = Math.round((this.state.current / this.config.total) * width);
    const empty = width - filled;
    const bar = '='.repeat(filled) + (filled < width ? '>' : '') + ' '.repeat(Math.max(0, empty - 1));
    const percentage = this.state.percentage.toFixed(0).padStart(3);

    const parts: string[] = [];

    if (this.config.label) {
      parts.push(`${this.config.label}:`);
    }

    parts.push(`[${bar}]`);

    if (this.config.showPercentage) {
      parts.push(`${percentage}%`);
    }

    parts.push(`(${this.state.current}/${this.config.total})`);

    if (this.config.showElapsed && this.state.elapsed > 0) {
      parts.push(`${this.formatTime(this.state.elapsed)}`);
    }

    return parts.join(' ');
  }

  /**
   * Render percentage style
   */
  private renderPercentage(): string {
    const parts: string[] = [];

    if (this.config.label) {
      parts.push(`${this.config.label}:`);
    }

    parts.push(`${this.state.percentage.toFixed(1)}%`);

    parts.push(`(${this.state.current}/${this.config.total})`);

    if (this.config.showElapsed && this.state.elapsed > 0) {
      parts.push(`${this.formatTime(this.state.elapsed)}`);
    }

    if (this.state.remaining) {
      parts.push(`ETA: ${this.formatTime(this.state.remaining)}`);
    }

    return parts.join(' ');
  }

  /**
   * Render spinner style
   */
  private renderSpinner(): string {
    const chars = '| / - \\';
    const index = Math.floor(Date.now() / this.config.updateInterval) % chars.length;
    const spinner = chars[index];

    const parts: string[] = [];

    if (this.config.label) {
      parts.push(`${this.config.label}`);
    }

    parts.push(`${spinner}`);

    parts.push(`${this.state.percentage.toFixed(0)}%`);

    parts.push(`(${this.state.current}/${this.config.total})`);

    return parts.join(' ');
  }

  /**
   * Render dots style
   */
  private renderDots(): string {
    const maxDots = 10;
    const filled = Math.round((this.state.current / this.config.total) * maxDots);
    const dots = '.'.repeat(filled) + ' '.repeat(maxDots - filled);

    const parts: string[] = [];

    if (this.config.label) {
      parts.push(`${this.config.label}`);
    }

    parts.push(`[${dots}]`);

    parts.push(`${this.state.percentage.toFixed(0)}%`);

    return parts.join(' ');
  }

  /**
   * Start spinner animation
   */
  private startSpinner(): void {
    this.intervalId = setInterval(() => {
      this.render();
    }, this.config.updateInterval);
  }

  /**
   * Stop spinner animation
   */
  private stopSpinner(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Format time in human-readable format
   */
  private formatTime(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Create initial state
   */
  private createInitialState(): ProgressState {
    return {
      current: this.config.current,
      total: this.config.total,
      completed: false,
      startTime: Date.now(),
      elapsed: 0,
      percentage: (this.config.current / this.config.total) * 100,
    };
  }
}

/**
 * Create a progress instance
 */
export function createProgress(config: ProgressConfig, logger?: Logger): Progress {
  return new Progress(config, logger);
}

/**
 * Simple progress helper for common use cases
 */
export function showProgress(
  label: string,
  current: number,
  total: number,
  style: ProgressStyle = 'bar'
): void {
  const progress = new Progress({ label, total, current, style });
  progress.update(current);
}
