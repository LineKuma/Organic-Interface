import { describe, it, expect } from 'vitest';
import { NotFoundError, NotFoundErrorCode } from '../NotFoundError.js';

describe('NotFoundError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new NotFoundError('Resource not found', 'user', '123');

      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
      expect(error.resourceType).toBe('user');
      expect(error.resourceId).toBe('123');
    });

    it('should create error with custom code', () => {
      const error = new NotFoundError(
        'Plugin error',
        'plugin',
        'my-plugin',
        NotFoundErrorCode.PLUGIN_NOT_FOUND
      );

      expect(error.code).toBe(NotFoundErrorCode.PLUGIN_NOT_FOUND);
    });

    it('should create error with details', () => {
      const details = { context: 'test' };
      const error = new NotFoundError(
        'Config error',
        'config',
        'db.host',
        NotFoundErrorCode.CONFIG_NOT_FOUND,
        details
      );

      expect(error.details).toEqual(details);
    });

    it('should default code to NOT_FOUND', () => {
      const error = new NotFoundError('Generic not found', 'resource', 'id-123');

      expect(error.code).toBe(NotFoundErrorCode.NOT_FOUND);
    });

    it('should have timestamp', () => {
      const before = Date.now();
      const error = new NotFoundError('Test', 'type', 'id');
      const after = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(before);
      expect(error.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('static factories', () => {
    describe('plugin', () => {
      it('should create plugin not found error', () => {
        const error = NotFoundError.plugin('my-plugin');

        expect(error.message).toBe("Plugin 'my-plugin' not found");
        expect(error.resourceType).toBe('plugin');
        expect(error.resourceId).toBe('my-plugin');
        expect(error.code).toBe(NotFoundErrorCode.PLUGIN_NOT_FOUND);
      });

      it('should include correct error code', () => {
        const error = NotFoundError.plugin('test-plugin');

        expect(error.code).toBe('PLUGIN_NOT_FOUND');
      });
    });

    describe('tool', () => {
      it('should create tool not found error', () => {
        const error = NotFoundError.tool('calculator');

        expect(error.message).toBe("Tool 'calculator' not found");
        expect(error.resourceType).toBe('tool');
        expect(error.resourceId).toBe('calculator');
        expect(error.code).toBe(NotFoundErrorCode.TOOL_NOT_FOUND);
      });

      it('should handle empty tool name', () => {
        const error = NotFoundError.tool('');

        expect(error.message).toBe("Tool '' not found");
      });
    });

    describe('config', () => {
      it('should create config not found error', () => {
        const error = NotFoundError.config('database.host');

        expect(error.message).toBe("Configuration 'database.host' not found");
        expect(error.resourceType).toBe('config');
        expect(error.resourceId).toBe('database.host');
        expect(error.code).toBe(NotFoundErrorCode.CONFIG_NOT_FOUND);
      });

      it('should handle dot-separated config keys', () => {
        const error = NotFoundError.config('app.settings.theme');

        expect(error.resourceId).toBe('app.settings.theme');
      });
    });

    describe('file', () => {
      it('should create file not found error', () => {
        const error = NotFoundError.file('/path/to/file.txt');

        expect(error.message).toBe("File '/path/to/file.txt' not found");
        expect(error.resourceType).toBe('file');
        expect(error.resourceId).toBe('/path/to/file.txt');
        expect(error.code).toBe(NotFoundErrorCode.FILE_NOT_FOUND);
      });

      it('should handle relative paths', () => {
        const error = NotFoundError.file('./relative/path');

        expect(error.resourceId).toBe('./relative/path');
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize basic error', () => {
      const error = new NotFoundError('Test', 'user', '123');
      const json = error.toJSON();

      expect(json.name).toBe('NotFoundError');
      expect(json.message).toBe('Test');
      expect(json.resourceType).toBe('user');
      expect(json.resourceId).toBe('123');
      expect(json.code).toBe(NotFoundErrorCode.NOT_FOUND);
    });

    it('should include parent properties', () => {
      const error = new NotFoundError('Test', 'type', 'id');
      const json = error.toJSON();

      expect(json.timestamp).toBe(error.timestamp);
      expect(json.details).toBeUndefined();
    });

    it('should serialize with details', () => {
      const details = { lookupTime: 100 };
      const error = new NotFoundError('Test', 'type', 'id', NotFoundErrorCode.NOT_FOUND, details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });

    it('should include stack trace', () => {
      const error = new NotFoundError('Stack test', 'type', 'id');
      const json = error.toJSON();

      expect(json.stack).toBeTypeOf('string');
    });
  });

  describe('error codes enum', () => {
    it('should have NOT_FOUND code', () => {
      expect(NotFoundErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    });

    it('should have PLUGIN_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.PLUGIN_NOT_FOUND).toBe('PLUGIN_NOT_FOUND');
    });

    it('should have TOOL_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
    });

    it('should have CONFIG_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    });

    it('should have FILE_NOT_FOUND code', () => {
      expect(NotFoundErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string resourceType', () => {
      const error = new NotFoundError('Error', '', 'some-id');

      expect(error.resourceType).toBe('');
    });

    it('should handle empty string resourceId', () => {
      const error = new NotFoundError('Error', 'type', '');

      expect(error.resourceId).toBe('');
    });

    it('should handle unicode in resourceId', () => {
      const error = NotFoundError.plugin('插件名称');

      expect(error.resourceId).toBe('插件名称');
    });

    it('should handle special characters in resourceId', () => {
      const error = NotFoundError.file('/path with spaces/file[1].txt');

      expect(error.resourceId).toBe('/path with spaces/file[1].txt');
    });
  });
});
