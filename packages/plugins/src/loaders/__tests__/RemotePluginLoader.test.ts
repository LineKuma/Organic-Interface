import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemotePluginLoader } from '../RemotePluginLoader.js';
import type { RemotePluginSource } from '../../interfaces/PluginLoaderInterface.js';
import type { PluginMetadata } from '../../interfaces/PluginInterface.js';

/**
 * Mock http module to simulate download timeout without real network access.
 * Uses vi.hoisted() because vi.mock is hoisted to the top of the file
 * and needs access to pre-initialized mock variables.
 */
const { mockHttpReq, mockHttpGet } = vi.hoisted(() => {
  const mockHttpReq = {
    on: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    mockHttpReq,
    mockHttpGet: vi.fn(() => mockHttpReq),
  };
});

vi.mock('http', () => ({
  get: mockHttpGet,
}));

describe('RemotePluginLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should create loader with default options', () => {
      const loader = new RemotePluginLoader();
      expect(loader).toBeDefined();
    });

    it('should merge custom options with defaults', () => {
      const loader = new RemotePluginLoader({
        installDir: '/custom/plugins',
        registryUrl: 'https://custom.registry.com',
        timeout: 60000,
        verifySsl: false,
      });
      expect(loader).toBeDefined();
    });
  });

  // ==================== registerSource / unregisterSource ====================

  describe('registerSource / unregisterSource', () => {
    it('should register a remote source and allow loading it', async () => {
      const loader = new RemotePluginLoader();
      const source: RemotePluginSource = {
        pluginId: 'test-plugin',
        url: 'npm:test-plugin',
        type: 'npm',
      };
      loader.registerSource('test-plugin', source);

      const result = await loader.load('test-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });

    it('should return error when source is unregistered', async () => {
      const loader = new RemotePluginLoader();
      const source: RemotePluginSource = {
        pluginId: 'test-plugin',
        url: 'npm:test-plugin',
        type: 'npm',
      };
      loader.registerSource('test-plugin', source);
      loader.unregisterSource('test-plugin');

      const result = await loader.load('test-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote source not found for plugin: test-plugin');
    });
  });

  // ==================== Delegation methods ====================

  describe('getStatus', () => {
    it('should return undefined for unknown plugin', () => {
      const loader = new RemotePluginLoader();
      expect(loader.getStatus('non-existent')).toBeUndefined();
    });
  });

  describe('isLoaded', () => {
    it('should return false for unknown plugin', () => {
      const loader = new RemotePluginLoader();
      expect(loader.isLoaded('non-existent')).toBe(false);
    });
  });

  describe('listLoaded', () => {
    it('should return empty array initially', () => {
      const loader = new RemotePluginLoader();
      expect(loader.listLoaded()).toEqual([]);
    });
  });

  describe('discover', () => {
    it('should return empty array', async () => {
      const loader = new RemotePluginLoader();
      const results = await loader.discover();
      expect(results).toEqual([]);
    });
  });

  describe('validateCompatibility', () => {
    it('should return compatible for valid metadata', async () => {
      const loader = new RemotePluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
      };

      const result = await loader.validateCompatibility(metadata);
      expect(result.compatible).toBe(true);
    });

    it('should report error for missing required dependency', async () => {
      const loader = new RemotePluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
        dependencies: [
          { pluginName: 'missing-dep', versionRange: '1.0.0', optional: false },
        ],
      };

      const result = await loader.validateCompatibility(metadata);
      expect(result.compatible).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          code: 'MISSING_DEPENDENCY',
        })
      );
    });
  });

  // ==================== load ====================

  describe('load', () => {
    it('should return error when source is not registered', async () => {
      const loader = new RemotePluginLoader();
      const result = await loader.load('unknown-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote source not found for plugin: unknown-plugin');
    });

    it('should return error for npm source type (not yet implemented)', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('npm-plugin', {
        pluginId: 'npm-plugin',
        url: 'npm:@scope/package',
        type: 'npm',
      });

      const result = await loader.load('npm-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });

    it('should return error for git source type (not yet implemented)', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('git-plugin', {
        pluginId: 'git-plugin',
        url: 'git:https://github.com/example/repo.git',
        type: 'git',
      });

      const result = await loader.load('git-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Git repository cloning not yet implemented');
    });

    it('should return error for unsupported source type', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('file-plugin', {
        pluginId: 'file-plugin',
        url: '/local/path/plugin.js',
        type: 'file',
      });

      const result = await loader.load('file-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported source type: file');
    });

    it('should handle HTTP download timeout', async () => {
      // Configure mock to immediately trigger timeout callback when handler is registered
      mockHttpReq.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'timeout') {
          callback();
        }
      });

      const loader = new RemotePluginLoader({ timeout: 1000 });
      loader.registerSource('http-plugin', {
        pluginId: 'http-plugin',
        url: 'http://example.com/plugin.js',
        type: 'http',
      });

      const result = await loader.load('http-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Download timed out');
      expect(mockHttpReq.destroy).toHaveBeenCalled();
    });
  });

  // ==================== unload ====================

  describe('unload', () => {
    it('should unload without throwing for unknown plugin', async () => {
      const loader = new RemotePluginLoader();
      await expect(loader.unload('non-existent')).resolves.not.toThrow();
    });

    it('should handle unload then load with unregistered source', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('test-plugin', {
        pluginId: 'test-plugin',
        url: 'git:https://example.com/repo',
        type: 'git',
      });

      await loader.unload('test-plugin');

      // After unload, the source is still registered but cache is cleared,
      // so load will attempt install again
      const result = await loader.load('test-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Git repository cloning not yet implemented');
    });
  });

  // ==================== reload ====================

  describe('reload', () => {
    it('should return error for unknown plugin', async () => {
      const loader = new RemotePluginLoader();
      const result = await loader.reload('unknown-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote source not found for plugin: unknown-plugin');
    });

    it('should reload and return install error for npm plugin', async () => {
      const loader = new RemotePluginLoader();
      loader.registerSource('npm-plugin', {
        pluginId: 'npm-plugin',
        url: 'npm:package',
        type: 'npm',
      });

      const result = await loader.reload('npm-plugin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('NPM package installation not yet implemented');
    });
  });
});