import { describe, it, expect } from 'vitest';
import { BaseError } from '../BaseError.js';

describe('BaseError', () => {
  describe('constructor', () => {
    it('should create error with message only', () => {
      const error = new BaseError('Something went wrong');

      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('BaseError');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.details).toBeUndefined();
    });

    it('should create error with code', () => {
      const error = new BaseError('Custom error', 'CUSTOM_CODE');

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should create error with details', () => {
      const details = { field: 'value', count: 42 };
      const error = new BaseError('Error with details', 'DETAILS_ERROR', details);

      expect(error.details).toEqual(details);
    });

    it('should set timestamp on construction', () => {
      const before = Date.now();
      const error = new BaseError('Test error');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });

    it('should have correct name', () => {
      const error = new BaseError('Test');

      expect(error.name).toBe('BaseError');
    });

    it('should capture stack trace', () => {
      const error = new BaseError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BaseError');
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new BaseError('Test error', 'TEST_CODE', { extra: 'data' });

      const json = error.toJSON();

      expect(json.name).toBe('BaseError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('TEST_CODE');
      expect(json.details).toEqual({ extra: 'data' });
      expect(json.timestamp).toBe(error.timestamp);
      expect(json.stack).toBeDefined();
    });

    it('should include stack in JSON output', () => {
      const error = new BaseError('Test error');

      const json = error.toJSON();

      expect(typeof json.stack).toBe('string');
    });

    it('should handle error without details', () => {
      const error = new BaseError('Simple error');

      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });
  });

  describe('toString', () => {
    it('should return formatted error string', () => {
      const error = new BaseError('Test error', 'TEST_CODE');

      const str = error.toString();

      expect(str).toBe('[TEST_CODE] BaseError: Test error');
    });

    it('should include code and name in output', () => {
      const error = new BaseError('Custom message', 'CUSTOM');

      const str = error.toString();

      expect(str).toContain('CUSTOM');
      expect(str).toContain('BaseError');
      expect(str).toContain('Custom message');
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new BaseError('Test');

      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of BaseError', () => {
      const error = new BaseError('Test');

      expect(error).toBeInstanceOf(BaseError);
    });
  });
});