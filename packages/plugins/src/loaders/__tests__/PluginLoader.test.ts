import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginLoader } from '../PluginLoader.js';
import type { PluginInterface, PluginMetadata } from '../../interfaces/PluginInterface.js';
import { PluginLifecycleState } from '../../interfaces/PluginInterface.js';
import type { PluginConfig, PluginLoadResult } from '../../interfaces/PluginLoaderInterface.js';

const createMockPlugin = (id: string = 'mock-plugin'): PluginInterface => ({
  name: 'Mock Plugin',
  version: '1.0.0',
  description: 'Mock plugin for testing',
  getMetadata: () => ({
    id,
    name: 'Mock Plugin',
    version: '1.0.0',
    description: 'Mock plugin for testing',
    apiVersion: '1.0.0',
  }),
  initialize: vi.fn().mockResolvedValue({ success: true }),
  shutdown: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn().mockResolvedValue({ success: true, data: {}, executionTime: 0 }),
});

describe('PluginLoader', () => {
  const testDir = '/tmp/test-plugins';

  describe('constructor', () => {
    it('should create loader with default options', () => {
      const loader = new PluginLoader();
      expect(loader).toBeDefined();
    });

    it('should merge custom options with defaults', () => {
      const loader = new PluginLoader({
        baseDir: '/custom/path',
        cacheEnabled: false,
        cacheTtl: 60000,
      });
      expect(loader).toBeDefined();
    });
  });

  describe('load', () => {
    it('should return error for non-existent plugin', async () => {
      const loader = new PluginLoader({ baseDir: '/non-existent' });

      const result = await loader.load('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should report loaded status', () => {
      const loader = new PluginLoader();

      expect(loader.isLoaded('any-plugin')).toBe(false);
    });

    it('should list loaded plugins', () => {
      const loader = new PluginLoader();

      const loaded = loader.listLoaded();

      expect(Array.isArray(loaded)).toBe(true);
    });
  });

  describe('unload', () => {
    it('should handle unloading non-existent plugin', async () => {
      const loader = new PluginLoader();

      await expect(loader.unload('non-existent')).resolves.not.toThrow();
    });
  });

  describe('reload', () => {
    it('should handle reloading non-existent plugin', async () => {
      const loader = new PluginLoader({ baseDir: '/non-existent' });

      const result = await loader.reload('non-existent');

      expect(result.success).toBe(false);
    });
  });

  describe('discover', () => {
    it('should return empty array for non-existent directory', async () => {
      const loader = new PluginLoader({ baseDir: '/non-existent' });

      const results = await loader.discover();

      expect(results).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('should return undefined for non-existent plugin', () => {
      const loader = new PluginLoader();

      const status = loader.getStatus('non-existent');

      expect(status).toBeUndefined();
    });
  });

  describe('validateCompatibility', () => {
    it('should return compatible for valid metadata', async () => {
      const loader = new PluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
      };

      const result = await loader.validateCompatibility(metadata);

      expect(result.compatible).toBe(true);
    });

    it('should add warning for minKernelVersion', async () => {
      const loader = new PluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
        minKernelVersion: '1.0.0',
      };

      const result = await loader.validateCompatibility(metadata);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          code: 'KERNEL_VERSION',
        })
      );
    });

    it('should report error for missing required dependency', async () => {
      const loader = new PluginLoader();
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

    it('should not report error for optional missing dependency', async () => {
      const loader = new PluginLoader();
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
        dependencies: [
          { pluginName: 'missing-dep', versionRange: '1.0.0', optional: true },
        ],
      };

      const result = await loader.validateCompatibility(metadata);

      expect(result.compatible).toBe(true);
    });
  });
});