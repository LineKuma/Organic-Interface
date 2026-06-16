import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PluginLoader } from '../PluginLoader.js';
import type { PluginInterface, PluginMetadata } from '../../interfaces/PluginInterface.js';
import { PluginLifecycleState } from '../../interfaces/PluginInterface.js';

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
        dependencies: [{ pluginName: 'missing-dep', versionRange: '1.0.0', optional: false }],
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
        dependencies: [{ pluginName: 'missing-dep', versionRange: '1.0.0', optional: true }],
      };

      const result = await loader.validateCompatibility(metadata);

      expect(result.compatible).toBe(true);
    });
  });

  // ==================== 补充测试用例 ====================

  describe('unload - 已缓存插件', () => {
    it('should call shutdown and update status to SHUTDOWN for cached plugin with shutdown method', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-unload' });
      const pluginWithShutdown = createMockPlugin('cached-plugin');
      const shutdownSpy = pluginWithShutdown.shutdown as ReturnType<typeof vi.fn>;

      // 手动将插件添加到缓存（通过反射访问私有属性）
      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('cached-plugin', {
        plugin: pluginWithShutdown,
        metadata: pluginWithShutdown.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      // 验证插件已缓存
      expect(testLoader.isLoaded('cached-plugin')).toBe(true);

      // 执行 unload
      await testLoader.unload('cached-plugin');

      // 验证 shutdown 被调用
      expect(shutdownSpy).toHaveBeenCalledTimes(1);

      // 验证状态更新为 SHUTDOWN
      const status = testLoader.getStatus('cached-plugin');
      expect(status?.state).toBe(PluginLifecycleState.SHUTDOWN);

      // 验证插件已从缓存移除
      expect(testLoader.isLoaded('cached-plugin')).toBe(false);
    });

    it('should handle plugin without shutdown method gracefully', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-unload2' });
      const pluginWithoutShutdown: PluginInterface = {
        name: 'No Shutdown Plugin',
        version: '1.0.0',
        description: 'Plugin without shutdown',
        getMetadata: () => ({
          id: 'no-shutdown-plugin',
          name: 'No Shutdown Plugin',
          version: '1.0.0',
          description: 'Plugin without shutdown',
          apiVersion: '1.0.0',
        }),
        initialize: vi.fn().mockResolvedValue({ success: true }),
        execute: vi.fn().mockResolvedValue({ success: true, data: {}, executionTime: 0 }),
      };

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('no-shutdown-plugin', {
        plugin: pluginWithoutShutdown,
        metadata: pluginWithoutShutdown.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      await expect(testLoader.unload('no-shutdown-plugin')).resolves.not.toThrow();

      const status = testLoader.getStatus('no-shutdown-plugin');
      expect(status?.state).toBe(PluginLifecycleState.SHUTDOWN);
      expect(testLoader.isLoaded('no-shutdown-plugin')).toBe(false);
    });

    it('should handle shutdown error gracefully', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-unload3' });
      const mockPlugin = createMockPlugin('error-shutdown-plugin');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 让 shutdown 抛出错误
      (mockPlugin.shutdown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Shutdown failed')
      );

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('error-shutdown-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      await expect(testLoader.unload('error-shutdown-plugin')).resolves.not.toThrow();

      // 验证错误被记录
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('error-shutdown-plugin'),
        expect.any(Error)
      );

      // 状态仍应更新为 SHUTDOWN
      const status = testLoader.getStatus('error-shutdown-plugin');
      expect(status?.state).toBe(PluginLifecycleState.SHUTDOWN);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('reload - 完整流程', () => {
    it('should call unload then load during reload', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-reload' });
      const mockPlugin = createMockPlugin('reload-test');

      // 设置缓存和配置
      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('reload-test', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: { enabled: true, customSetting: 'value' },
      });
      // reload 方法会查找 pluginId + '_config' 的配置
      cache.set('reload-test_config', {
        config: { enabled: true, customSetting: 'value' },
      } as any);

      // Mock unload 和 load
      const unloadSpy = vi.spyOn(testLoader, 'unload').mockResolvedValue(undefined);
      const loadSpy = vi.spyOn(testLoader, 'load').mockResolvedValue({
        success: true,
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
      });

      await testLoader.reload('reload-test');

      expect(unloadSpy).toHaveBeenCalledWith('reload-test');
      expect(loadSpy).toHaveBeenCalledWith('reload-test', {
        enabled: true,
        customSetting: 'value',
      });
    });

    it('should handle reload with config', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-reload-config' });
      const mockPlugin = createMockPlugin('reload-config-test');

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('reload-config-test', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: { priority: 5 },
      });
      cache.set('reload-config-test_config', {
        config: { priority: 10, featureFlag: true },
      } as any);

      vi.spyOn(testLoader, 'unload').mockResolvedValue(undefined);
      const loadSpy = vi.spyOn(testLoader, 'load').mockResolvedValue({
        success: false,
        error: 'Plugin not found: reload-config-test',
      });

      const result = await testLoader.reload('reload-config-test');

      expect(result.success).toBe(false);
      expect(loadSpy).toHaveBeenCalledWith('reload-config-test', {
        priority: 10,
        featureFlag: true,
      });
    });

    it('should pass undefined config when no _config cache entry exists', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-reload-noconfig' });
      const mockPlugin = createMockPlugin('reload-noconfig-test');

      // 只设置主缓存，不设置 _config 缓存
      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('reload-noconfig-test', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      vi.spyOn(testLoader, 'unload').mockResolvedValue(undefined);
      const loadSpy = vi.spyOn(testLoader, 'load').mockResolvedValue({
        success: false,
        error: 'not found',
      });

      await testLoader.reload('reload-noconfig-test');

      // 应该传入 undefined 作为 config
      expect(loadSpy).toHaveBeenCalledWith('reload-noconfig-test', undefined);
    });
  });

  describe('discover - 真实目录扫描', () => {
    let tempBaseDir: string;

    beforeEach(() => {
      tempBaseDir =
        '/tmp/test-discover-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

      // 创建临时目录结构
      fs.mkdirSync(path.join(tempBaseDir, 'plugin-a'), { recursive: true });
      fs.mkdirSync(path.join(tempBaseDir, 'plugin-b'), { recursive: true });
      fs.mkdirSync(path.join(tempBaseDir, 'no-package'), { recursive: true });

      // 创建有效的 package.json 文件
      fs.writeFileSync(
        path.join(tempBaseDir, 'plugin-a', 'package.json'),
        JSON.stringify({
          name: 'plugin-a',
          version: '2.0.0',
          description: 'Test Plugin A',
          author: 'Test Author',
          organic: {
            api_version: '2.0.0',
            dependencies: {
              'core-plugin': '^1.0.0',
              'utils-plugin': '^2.0.0',
            },
          },
        })
      );

      fs.writeFileSync(
        path.join(tempBaseDir, 'plugin-b', 'package.json'),
        JSON.stringify({
          name: 'plugin-b',
          version: '1.5.0',
          description: 'Test Plugin B',
        })
      );

      // plugin-c 有无效的 JSON
      fs.mkdirSync(path.join(tempBaseDir, 'plugin-c'), { recursive: true });
      fs.writeFileSync(path.join(tempBaseDir, 'plugin-c', 'package.json'), 'invalid json content');
    });

    afterEach(() => {
      // 清理临时目录
      try {
        fs.rmSync(tempBaseDir!, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    });

    it('should discover plugins from directory with package.json', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });

      const results = await loader.discover();

      // 应该发现至少 3 个插件目录（plugin-a, plugin-b, plugin-c）
      expect(results.length).toBeGreaterThanOrEqual(3);

      // 找到成功的发现结果
      const successResults = results.filter(r => r.success);
      expect(successResults.length).toBeGreaterThanOrEqual(2);
    });

    it('should parse organic.api_version from package.json', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });

      const results = await loader.discover();
      const pluginA = results.find(r => r.pluginId === 'plugin-a');

      expect(pluginA).toBeDefined();
      expect(pluginA!.success).toBe(true);
      expect(pluginA!.metadata!.apiVersion).toBe('2.0.0');
      expect(pluginA!.metadata!.author).toBe('Test Author');
    });

    it('should parse dependencies from organic.dependencies', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });

      const results = await loader.discover();
      const pluginA = results.find(r => r.pluginId === 'plugin-a');

      expect(pluginA!.metadata!.dependencies).toHaveLength(2);
      expect(pluginA!.metadata!.dependencies![0]).toEqual({
        pluginName: 'core-plugin',
        versionRange: '^1.0.0',
      });
      expect(pluginA!.metadata!.dependencies![1]).toEqual({
        pluginName: 'utils-plugin',
        versionRange: '^2.0.0',
      });
    });

    it('should handle invalid package.json gracefully', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });

      const results = await loader.discover();
      const pluginC = results.find(r => r.pluginId === 'plugin-c');

      expect(pluginC).toBeDefined();
      expect(pluginC!.success).toBe(false);
      expect(pluginC!.error).toBeDefined();
    });

    it('should skip directories without package.json', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });

      const results = await loader.discover();
      const noPackageResult = results.find(r => r.pluginId === 'no-package');

      // no-package 目录没有 package.json，不应出现在结果中
      expect(noPackageResult).toBeUndefined();
    });

    it('should set discoveredAt timestamp on each result', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });
      const beforeDiscover = Date.now();

      const results = await loader.discover();
      const afterDiscover = Date.now();

      for (const result of results) {
        expect(result.discoveredAt).toBeGreaterThanOrEqual(beforeDiscover);
        expect(result.discoveredAt).toBeLessThanOrEqual(afterDiscover);
      }
    });

    it('should include source path in discovery results', async () => {
      const loader = new PluginLoader({ baseDir: tempBaseDir! });

      const results = await loader.discover();
      const pluginA = results.find(r => r.pluginId === 'plugin-a');

      expect(pluginA!.source).toBe(path.join(tempBaseDir!, 'plugin-a'));
    });
  });

  describe('getStatus - 各生命周期状态', () => {
    it('should return LOADING status during load', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-status' });

      // 通过访问内部状态来模拟
      const statusMap = (testLoader as any).status as Map<string, any>;
      statusMap.set('loading-plugin', {
        pluginId: 'loading-plugin',
        state: PluginLifecycleState.LOADING,
        enabled: true,
        lastStateChange: Date.now(),
      });

      const status = testLoader.getStatus('loading-plugin');
      expect(status?.state).toBe(PluginLifecycleState.LOADING);
      expect(status?.enabled).toBe(true);
    });

    it('should return ACTIVE status after successful load', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-status-active' });

      const statusMap = (testLoader as any).status as Map<string, any>;
      statusMap.set('active-plugin', {
        pluginId: 'active-plugin',
        state: PluginLifecycleState.ACTIVE,
        enabled: true,
        lastStateChange: Date.now(),
        stats: {
          totalExecutions: 10,
          successfulExecutions: 9,
          failedExecutions: 1,
          avgExecutionTime: 50,
        },
      });

      const status = testLoader.getStatus('active-plugin');
      expect(status?.state).toBe(PluginLifecycleState.ACTIVE);
      expect(status?.stats?.totalExecutions).toBe(10);
    });

    it('should return ERROR status with error message', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-status-error' });

      const statusMap = (testLoader as any).status as Map<string, any>;
      statusMap.set('error-plugin', {
        pluginId: 'error-plugin',
        state: PluginLifecycleState.ERROR,
        enabled: true,
        error: 'Initialization failed: timeout',
        lastStateChange: Date.now(),
      });

      const status = testLoader.getStatus('error-plugin');
      expect(status?.state).toBe(PluginLifecycleState.ERROR);
      expect(status?.error).toBe('Initialization failed: timeout');
    });

    it('should preserve existing stats when updating status', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-status-preserve' });

      const statusMap = (testLoader as any).status as Map<string, any>;
      // 初始状态带统计信息
      statusMap.set('preserve-plugin', {
        pluginId: 'preserve-plugin',
        state: PluginLifecycleState.ACTIVE,
        enabled: true,
        lastStateChange: Date.now() - 1000,
        stats: {
          totalExecutions: 100,
          successfulExecutions: 95,
          failedExecutions: 5,
          avgExecutionTime: 30,
        },
      });

      // 模拟 updateStatus 调用（状态变更但保留 stats）
      (testLoader as any).updateStatus.call(
        testLoader,
        'preserve-plugin',
        PluginLifecycleState.RUNNING
      );

      const status = testLoader.getStatus('preserve-plugin');
      expect(status?.state).toBe(PluginLifecycleState.RUNNING);
      expect(status?.stats?.totalExecutions).toBe(100); // 统计信息应保留
    });

    it('should return DISCOVERED state', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-status-discovered' });

      const statusMap = (testLoader as any).status as Map<string, any>;
      statusMap.set('discovered-plugin', {
        pluginId: 'discovered-plugin',
        state: PluginLifecycleState.DISCOVERED,
        enabled: true,
        lastStateChange: Date.now(),
      });

      const status = testLoader.getStatus('discovered-plugin');
      expect(status?.state).toBe(PluginLifecycleState.DISCOVERED);
    });

    it('should return SHUTTING_DOWN state', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-status-shutting-down' });

      const statusMap = (testLoader as any).status as Map<string, any>;
      statusMap.set('shutting-down-plugin', {
        pluginId: 'shutting-down-plugin',
        state: PluginLifecycleState.SHUTTING_DOWN,
        enabled: true,
        lastStateChange: Date.now(),
      });

      const status = testLoader.getStatus('shutting-down-plugin');
      expect(status?.state).toBe(PluginLifecycleState.SHUTTING_DOWN);
    });
  });

  describe('cache TTL 过期机制', () => {
    it('should return cached result within TTL', async () => {
      const testLoader = new PluginLoader({
        baseDir: '/tmp/test-cache-ttl',
        cacheTtl: 60000, // 60 秒 TTL
      });
      const mockPlugin = createMockPlugin('cached-ttl-plugin');

      // 设置一个刚缓存的条目
      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('cached-ttl-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(), // 当前时间
        config: undefined,
      });

      // Mock resolvePluginPath 以避免真实文件操作
      vi.spyOn(testLoader as any, 'resolvePluginPath').mockReturnValue(undefined);

      const result = await testLoader.load('cached-ttl-plugin');

      expect(result.success).toBe(true);
      expect(result.plugin).toBe(mockPlugin);
    });

    it('should re-load plugin after cache expires', async () => {
      const testLoader = new PluginLoader({
        baseDir: '/tmp/test-cache-expired',
        cacheTtl: 100, // 100ms TTL
      });
      const oldPlugin = createMockPlugin('expired-plugin');

      // 设置一个已过期的缓存条目（1秒前）
      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('expired-plugin', {
        plugin: oldPlugin,
        metadata: oldPlugin.getMetadata(),
        loadedAt: Date.now() - 1000, // 1秒前，超过 100ms TTL
        config: undefined,
      });

      // Mock resolvePluginPath 返回 undefined 导致重新加载失败
      vi.spyOn(testLoader as any, 'resolvePluginPath').mockReturnValue(undefined);

      const result = await testLoader.load('expired-plugin');

      // 缓存过期后应尝试重新加载，由于路径不存在返回错误
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should skip cache when cacheEnabled is false', async () => {
      const testLoader = new PluginLoader({
        baseDir: '/tmp/test-cache-disabled',
        cacheTtl: 60000,
        cacheEnabled: false,
      });
      const mockPlugin = createMockPlugin('nocache-plugin');

      // 即使设置了缓存条目，禁用缓存后也不应使用
      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('nocache-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      vi.spyOn(testLoader as any, 'resolvePluginPath').mockReturnValue(undefined);

      const result = await testLoader.load('nocache-plugin');

      // 缓存被禁用，应该尝试重新加载
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('updateStatus - 错误状态设置', () => {
    it('should set ERROR status when load throws exception', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-error-status' });

      // Mock resolvePluginPath 让它抛出异常以触发 catch 块中的 updateStatus
      vi.spyOn(testLoader as any, 'resolvePluginPath').mockImplementation(() => {
        throw new Error('Simulated load failure');
      });

      const result = await testLoader.load('will-fail-exception');

      expect(result.success).toBe(false);

      // 验证状态被设置为 ERROR (通过 catch 块)
      const status = testLoader.getStatus('will-fail-exception');
      expect(status).toBeDefined();
      expect(status!.state).toBe(PluginLifecycleState.ERROR);
      expect(status!.error).toBe('Simulated load failure');
    });

    it('should set default enabled to true in error status', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-default-enabled' });

      vi.spyOn(testLoader as any, 'resolvePluginPath').mockImplementation(() => {
        throw new Error('Test error');
      });

      await testLoader.load('new-error-plugin');

      const status = testLoader.getStatus('new-error-plugin');
      expect(status!).toBeDefined();
      expect(status!.enabled).toBe(true);
    });

    it('should preserve existing enabled flag when updating to error', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-preserve-enabled' });

      // 先手动设置一个禁用的状态
      const statusMap = (testLoader as any).status as Map<string, any>;
      statusMap.set('existing-plugin', {
        pluginId: 'existing-plugin',
        state: PluginLifecycleState.ACTIVE,
        enabled: false, // 显式设置为禁用
        lastStateChange: Date.now(),
      });

      // 让 load 抛出异常以触发 catch 块中的 updateStatus
      vi.spyOn(testLoader as any, 'resolvePluginPath').mockImplementation(() => {
        throw new Error('Preserve enabled test');
      });

      await testLoader.load('existing-plugin');

      const status = testLoader.getStatus('existing-plugin');
      expect(status!.state).toBe(PluginLifecycleState.ERROR);
      expect(status!.enabled).toBe(false); // 应保留之前的 enabled 值
    });

    it('should include lastStateChange timestamp', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-timestamp' });
      const beforeLoad = Date.now();

      vi.spyOn(testLoader as any, 'resolvePluginPath').mockImplementation(() => {
        throw new Error('Timestamp test');
      });

      await testLoader.load('timestamp-plugin');

      const afterLoad = Date.now();
      const status = testLoader.getStatus('timestamp-plugin');

      expect(status!.lastStateChange).toBeGreaterThanOrEqual(beforeLoad);
      expect(status!.lastStateChange).toBeLessThanOrEqual(afterLoad);
    });
  });

  describe('createKernelApi - 内核 API 创建', () => {
    it('should provide kernel API methods through createKernelApi', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-kernel-api' });

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('other-plugin', {
        plugin: createMockPlugin('other-plugin'),
        metadata: createMockPlugin('other-plugin').getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      // 通过反射获取 createKernelApi 方法
      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'kernel-api-test');

      expect(typeof kernelApi.getConfig).toBe('function');
      expect(typeof kernelApi.getVersion).toBe('function');
      expect(typeof kernelApi.registerPlugin).toBe('function');
      expect(typeof kernelApi.unregisterPlugin).toBe('function');
      expect(typeof kernelApi.getPlugin).toBe('function');
      expect(typeof kernelApi.listPlugins).toBe('function');
      expect(typeof kernelApi.executeTool).toBe('function');

      // 测试 getVersion 返回版本号
      expect(kernelApi.getVersion()).toBe('0.1.0');

      // 测试 getConfig 返回空对象
      expect(kernelApi.getConfig()).toEqual({});
    });

    it('should get cached plugin via getPlugin', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-getplugin' });
      const cachedPlugin = createMockPlugin('getable-plugin');

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('getable-plugin', {
        plugin: cachedPlugin,
        metadata: cachedPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const retrieved = kernelApi.getPlugin('getable-plugin');

      expect(retrieved).toBe(cachedPlugin);
    });

    it('should list all cached plugins via listPlugins', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-listplugins' });
      const plugin1 = createMockPlugin('list-1');
      const plugin2 = createMockPlugin('list-2');

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('list-1', {
        plugin: plugin1,
        metadata: plugin1.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });
      cache.set('list-2', {
        plugin: plugin2,
        metadata: plugin2.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const plugins = kernelApi.listPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });

    it('should execute tool successfully when plugin handles the tool', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-tool-success' });
      const mockPlugin = createMockPlugin('tool-provider');
      // 覆盖 execute 方法，模拟工具执行成功
      (mockPlugin.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { result: 'tool executed successfully' },
      });

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('tool-provider', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const result = await kernelApi.executeTool('test-tool', { arg1: 'value1' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'tool executed successfully' });
      expect(result.metadata.tool_name).toBe('test-tool');
      expect(result.metadata.request_id).toBeDefined();
      expect(result.metadata.start_time).toBeLessThanOrEqual(result.metadata.end_time);
      expect(result.metadata.execution_time).toBeGreaterThanOrEqual(0);
    });

    it('should return TOOL_NOT_FOUND when no plugin handles the tool', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-tool-not-found' });
      const mockPlugin = createMockPlugin('no-tool-plugin');
      // 插件不处理该工具，返回失败
      (mockPlugin.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Tool not supported',
      });

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('no-tool-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const result = await kernelApi.executeTool('non-existent-tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('tool_not_found');
      expect(result.error.message).toContain('non-existent-tool');
      expect(result.metadata.tool_name).toBe('non-existent-tool');
    });

    it('should return TOOL_NOT_FOUND when cache is empty', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-empty-cache' });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const result = await kernelApi.executeTool('any-tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('tool_not_found');
    });

    it('should return EXECUTION_ERROR when plugin throws exception', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-tool-error' });
      const mockPlugin = createMockPlugin('error-plugin');
      // 插件 execute 方法抛出异常
      (mockPlugin.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Plugin execution failed')
      );

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('error-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const result = await kernelApi.executeTool('error-tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('execution_error');
      expect(result.error.message).toBe('Plugin execution failed');
      expect(result.metadata.tool_name).toBe('error-tool');
    });

    it('should pass correct name and params to plugin execute', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-params' });
      const mockPlugin = createMockPlugin('params-plugin');
      const executeSpy = mockPlugin.execute as ReturnType<typeof vi.fn>;
      executeSpy.mockResolvedValue({
        success: true,
        data: { ok: true },
      });

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('params-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      await kernelApi.executeTool('my-tool', { key: 'value', num: 42 });

      expect(executeSpy).toHaveBeenCalledTimes(1);
      const callArg = executeSpy.mock.calls[0][0];
      expect(callArg.action).toBe('executeTool');
      expect(callArg.params.name).toBe('my-tool');
      expect(callArg.params.params).toEqual({ key: 'value', num: 42 });
      expect(callArg.params.requestId).toBeDefined();
    });

    it('should try multiple plugins until one handles the tool', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-multi' });
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');

      // 第一个插件不处理工具
      (plugin1.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Not supported',
      });
      // 第二个插件处理工具
      (plugin2.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { handled: true },
      });

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('plugin-1', {
        plugin: plugin1,
        metadata: plugin1.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });
      cache.set('plugin-2', {
        plugin: plugin2,
        metadata: plugin2.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const result = await kernelApi.executeTool('target-tool', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ handled: true });
      expect(plugin1.execute).toHaveBeenCalledTimes(1);
      expect(plugin2.execute).toHaveBeenCalledTimes(1);
    });

    it('should not return success when plugin returns success but no data', async () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-execute-no-data' });
      const mockPlugin = createMockPlugin('no-data-plugin');
      // 插件返回 success 但没有 data
      (mockPlugin.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });

      const cache = (testLoader as any).cache as Map<string, any>;
      cache.set('no-data-plugin', {
        plugin: mockPlugin,
        metadata: mockPlugin.getMetadata(),
        loadedAt: Date.now(),
        config: undefined,
      });

      const kernelApi = (testLoader as any).createKernelApi.call(testLoader, 'caller');
      const result = await kernelApi.executeTool('no-data-tool', {});

      // success 但无 data 时应继续查找其他插件，最终返回 TOOL_NOT_FOUND
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('tool_not_found');
    });
  });

  describe('extractMetadata - 元数据提取', () => {
    it('should extract metadata from plugin.getMetadata()', () => {
      const testLoader = new PluginLoader({ baseDir: '/tmp/test-extract' });
      const mockPlugin = createMockPlugin('meta-test');

      // 通过反射调用 extractMetadata
      const metadata = (testLoader as any).extractMetadata.call(
        testLoader,
        mockPlugin,
        '/fake/path/index.js'
      );

      expect(metadata.id).toBe('meta-test');
      expect(metadata.name).toBe('Mock Plugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.apiVersion).toBe('1.0.0');
    });

    // 注意: extractMetadata 的 fallback 路径（无 getMetadata、无 package.json）需要 spy fs.existsSync，
    // 由于 vitest 对 Node.js 内置模块 fs 的限制，该路径通过 parsePackageMetadata 的测试间接覆盖
  });

  describe('resolvePluginPath - 路径解析', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = '/tmp/test-resolve-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      // 创建模拟插件目录结构
      fs.mkdirSync(path.join(tempDir, 'test-plugin', 'dist'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'test-plugin', 'dist', 'index.js'), '// test');
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir!, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it('should find plugin at baseDir/plugin/dist/index.js', () => {
      const loader = new PluginLoader({ baseDir: tempDir! });

      const resolvedPath = (loader as any).resolvePluginPath.call(loader, 'test-plugin');

      expect(resolvedPath).toBe(path.join(tempDir!, 'test-plugin', 'dist', 'index.js'));
    });

    it('should return undefined for non-existent plugin', () => {
      const loader = new PluginLoader({ baseDir: tempDir! });

      const resolvedPath = (loader as any).resolvePluginPath.call(loader, 'non-existent');

      expect(resolvedPath).toBeUndefined();
    });
  });

  describe('extractMetadata - 从 package.json 提取', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir =
        '/tmp/test-extract-pkg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      // 创建包含 package.json 的目录结构
      fs.mkdirSync(path.join(tempDir, 'my-plugin', 'dist'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'my-plugin', 'dist', 'index.js'), '// test');
      fs.writeFileSync(
        path.join(tempDir, 'my-plugin', 'package.json'),
        JSON.stringify({
          name: 'my-plugin',
          version: '5.0.0',
          description: 'From package.json',
          author: 'PKG Author',
          organic: {
            api_version: '4.0.0',
            dependencies: {
              dep1: '^1.0.0',
            },
          },
        })
      );
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir!, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it('should extract metadata from package.json when plugin has no getMetadata', () => {
      const loader = new PluginLoader({ baseDir: tempDir! });
      const basicPlugin: Partial<PluginInterface> = {
        name: 'Basic',
        version: '1.0.0',
      };

      const metadata = (loader as any).extractMetadata.call(
        loader,
        basicPlugin,
        path.join(tempDir!, 'my-plugin', 'dist', 'index.js')
      );

      expect(metadata.id).toBe('my-plugin');
      expect(metadata.name).toBe('my-plugin');
      expect(metadata.version).toBe('5.0.0');
      expect(metadata.description).toBe('From package.json');
      expect(metadata.author).toBe('PKG Author');
      expect(metadata.apiVersion).toBe('4.0.0');
      expect(metadata.dependencies).toHaveLength(1);
      expect(metadata.dependencies![0].pluginName).toBe('dep1');
    });
  });

  describe('parsePackageMetadata - package.json 解析', () => {
    it('should parse complete package.json with organic fields', () => {
      const testLoader = new PluginLoader();
      const pkgJson = {
        name: '@organic/my-plugin',
        version: '1.2.3',
        description: 'My awesome plugin',
        author: 'Developer <dev@example.com>',
        organic: {
          api_version: '3.0.0',
          dependencies: {
            core: '^2.0.0',
            utils: '^1.5.0',
            db: '~1.0.0',
          },
        },
      };

      const metadata = (testLoader as any).parsePackageMetadata.call(testLoader, pkgJson);

      expect(metadata.id).toBe('@organic/my-plugin');
      expect(metadata.name).toBe('@organic/my-plugin');
      expect(metadata.version).toBe('1.2.3');
      expect(metadata.description).toBe('My awesome plugin');
      expect(metadata.author).toBe('Developer <dev@example.com>');
      expect(metadata.apiVersion).toBe('3.0.0');
      expect(metadata.dependencies).toHaveLength(3);
      expect(metadata.dependencies).toContainEqual({
        pluginName: 'core',
        versionRange: '^2.0.0',
      });
    });

    it('should use default values for missing fields', () => {
      const testLoader = new PluginLoader();
      const pkgJson = {
        name: 'minimal-plugin',
      };

      const metadata = (testLoader as any).parsePackageMetadata.call(testLoader, pkgJson);

      expect(metadata.id).toBe('minimal-plugin');
      expect(metadata.version).toBe('0.0.0'); // 默认值
      expect(metadata.apiVersion).toBe('1.0.0'); // 默认值（无 organic.api_version）
      expect(metadata.dependencies).toEqual([]); // 无依赖时为空数组
    });

    it('should handle empty organic dependencies', () => {
      const testLoader = new PluginLoader();
      const pkgJson = {
        name: 'empty-deps-plugin',
        version: '1.0.0',
        organic: {
          api_version: '2.0.0',
          dependencies: {},
        },
      };

      const metadata = (testLoader as any).parsePackageMetadata.call(testLoader, pkgJson);

      expect(metadata.apiVersion).toBe('2.0.0');
      expect(metadata.dependencies).toEqual([]);
    });
  });
});
