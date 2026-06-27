import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from '../PluginRegistry.js';
import type { PluginMetadata, PluginConfig } from '../../interfaces/PluginInterface.js';
import { PluginLifecycleState } from '../../interfaces/PluginInterface.js';
import type {
  PluginLoaderInterface,
  PluginLoadResult,
  PluginDiscoveryResult,
} from '../../interfaces/PluginLoaderInterface.js';

const createMockLoader = (): PluginLoaderInterface => ({
  load: vi.fn().mockResolvedValue({ success: true } as PluginLoadResult),
  unload: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue({ success: true } as PluginLoadResult),
  discover: vi.fn().mockResolvedValue([] as PluginDiscoveryResult[]),
  getStatus: vi.fn().mockReturnValue(undefined),
  isLoaded: vi.fn().mockReturnValue(false),
  listLoaded: vi.fn().mockReturnValue([]),
  validateCompatibility: vi.fn().mockResolvedValue({ compatible: true, issues: [] }),
});

const createMockMetadata = (overrides: Partial<PluginMetadata> = {}): PluginMetadata => ({
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  apiVersion: '1.0.0',
  ...overrides,
});

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockLoader: PluginLoaderInterface;

  beforeEach(() => {
    mockLoader = createMockLoader();
    registry = new PluginRegistry(mockLoader);
  });

  describe('constructor', () => {
    it('should create registry with provided loader', () => {
      expect(registry).toBeDefined();
    });
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const metadata = createMockMetadata();
      const result = registry.register('plugin-1', metadata, '/path/to/plugin');

      expect(result.pluginId).toBe('plugin-1');
      expect(result.metadata).toEqual(metadata);
      expect(result.packagePath).toBe('/path/to/plugin');
      expect(result.status.state).toBe(PluginLifecycleState.DISCOVERED);
      expect(result.status.enabled).toBe(true);
    });

    it('should register plugin with custom config', () => {
      const metadata = createMockMetadata();
      const config: PluginConfig = { pluginId: 'plugin-1', enabled: false };
      const result = registry.register('plugin-1', metadata, '/path/to/plugin', config);

      expect(result.status.enabled).toBe(false);
      expect(result.config).toEqual(config);
    });

    it('should emit plugin:registered event', () => {
      const metadata = createMockMetadata();
      const handler = vi.fn();
      registry.on('plugin:registered', handler);

      registry.register('plugin-1', metadata, '/path/to/plugin');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:registered',
          data: expect.objectContaining({ pluginId: 'plugin-1' }),
        })
      );
    });

    it('should set installTime to current timestamp', () => {
      const before = Date.now();
      const metadata = createMockMetadata();
      const result = registry.register('plugin-1', metadata, '/path/to/plugin');
      const after = Date.now();

      expect(result.installTime).toBeGreaterThanOrEqual(before);
      expect(result.installTime).toBeLessThanOrEqual(after);
    });
  });

  describe('unregister', () => {
    it('should unregister existing plugin', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');
      registry.unregister('plugin-1');

      expect(registry.isRegistered('plugin-1')).toBe(false);
    });

    it('should emit plugin:unregistered event', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const handler = vi.fn();
      registry.on('plugin:unregistered', handler);

      registry.unregister('plugin-1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:unregistered',
          data: expect.objectContaining({ pluginId: 'plugin-1' }),
        })
      );
    });

    it('should not throw for non-existent plugin', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('getPluginInfo', () => {
    it('should return plugin info for registered plugin', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const info = registry.getPluginInfo('plugin-1');

      expect(info).toBeDefined();
      expect(info?.pluginId).toBe('plugin-1');
    });

    it('should return null for non-existent plugin', () => {
      const info = registry.getPluginInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered plugin', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      expect(registry.isRegistered('plugin-1')).toBe(true);
    });

    it('should return false for unregistered plugin', () => {
      expect(registry.isRegistered('non-existent')).toBe(false);
    });
  });

  describe('listAll', () => {
    it('should return all registered plugins', () => {
      registry.register(
        'plugin-1',
        createMockMetadata({ id: 'plugin-1', name: 'Plugin 1' }),
        '/path/1'
      );
      registry.register(
        'plugin-2',
        createMockMetadata({ id: 'plugin-2', name: 'Plugin 2' }),
        '/path/2'
      );

      const all = registry.listAll();

      expect(all).toHaveLength(2);
    });

    it('should return empty array when no plugins registered', () => {
      expect(registry.listAll()).toEqual([]);
    });
  });

  describe('listIds', () => {
    it('should return all plugin ids', () => {
      registry.register('plugin-1', createMockMetadata(), '/path/1');
      registry.register('plugin-2', createMockMetadata(), '/path/2');

      const ids = registry.listIds();

      expect(ids).toContain('plugin-1');
      expect(ids).toContain('plugin-2');
    });
  });

  describe('listEnabled', () => {
    it('should return only enabled plugins', () => {
      registry.register('plugin-1', createMockMetadata(), '/path/1');
      registry.register('plugin-2', createMockMetadata(), '/path/2', {
        pluginId: 'plugin-2',
        enabled: false,
      });

      const enabled = registry.listEnabled();

      expect(enabled).toHaveLength(1);
      expect(enabled[0].pluginId).toBe('plugin-1');
    });
  });

  describe('listDisabled', () => {
    it('should return only disabled plugins', () => {
      registry.register('plugin-1', createMockMetadata(), '/path/1');
      registry.register('plugin-2', createMockMetadata(), '/path/2', {
        pluginId: 'plugin-2',
        enabled: false,
      });

      const disabled = registry.listDisabled();

      expect(disabled).toHaveLength(1);
      expect(disabled[0].pluginId).toBe('plugin-2');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register(
        'plugin-1',
        createMockMetadata({ id: 'plugin-1', name: 'Alpha Plugin', version: '1.0.0' }),
        '/path/1'
      );
      registry.register(
        'plugin-2',
        createMockMetadata({ id: 'plugin-2', name: 'Beta Plugin', version: '2.0.0' }),
        '/path/2'
      );
      registry.register(
        'plugin-3',
        createMockMetadata({ id: 'plugin-3', name: 'Alpha Plus', version: '1.5.0' }),
        '/path/3'
      );
    });

    it('should search by name pattern', () => {
      const results = registry.search({ name: 'Alpha' });

      expect(results).toHaveLength(2);
    });

    it('should search by enabled status', () => {
      registry.updateStatus('plugin-1', PluginLifecycleState.ACTIVE);

      const results = registry.search({ enabled: true });

      expect(results.every(p => p.status.enabled)).toBe(true);
    });

    it('should search by minimum version', () => {
      const results = registry.search({ minVersion: '2.0.0' });

      expect(results).toHaveLength(1);
      expect(results[0].pluginId).toBe('plugin-2');
    });

    it('should search by maximum version', () => {
      const results = registry.search({ maxVersion: '1.0.0' });

      expect(results).toHaveLength(1);
      expect(results[0].pluginId).toBe('plugin-1');
    });

    it('should search by hasDependency', () => {
      registry.register(
        'dep-plugin',
        createMockMetadata({ id: 'dep-plugin', name: 'Dep Plugin', dependencies: [] }),
        '/dep'
      );
      registry.register(
        'client-plugin',
        createMockMetadata({
          id: 'client-plugin',
          name: 'Client Plugin',
          dependencies: [{ pluginName: 'dep-plugin', versionRange: '1.0.0' }],
        }),
        '/client'
      );

      const results = registry.search({ hasDependency: 'dep-plugin' });

      expect(results.some(p => p.pluginId === 'client-plugin')).toBe(true);
    });
  });

  describe('findDependents', () => {
    it('should find plugins that depend on given plugin', () => {
      registry.register(
        'dep-plugin',
        createMockMetadata({ id: 'dep-plugin', name: 'Dep Plugin' }),
        '/dep'
      );
      registry.register(
        'client-plugin',
        createMockMetadata({
          id: 'client-plugin',
          name: 'Client Plugin',
          dependencies: [{ pluginName: 'dep-plugin', versionRange: '1.0.0' }],
        }),
        '/client'
      );

      const dependents = registry.findDependents('dep-plugin');

      expect(dependents).toHaveLength(1);
      expect(dependents[0].pluginId).toBe('client-plugin');
    });
  });

  describe('load', () => {
    it('should load registered plugin', async () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const result = await registry.load('plugin-1');

      expect(result.success).toBe(true);
      expect(mockLoader.load).toHaveBeenCalledWith('plugin-1', undefined);
    });

    it('should return error for unregistered plugin', async () => {
      const result = await registry.load('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('should update plugin state to ACTIVE on successful load', async () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      await registry.load('plugin-1');

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.status.state).toBe(PluginLifecycleState.ACTIVE);
    });

    it('should emit plugin:loaded event on success', async () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const handler = vi.fn();
      registry.on('plugin:loaded', handler);

      await registry.load('plugin-1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:loaded',
          data: expect.objectContaining({ pluginId: 'plugin-1' }),
        })
      );
    });
  });

  describe('unload', () => {
    it('should unload plugin', async () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      await registry.unload('plugin-1');

      expect(mockLoader.unload).toHaveBeenCalledWith('plugin-1');
    });

    it('should update plugin state to SHUTDOWN', async () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      await registry.unload('plugin-1');

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.status.state).toBe(PluginLifecycleState.SHUTDOWN);
    });

    it('should emit plugin:unloaded event', async () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const handler = vi.fn();
      registry.on('plugin:unloaded', handler);

      await registry.unload('plugin-1');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:unloaded',
          data: expect.objectContaining({ pluginId: 'plugin-1' }),
        })
      );
    });
  });

  describe('enable/disable', () => {
    it('should enable plugin', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin', {
        pluginId: 'plugin-1',
        enabled: false,
      });

      registry.enable('plugin-1');

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.status.enabled).toBe(true);
    });

    it('should emit plugin:enabled event', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin', {
        pluginId: 'plugin-1',
        enabled: false,
      });

      const handler = vi.fn();
      registry.on('plugin:enabled', handler);

      registry.enable('plugin-1');

      expect(handler).toHaveBeenCalled();
    });

    it('should disable plugin', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      registry.disable('plugin-1');

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.status.enabled).toBe(false);
    });

    it('should emit plugin:disabled event', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const handler = vi.fn();
      registry.on('plugin:disabled', handler);

      registry.disable('plugin-1');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update plugin state', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      registry.updateStatus('plugin-1', PluginLifecycleState.ERROR, 'Test error');

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.status.state).toBe(PluginLifecycleState.ERROR);
      expect(info?.status.error).toBe('Test error');
    });

    it('should update lastStateChange timestamp', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');
      const before = Date.now();

      registry.updateStatus('plugin-1', PluginLifecycleState.ACTIVE);

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.status.lastStateChange).toBeGreaterThanOrEqual(before);
    });

    it('should emit plugin:status_changed event', () => {
      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');

      const handler = vi.fn();
      registry.on('plugin:status_changed', handler);

      registry.updateStatus('plugin-1', PluginLifecycleState.ACTIVE);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('discoverPlugins', () => {
    it('should discover and register plugins', async () => {
      const discoveryResults: PluginDiscoveryResult[] = [
        {
          pluginId: 'discovered-plugin',
          source: '/path/to/discovered',
          metadata: createMockMetadata({ id: 'discovered-plugin', name: 'Discovered Plugin' }),
          discoveredAt: Date.now(),
          success: true,
        },
      ];
      mockLoader.discover = vi.fn().mockResolvedValue(discoveryResults);

      const results = await registry.discoverPlugins();

      expect(results).toHaveLength(1);
      expect(registry.isRegistered('discovered-plugin')).toBe(true);
    });

    it('should not register failed discoveries', async () => {
      const discoveryResults: PluginDiscoveryResult[] = [
        {
          pluginId: 'failed-plugin',
          source: '/path/to/failed',
          discoveredAt: Date.now(),
          success: false,
          error: 'Discovery failed',
        },
      ];
      mockLoader.discover = vi.fn().mockResolvedValue(discoveryResults);

      await registry.discoverPlugins();

      expect(registry.isRegistered('failed-plugin')).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should support event unsubscribe via returned function', () => {
      const handler = vi.fn();
      const unsubscribe = registry.on('plugin:registered', handler);

      const metadata = createMockMetadata();
      registry.register('plugin-1', metadata, '/path/to/plugin');
      unsubscribe();
      registry.register(
        'plugin-2',
        createMockMetadata({ id: 'plugin-2', name: 'Plugin 2' }),
        '/path/to/plugin'
      );

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support once event listener', () => {
      const handler = vi.fn();
      registry.once('plugin:registered', handler);

      registry.register('plugin-1', createMockMetadata(), '/path/1');
      registry.register(
        'plugin-2',
        createMockMetadata({ id: 'plugin-2', name: 'Plugin 2' }),
        '/path/2'
      );

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should remove all plugins', () => {
      registry.register('plugin-1', createMockMetadata(), '/path/1');
      registry.register(
        'plugin-2',
        createMockMetadata({ id: 'plugin-2', name: 'Plugin 2' }),
        '/path/2'
      );

      registry.clear();

      expect(registry.listAll()).toHaveLength(0);
    });

    it('should emit registry:cleared event', () => {
      registry.register('plugin-1', createMockMetadata(), '/path/1');

      const handler = vi.fn();
      registry.on('registry:cleared', handler);

      registry.clear();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register('plugin-1', createMockMetadata(), '/path/1');
      registry.register('plugin-2', createMockMetadata(), '/path/2', {
        pluginId: 'plugin-2',
        enabled: false,
      });
      registry.updateStatus('plugin-1', PluginLifecycleState.ACTIVE);

      const stats = registry.getStats();

      expect(stats.totalPlugins).toBe(2);
      expect(stats.enabledPlugins).toBe(1);
      expect(stats.disabledPlugins).toBe(1);
      expect(stats.loadedPlugins).toBe(1);
    });
  });

  describe('version comparison', () => {
    it('should correctly compare semantic versions', () => {
      registry.register('v1', createMockMetadata({ version: '1.0.0' }), '/v1');
      registry.register('v2', createMockMetadata({ version: '2.0.0' }), '/v2');
      registry.register('v1-1', createMockMetadata({ version: '1.1.0' }), '/v1-1');

      const results = registry.search({ minVersion: '1.1.0' });

      expect(results.some(p => p.pluginId === 'v1-1')).toBe(true);
      expect(results.some(p => p.pluginId === 'v2')).toBe(true);
      expect(results.some(p => p.pluginId === 'v1')).toBe(false);
    });
  });

  describe('边界测试', () => {
    it('should return empty array for search with no matches', () => {
      registry.register('plugin-1', createMockMetadata({ name: 'Alpha' }), '/path/1');

      const results = registry.search({ name: 'NonExistent' });

      expect(results).toHaveLength(0);
    });

    it('should return empty array for findDependents with no dependents', () => {
      registry.register('standalone', createMockMetadata({ name: 'Standalone' }), '/path');

      const dependents = registry.findDependents('standalone');

      expect(dependents).toHaveLength(0);
    });

    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();

      expect(stats.totalPlugins).toBe(0);
      expect(stats.enabledPlugins).toBe(0);
      expect(stats.disabledPlugins).toBe(0);
      expect(stats.loadedPlugins).toBe(0);
    });

    it('should return empty arrays for empty registry queries', () => {
      expect(registry.listAll()).toEqual([]);
      expect(registry.listIds()).toEqual([]);
      expect(registry.listEnabled()).toEqual([]);
      expect(registry.listDisabled()).toEqual([]);
    });

    it('should handle unregister on empty registry without throwing', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
      expect(registry.listAll()).toHaveLength(0);
    });

    it('should handle enable/disable on non-existent plugin without throwing', () => {
      expect(() => registry.enable('non-existent')).not.toThrow();
      expect(() => registry.disable('non-existent')).not.toThrow();
    });

    it('should handle updateStatus on non-existent plugin without throwing', () => {
      expect(() =>
        registry.updateStatus('non-existent', PluginLifecycleState.ACTIVE)
      ).not.toThrow();
    });

    it('should handle load on non-existent plugin returning error', async () => {
      const result = await registry.load('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('should handle unload on non-existent plugin without throwing', async () => {
      await expect(registry.unload('non-existent')).resolves.not.toThrow();
    });

    it('should return all plugins when search has no filters', () => {
      registry.register('plugin-1', createMockMetadata({ name: 'Alpha' }), '/path/1');
      registry.register('plugin-2', createMockMetadata({ name: 'Beta' }), '/path/2');

      const results = registry.search({});

      expect(results).toHaveLength(2);
    });

    it('should count loaded plugins across multiple lifecycle states', () => {
      registry.register('active', createMockMetadata(), '/path/1');
      registry.register('running', createMockMetadata(), '/path/2');
      registry.register('discovered', createMockMetadata(), '/path/3');

      registry.updateStatus('active', PluginLifecycleState.ACTIVE);
      registry.updateStatus('running', PluginLifecycleState.RUNNING);
      registry.updateStatus('discovered', PluginLifecycleState.DISCOVERED);

      const stats = registry.getStats();

      expect(stats.totalPlugins).toBe(3);
      expect(stats.loadedPlugins).toBe(2); // ACTIVE + RUNNING
    });

    it('should support multiple event listeners on same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.on('plugin:registered', handler1);
      registry.on('plugin:registered', handler2);

      registry.register('plugin-1', createMockMetadata(), '/path/1');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle clear on empty registry without throwing', () => {
      expect(() => registry.clear()).not.toThrow();
      expect(registry.listAll()).toHaveLength(0);
    });

    it('should handle re-registering same pluginId overwriting previous entry', () => {
      registry.register('plugin-1', createMockMetadata({ name: 'Original' }), '/path/1');
      registry.register('plugin-1', createMockMetadata({ name: 'Updated' }), '/path/2');

      const info = registry.getPluginInfo('plugin-1');
      expect(info?.metadata.name).toBe('Updated');
      expect(registry.listAll()).toHaveLength(1);
    });
  });
});
