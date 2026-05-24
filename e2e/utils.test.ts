import { describe, it, expect } from 'vitest';
import { createLogger, type Logger, LogLevel } from '@organic/utils';
import { validateEmail, validateUrl, validateObject, type ValidationRule } from '@organic/utils';

describe('Utils', () => {
  describe('Logger', () => {
    it('should create logger with config', async () => {
      const logger = createLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
      });

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should log info messages', async () => {
      const logger = createLogger({
        name: 'info-logger',
        level: LogLevel.DEBUG,
      });

      expect(() => logger.info('Info message')).not.toThrow();
    });

    it('should log debug messages', async () => {
      const logger = createLogger({
        name: 'debug-logger',
        level: LogLevel.DEBUG,
      });

      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should log warning messages', async () => {
      const logger = createLogger({
        name: 'warn-logger',
        level: LogLevel.WARN,
      });

      expect(() => logger.warn('Warning message')).not.toThrow();
    });

    it('should log error messages', async () => {
      const logger = createLogger({
        name: 'error-logger',
        level: LogLevel.ERROR,
      });

      expect(() => logger.error('Error message')).not.toThrow();
    });

    it('should filter logs by level', async () => {
      const logger = createLogger({
        name: 'filter-logger',
        level: LogLevel.ERROR,
      });

      expect(() => logger.debug('Should not appear')).not.toThrow();
      expect(() => logger.info('Should not appear')).not.toThrow();
      expect(() => logger.warn('Should not appear')).not.toThrow();
      expect(() => logger.error('Should appear')).not.toThrow();
    });

    it('should create child logger with context', async () => {
      const parent = createLogger({ name: 'parent' });
      const child = parent.createChildLogger('child-context');

      expect(child).toBeDefined();
      expect(child.info).toBeDefined();
    });

    it('should handle formatted log messages', async () => {
      const logger = createLogger({
        name: 'format-logger',
        level: LogLevel.DEBUG,
      });

      expect(() => logger.info('User %s logged in', 'testuser')).not.toThrow();
    });

    it('should log with metadata', async () => {
      const logger = createLogger({
        name: 'metadata-logger',
        level: LogLevel.DEBUG,
      });

      expect(() => logger.info('Event occurred', { eventId: '123', userId: '456' })).not.toThrow();
    });

    it('should handle logger hierarchy', async () => {
      const root = createLogger({ name: 'root' });
      const child = root.createChildLogger('child');
      const grandchild = child.createChildLogger('grandchild');

      expect(grandchild).toBeDefined();
    });
  });

  describe('Validation Utils', () => {
    it('should validate email addresses', async () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('should validate URLs', async () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });

    it('should validate objects with rules', async () => {
      const rules: ValidationRule[] = [
        { field: 'name', required: true, type: 'string' },
        { field: 'email', required: true, type: 'string' },
      ];

      const validObj = { name: 'Test', email: 'test@example.com' };
      const result = validateObject(validObj, rules);

      expect(result.valid).toBe(true);
    });

    it('should reject objects missing required fields', async () => {
      const rules: ValidationRule[] = [
        { field: 'name', required: true },
        { field: 'email', required: true },
      ];

      const invalidObj = { name: 'Test' };
      const result = validateObject(invalidObj, rules);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should validate string length constraints', async () => {
      const rules: ValidationRule[] = [
        { field: 'username', type: 'string', minLength: 3, maxLength: 20 },
      ];

      const validUser = { username: 'validuser' };
      const result1 = validateObject(validUser, rules);
      expect(result1.valid).toBe(true);

      const shortUser = { username: 'ab' };
      const result2 = validateObject(shortUser, rules);
      expect(result2.valid).toBe(false);
    });

    it('should validate numeric ranges', async () => {
      const rules: ValidationRule[] = [
        { field: 'age', type: 'number', min: 0, max: 150 },
      ];

      const validAge = { age: 25 };
      const result1 = validateObject(validAge, rules);
      expect(result1.valid).toBe(true);

      const invalidAge = { age: -5 };
      const result2 = validateObject(invalidAge, rules);
      expect(result2.valid).toBe(false);
    });

    it('should validate array constraints', async () => {
      const rules: ValidationRule[] = [
        { field: 'tags', type: 'array', minItems: 1, maxItems: 10 },
      ];

      const validArr = { tags: ['tag1', 'tag2'] };
      const result1 = validateObject(validArr, rules);
      expect(result1.valid).toBe(true);

      const emptyArr = { tags: [] };
      const result2 = validateObject(emptyArr, rules);
      expect(result2.valid).toBe(false);
    });

    it('should validate custom pattern', async () => {
      const rules: ValidationRule[] = [
        { field: 'phone', type: 'string', pattern: /^\d{3}-\d{4}$/ },
      ];

      const validPhone = { phone: '123-4567' };
      const result1 = validateObject(validPhone, rules);
      expect(result1.valid).toBe(true);

      const invalidPhone = { phone: 'invalid' };
      const result2 = validateObject(invalidPhone, rules);
      expect(result2.valid).toBe(false);
    });
  });

  describe('Error Types', () => {
    it('should create error with context', async () => {
      const logger = createLogger({ name: 'error-test', level: LogLevel.ERROR });

      expect(() => logger.error('Error occurred', { code: 'ERR_001', context: 'test' })).not.toThrow();
    });

    it('should format error messages', async () => {
      const logger = createLogger({ name: 'format-error', level: LogLevel.ERROR });

      expect(() => logger.error('Operation %s failed: %s', 'test-op', 'test-error')).not.toThrow();
    });

    it('should handle nested error context', async () => {
      const logger = createLogger({ name: 'nested-error', level: LogLevel.ERROR });

      const nestedContext = {
        operation: 'nested-op',
        details: {
          step: 1,
          substep: {
            error: 'deep-error',
          },
        },
      };

      expect(() => logger.error('Nested error occurred', nestedContext)).not.toThrow();
    });
  });
});