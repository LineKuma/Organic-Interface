import { describe, it, expect } from 'vitest';
import { NotFoundError, NotFoundErrorCode } from '../NotFoundError.js';

describe('NotFoundError', () => {
  describe('constructor', () => {
    it('should create error with default code', () => {
      const error = new NotFoundError('Resource not found', 'resource', '123');

      expect(error.message).toBe('Resource not found');
      expect(error.resourceType).toBe('resource');
      expect(error.resourceId).toBe('123');
      expect(error.code).toBe(NotFoundErrorCode.NOT_FOUND);
    });

    it('should create error with custom code', () => {
      const error = new NotFoundError(
        'Plugin not found',
        'plugin',
        'my-plugin',
        NotFoundErrorCode.PLUGIN_NOT_FOUND
      );

      expect(error.code).toBe(NotFoundErrorCode.PLUGIN_NOT_FOUND);
      expect(error.resourceType).toBe('plugin');
      expect(error.resourceId).toBe('my-plugin');
    });

    it('should create error with details', () => {
      const details = { searchPath: '/plugins', attempted: ['a', 'b'] };
      const error = new NotFoundError('Not found', 'resource', 'id', NotFoundErrorCode.NOT_FOUND, details);

      expect(error.details).toEqual(details);
    });

    it('should have correct name', () => {
      const error = new NotFoundError('Not found', 'resource', 'id');

      expect(error.name).toBe('NotFoundError');
    });

    it('should be instance of Error', () => {
      const error = new NotFoundError('Not found', 'resource', 'id');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('static factory methods', () => {
    it('should create plugin not found error', () => {
      const error = NotFoundError.plugin('my-plugin');

      expect(error.message).toBe("Plugin 'my-plugin' not found");
      expect(error.resourceType).toBe('plugin');
      expect(error.resourceId).toBe('my-plugin');
      expect(error.code).toBe(NotFoundErrorCode.PLUGIN_NOT_FOUND);
    });

    it('should create tool not found error', () => {
      const error = NotFoundError.tool('search-tool');

      expect(error.message).toBe("Tool 'search-tool' not found");
      expect(error.resourceType).toBe('tool');
      expect(error.resourceId).toBe('search-tool');
      expect(error.code).toBe(NotFoundErrorCode.TOOL_NOT_FOUND);
    });

    it('should create config not found error', () => {
      const error = NotFoundError.config('api-key');

      expect(error.message).toBe("Configuration 'api-key' not found");
      expect(error.resourceType).toBe('config');
      expect(error.resourceId).toBe('api-key');
      expect(error.code).toBe(NotFoundErrorCode.CONFIG_NOT_FOUND);
    });

    it('should create file not found error', () => {
      const error = NotFoundError.file('/path/to/file.txt');

      expect(error.message).toBe("File '/path/to/file.txt' not found");
      expect(error.resourceType).toBe('file');
      expect(error.resourceId).toBe('/path/to/file.txt');
      expect(error.code).toBe(NotFoundErrorCode.FILE_NOT_FOUND);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new NotFoundError('Not found', 'resource', '123', NotFoundErrorCode.NOT_FOUND);

      const json = error.toJSON();

      expect(json.name).toBe('NotFoundError');
      expect(json.message).toBe('Not found');
      expect(json.code).toBe(NotFoundErrorCode.NOT_FOUND);
      expect(json.resourceType).toBe('resource');
      expect(json.resourceId).toBe('123');
      expect(json.timestamp).toBeDefined();
    });

    it('should include stack trace in JSON', () => {
      const error = new NotFoundError('Not found', 'resource', '123');

      const json = error.toJSON();

      expect(json.stack).toBeDefined();
    });
  });

  describe('error codes enum', () => {
    it('should have correct NOT_FOUND code', () => {
      expect(NotFoundErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    });

    it('should have correct PLUGIN_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.PLUGIN_NOT_FOUND).toBe('PLUGIN_NOT_FOUND');
    });

    it('should have correct TOOL_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
    });

    it('should have correct CONFIG_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    });

    it('should have correct FILE_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    });
  });
});