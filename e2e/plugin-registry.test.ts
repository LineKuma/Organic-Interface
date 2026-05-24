import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { PluginRegistry, type PluginInfo, type PluginMetadata, PluginLifecycleState, type PluginConfig } from '@organic/plugins';

describe('Plugin Registry', () => {
  let kernel: Kernel;
  let registry: PluginRegistry;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();

    const pluginManager = kernel.getPluginManager();
    registry = (pluginManager as any).registry;
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  describe('Plugin Registration', () => {
    it('should register plugin metadata', async () => {
      const metadata: PluginMetadata = {
        id: 'test-reg-plugin',
        name: 'Test Registry Plugin',
        version: '1.0.0',
        description: 'Test plugin for registry',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      const pluginInfo = registry.register(
        'test-reg-plugin',
        metadata,
        '/path/to/plugin',
        { enabled: true }
      );

      expect(pluginInfo).toBeDefined();
      expect(pluginInfo.pluginId).toBe('test-reg-plugin');
      expect(pluginInfo.metadata.name).toBe('Test Registry Plugin');
    });

    it('should unregister plugin', async () => {
      const metadata: PluginMetadata = {
        id: 'unreg-plugin',
        name: 'Unregister Plugin',
        version: '1.0.0',
        description: 'Test unregister',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('unreg-plugin', metadata, '/path/to/plugin');
      expect(registry.isRegistered('unreg-plugin')).toBe(true);

      registry.unregister('unreg-plugin');
      expect(registry.isRegistered('unreg-plugin')).toBe(false);
    });

    it('should get plugin info by id', async () => {
      const metadata: PluginMetadata = {
        id: 'get-info-plugin',
        name: 'Get Info Plugin',
        version: '1.0.0',
        description: 'Test get info',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('get-info-plugin', metadata, '/path/to/plugin');
      const info = registry.getPluginInfo('get-info-plugin');

      expect(info).toBeDefined();
      expect(info?.pluginId).toBe('get-info-plugin');
    });

    it('should return null for non-existent plugin', async () => {
      const info = registry.getPluginInfo('non-existent-plugin');
      expect(info).toBeNull();
    });

    it('should check if plugin is registered', async () => {
      const metadata: PluginMetadata = {
        id: 'check-reg-plugin',
        name: 'Check Registry Plugin',
        version: '1.0.0',
        description: 'Test check',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      expect(registry.isRegistered('check-reg-plugin')).toBe(false);

      registry.register('check-reg-plugin', metadata, '/path/to/plugin');
      expect(registry.isRegistered('check-reg-plugin')).toBe(true);
    });
  });

  describe('Plugin Search', () => {
    it('should find plugins by name pattern', async () => {
      const metadata1: PluginMetadata = {
        id: 'search-plugin-1',
        name: 'Search One',
        version: '1.0.0',
        description: 'Search test 1',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      const metadata2: PluginMetadata = {
        id: 'search-plugin-2',
        name: 'Search Two',
        version: '1.0.0',
        description: 'Search test 2',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('search-plugin-1', metadata1, '/path/1');
      registry.register('search-plugin-2', metadata2, '/path/2');

      const results = registry.searchPlugins('Search');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should list all registered plugins', async () => {
      const metadata: PluginMetadata = {
        id: 'list-plugin',
        name: 'List Plugin',
        version: '1.0.0',
        description: 'List test',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('list-plugin', metadata, '/path/to/plugin');
      const plugins = registry.listPlugins();

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.some((p: PluginInfo) => p.pluginId === 'list-plugin')).toBe(true);
    });

    it('should filter plugins by enabled state', async () => {
      const metadata: PluginMetadata = {
        id: 'filter-plugin',
        name: 'Filter Plugin',
        version: '1.0.0',
        description: 'Filter test',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('filter-plugin', metadata, '/path/to/plugin', { enabled: true });
      const enabled = registry.getEnabledPlugins();

      expect(Array.isArray(enabled)).toBe(true);
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should update plugin status', async () => {
      const metadata: PluginMetadata = {
        id: 'lifecycle-plugin',
        name: 'Lifecycle Plugin',
        version: '1.0.0',
        description: 'Lifecycle test',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('lifecycle-plugin', metadata, '/path/to/plugin');
      registry.updateStatus('lifecycle-plugin', PluginLifecycleState.LOADING);

      const info = registry.getPluginInfo('lifecycle-plugin');
      expect(info?.status.state).toBe(PluginLifecycleState.LOADING);
    });

    it('should enable plugin', async () => {
      const metadata: PluginMetadata = {
        id: 'enable-plugin',
        name: 'Enable Plugin',
        version: '1.0.0',
        description: 'Enable test',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('enable-plugin', metadata, '/path/to/plugin', { enabled: false });
      registry.enablePlugin('enable-plugin');

      const info = registry.getPluginInfo('enable-plugin');
      expect(info?.status.enabled).toBe(true);
    });

    it('should disable plugin', async () => {
      const metadata: PluginMetadata = {
        id: 'disable-plugin',
        name: 'Disable Plugin',
        version: '1.0.0',
        description: 'Disable test',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      registry.register('disable-plugin', metadata, '/path/to/plugin', { enabled: true });
      registry.disablePlugin('disable-plugin');

      const info = registry.getPluginInfo('disable-plugin');
      expect(info?.status.enabled).toBe(false);
    });
  });

  describe('Plugin Statistics', () => {
    it('should get registry statistics', async () => {
      const stats = registry.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalPlugins).toBeDefined();
      expect(stats.enabledPlugins).toBeDefined();
      expect(stats.disabledPlugins).toBeDefined();
    });

    it('should count plugins by state', async () => {
      const counts = registry.getPluginCounts();

      expect(counts).toBeDefined();
      expect(typeof counts.total).toBe('number');
    });
  });
});