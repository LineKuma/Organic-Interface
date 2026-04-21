/**
 * Logger utility for Organic Interface
 */

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp of the log entry */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Additional context data */
  context?: unknown[];
  /** Logger prefix */
  prefix?: string;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Logger prefix */
  prefix?: string;
  /** Minimum log level */
  level?: LogLevel;
  /** Whether to include timestamp */
  timestamp?: boolean;
  /** Custom log function */
  logFn?: (entry: LogEntry) => void;
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    prefix = '',
    level = 'info',
    timestamp = true,
    logFn
  } = options;

  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(level);

  const shouldLog = (lvl: LogLevel): boolean => {
    return levels.indexOf(lvl) >= minLevel;
  };

  const formatMessage = (lvl: LogLevel, message: string, args: unknown[]): string => {
    const parts: string[] = [];

    if (timestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${lvl.toUpperCase()}]`);

    if (prefix) {
      parts.push(`[${prefix}]`);
    }

    parts.push(message);

    if (args.length > 0) {
      parts.push(...args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ));
    }

    return parts.join(' ');
  };

  const log = (lvl: LogLevel, message: string, ...args: unknown[]) => {
    if (!shouldLog(lvl)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      message,
      context: args,
      prefix
    };

    if (logFn) {
      logFn(entry);
    } else {
      const formattedMessage = formatMessage(lvl, message, args);
      if (lvl === 'error') {
        console.error(formattedMessage);
      } else if (lvl === 'warn') {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
  };

  return {
    debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
    info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
    warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
    error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
  };
}

/**
 * Default logger instance
 */
export const defaultLogger = createLogger({ level: 'info' });

/**
 * Create a child logger with additional prefix
 */
export function createChildLogger(parent: Logger, childPrefix: string): Logger {
  return createLogger({
    prefix: parent ? `${childPrefix}` : childPrefix,
    level: 'info'
  });
}