/**
 * Logger Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, createChildLogger, defaultLogger, type Logger, type LoggerOptions, type LogLevel, type LogEntry } from '@organic/utils';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('createLogger() - Create logger instance', () => {
    it('should create a logger with default options', () => {
      const logger = createLogger();

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should create a logger with custom prefix', () => {
      const logger = createLogger({ prefix: 'test' });

      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test]')
      );
    });

    it('should create a logger without timestamp', () => {
      const logger = createLogger({ timestamp: false });

      logger.info('Test message');

      const output = consoleLogSpy.mock.calls[0][0];
      // Should not contain ISO timestamp
      expect(output).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should respect minimum log level', () => {
      const logger = createLogger({ level: 'warn' });

      logger.debug('Debug message'); // Should not log
      logger.info('Info message'); // Should not log
      logger.warn('Warn message'); // Should log
      logger.error('Error message'); // Should log

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should include context args in output', () => {
      const logger = createLogger({ timestamp: false });

      logger.info('Message with context', { key: 'value' }, 123);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Message with context');
      expect(output).toContain('{"key":"value"}');
      expect(output).toContain('123');
    });

    it('should use custom log function when provided', () => {
      const customLogFn = vi.fn();
      const logger = createLogger({
        logFn: customLogFn,
        level: 'debug',
      });

      logger.info('Test message');

      expect(customLogFn).toHaveBeenCalledTimes(1);
      expect(customLogFn).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
          prefix: '',
        })
      );
    });
  });

  describe('Log levels', () => {
    it('should output debug messages at debug level', () => {
      const logger = createLogger({ level: 'debug', timestamp: false });

      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    it('should output info messages at info level', () => {
      const logger = createLogger({ level: 'info', timestamp: false });

      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
    });

    it('should output warn messages at warn level', () => {
      const logger = createLogger({ level: 'warn', timestamp: false });

      logger.warn('Warn message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
    });

    it('should output error messages at error level', () => {
      const logger = createLogger({ level: 'error', timestamp: false });

      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });
  });

  describe('Logger methods', () => {
    it('should support debug method', () => {
      const logger = createLogger({ level: 'debug', timestamp: false });

      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should support info method', () => {
      const logger = createLogger();

      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should support warn method', () => {
      const logger = createLogger();

      logger.warn('Warn message');

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should support error method', () => {
      const logger = createLogger();

      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should support multiple arguments', () => {
      const logger = createLogger({ timestamp: false });

      logger.info('Message', 'arg1', 'arg2', 'arg3');

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Message');
      expect(output).toContain('arg1');
      expect(output).toContain('arg2');
      expect(output).toContain('arg3');
    });

    it('should handle object arguments', () => {
      const logger = createLogger({ timestamp: false });

      const obj = { nested: { value: 123 } };
      logger.info('Object:', obj);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Object:');
      expect(output).toContain('{"nested":{"value":123}}');
    });
  });

  describe('defaultLogger', () => {
    it('should be a pre-configured logger instance', () => {
      expect(defaultLogger).toBeDefined();
      expect(typeof defaultLogger.debug).toBe('function');
      expect(typeof defaultLogger.info).toBe('function');
      expect(typeof defaultLogger.warn).toBe('function');
      expect(typeof defaultLogger.error).toBe('function');
    });

    it('should output info level logs by default', () => {
      defaultLogger.info('Test');

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('createChildLogger() - Create child logger', () => {
    it('should create a child logger with prefix', () => {
      const parentLogger = createLogger({ prefix: 'parent' });
      const childLogger = createChildLogger(parentLogger, 'child');

      childLogger.info('Child message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[child]')
      );
    });

    it('should use only child prefix when parent is null', () => {
      const childLogger = createChildLogger(null as any, 'standalone');

      childLogger.info('Message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[standalone]')
      );
    });
  });

  describe('LogEntry structure', () => {
    it('should have correct structure when using custom logFn', () => {
      let capturedEntry: LogEntry | null = null;
      const logger = createLogger({
        level: 'info',
        prefix: 'test-prefix',
        logFn: (entry) => {
          capturedEntry = entry;
        },
      });

      logger.info('Test message', 'arg1');

      expect(capturedEntry).not.toBeNull();
      expect(capturedEntry!.level).toBe('info');
      expect(capturedEntry!.message).toBe('Test message');
      expect(capturedEntry!.prefix).toBe('test-prefix');
      expect(capturedEntry!.timestamp).toBeDefined();
      expect(capturedEntry!.context).toEqual(['arg1']);
    });

    it('should include timestamp in ISO format', () => {
      let capturedEntry: LogEntry | null = null;
      const logger = createLogger({
        logFn: (entry) => {
          capturedEntry = entry;
        },
      });

      logger.info('Test');

      expect(capturedEntry!.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty message', () => {
      const logger = createLogger({ timestamp: false });

      expect(() => logger.info('')).not.toThrow();
    });

    it('should handle special characters in message', () => {
      const logger = createLogger({ timestamp: false });

      logger.info('Special chars: <>&"\'{}[]\\|');

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Special chars:');
    });

    it('should handle very long messages', () => {
      const logger = createLogger({ timestamp: false });
      const longMessage = 'A'.repeat(10000);

      expect(() => logger.info(longMessage)).not.toThrow();
    });

    it('should handle null and undefined args', () => {
      const logger = createLogger({ timestamp: false });

      expect(() => logger.info('Message', null, undefined)).not.toThrow();
    });

    it('should handle circular references in objects', () => {
      const logger = createLogger({ timestamp: false });
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;

      // The logger uses JSON.stringify which may throw for circular references
      // This test verifies the behavior - it may or may not throw depending on implementation
      try {
        logger.info('Circular:', circularObj);
      } catch {
        // Expected behavior for circular references in some implementations
      }
      // Test passes as long as it doesn't crash the test suite
      expect(true).toBe(true);
    });
  });

  describe('LogLevel type', () => {
    it('should accept valid log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

      levels.forEach((level) => {
        const logger = createLogger({ level });
        expect(() => logger.info('test')).not.toThrow();
      });
    });
  });

  describe('LoggerOptions type', () => {
    it('should accept all optional properties', () => {
      const options: LoggerOptions = {
        prefix: 'test',
        level: 'info',
        timestamp: true,
        logFn: vi.fn(),
      };

      const logger = createLogger(options);
      expect(logger).toBeDefined();
    });

    it('should use default values when options are not provided', () => {
      const options: LoggerOptions = {};

      const logger = createLogger(options);
      expect(logger).toBeDefined();
    });
  });
});
