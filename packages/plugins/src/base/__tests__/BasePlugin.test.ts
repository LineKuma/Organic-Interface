/**
 * BasePlugin Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BasePlugin } from '@organic/plugins/base/BasePlugin';
import type { PluginContext, PluginInput } from '@organic/plugins/interfaces/PluginInterface';

// Test plugin implementation
class TestPlugin extends BasePlugin {
  public onInitializeCalled = false;
  public onExecuteCalled = false;
  public onShutdownCalled = false;
  public lastInput: PluginInput | null = null;

  protected async onInitialize(_context: PluginContext): Promise<void> {
    this.onInitializeCalled = true;
  }

  protected async onExecute(input: PluginInput): Promise<unknown> {
    this.onExecuteCalled = true;
    this.lastInput = input;
    return { result: 'test-result', action: input.action };
  }

  protected async onShutdown(): Promise<void> {
    this.onShutdownCalled = true;
  }
}

describe('BasePlugin', () => {
  let plugin: TestPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = new TestPlugin({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      apiVersion: '1.0.0',
      minKernelVersion: '1.0.0',
      defaultConfig: { key1: 'value1' },
    });

    mockContext = {
      kernel: {
        getConfig: vi.fn(() => ({})),
        getVersion: vi.fn(() => '1.0.0'),
      },
      config: {},
    };
  });

  describe('Constructor', () => {
    it('should create a BasePlugin instance', () => {
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('Test plugin');
    });

    it('should set default configuration', () => {
      const config = (plugin as any).config;
      expect(config.key1).toBe('value1');
    });
  });

  describe('getMetadata() - Get plugin metadata', () => {
    it('should return plugin metadata', () => {
      const metadata = plugin.getMetadata();

      expect(metadata.id).toBe('test-plugin');
      expect(metadata.name).toBe('test-plugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('Test plugin');
      expect(metadata.apiVersion).toBe('1.0.0');
      expect(metadata.minKernelVersion).toBe('1.0.0');
    });

    it('should return a copy of metadata', () => {
      const metadata1 = plugin.getMetadata();
      const metadata2 = plugin.getMetadata();

      expect(metadata1).not.toBe(metadata2);
    });
  });

  describe('initialize() - Initialize plugin', () => {
    it('should initialize plugin successfully', async () => {
      const result = await plugin.initialize(mockContext);

      expect(result.success).toBe(true);
      expect(plugin.onInitializeCalled).toBe(true);
      expect((plugin as any).initialized).toBe(true);
    });

    it('should merge default config with context config', async () => {
      const contextWithConfig: PluginContext = {
        ...mockContext,
        config: { key2: 'value2' } as any,
      };

      await plugin.initialize(contextWithConfig);

      const config = (plugin as any).config;
      expect(config.key1).toBe('value1');
      expect(config.key2).toBe('value2');
    });

    it('should store kernel API reference', async () => {
      await plugin.initialize(mockContext);

      expect((plugin as any).kernel).toBe(mockContext.kernel);
    });

    it('should return error on initialization failure', async () => {
      class FailingPlugin extends TestPlugin {
        protected async onInitialize(): Promise<void> {
          throw new Error('Initialization failed');
        }
      }

      const failingPlugin = new FailingPlugin({
        name: 'failing-plugin',
        version: '1.0.0',
      });

      const result = await failingPlugin.initialize(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Initialization failed');
    });

    it('should call onLoad hook if defined', async () => {
      const onLoadHook = vi.fn();

      const pluginWithHook = new TestPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        hooks: { onLoad: onLoadHook },
      });

      await pluginWithHook.initialize(mockContext);

      expect(onLoadHook).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute() - Execute plugin action', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it('should execute plugin action successfully', async () => {
      const input: PluginInput = { action: 'test-action', params: { param: 'value' } };
      const result = await plugin.execute(input);

      expect(result.success).toBe(true);
      expect(plugin.onExecuteCalled).toBe(true);
      expect(plugin.lastInput).toBe(input);
    });

    it('should return error if plugin is not initialized', async () => {
      const uninitializedPlugin = new TestPlugin({
        name: 'test-plugin',
        version: '1.0.0',
      });

      const result = await uninitializedPlugin.execute({ action: 'test', params: {} });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin not initialized');
    });

    it('should return error on execution failure', async () => {
      class FailingPlugin extends TestPlugin {
        protected async onExecute(): Promise<unknown> {
          throw new Error('Execution failed');
        }
      }

      const failingPlugin = new FailingPlugin({
        name: 'failing-plugin',
        version: '1.0.0',
      });

      await failingPlugin.initialize(mockContext);
      const result = await failingPlugin.execute({ action: 'test', params: {} });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should call onError hook on execution failure', async () => {
      const onErrorHook = vi.fn();

      class FailingPlugin extends TestPlugin {
        protected async onExecute(): Promise<unknown> {
          throw new Error('Execution failed');
        }
      }

      const failingPlugin = new FailingPlugin({
        name: 'failing-plugin',
        version: '1.0.0',
        hooks: { onError: onErrorHook },
      });

      await failingPlugin.initialize(mockContext);
      await failingPlugin.execute({ action: 'test', params: {} });

      expect(onErrorHook).toHaveBeenCalledTimes(1);
      expect(onErrorHook).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('shutdown() - Shutdown plugin', () => {
    it('should shutdown plugin successfully', async () => {
      await plugin.initialize(mockContext);
      await plugin.shutdown();

      expect(plugin.onShutdownCalled).toBe(true);
      expect((plugin as any).initialized).toBe(false);
    });

    it('should call onUnload hook if defined', async () => {
      const onUnloadHook = vi.fn();

      const pluginWithHook = new TestPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        hooks: { onUnload: onUnloadHook },
      });

      await pluginWithHook.initialize(mockContext);
      await pluginWithHook.shutdown();

      expect(onUnloadHook).toHaveBeenCalledTimes(1);
    });

    it('should not throw on shutdown error', async () => {
      class FailingPlugin extends TestPlugin {
        protected async onShutdown(): Promise<void> {
          throw new Error('Shutdown failed');
        }
      }

      const failingPlugin = new FailingPlugin({
        name: 'failing-plugin',
        version: '1.0.0',
      });

      await failingPlugin.initialize(mockContext);

      // Should not throw
      await expect(failingPlugin.shutdown()).resolves.not.toThrow();
    });
  });

  describe('validateConfig() - Validate configuration', () => {
    it('should handle validation when no schema defined', async () => {
      // TestPlugin doesn't have getConfigSchema, so validation should return valid
      // or handle the missing schema gracefully
      const result = await plugin.validateConfig({});
      // When no schema is defined, it should still work
      expect(result).toBeDefined();
    });

    it('should validate configuration schema', async () => {
      class SchemaPlugin extends TestPlugin {
        protected getConfigSchema() {
          return {
            requiredField: {
              type: 'string',
              required: true,
            },
            numberField: {
              type: 'number',
              required: false,
            },
          };
        }
      }

      const schemaPlugin = new SchemaPlugin({
        name: 'schema-plugin',
        version: '1.0.0',
      });

      // Missing required field
      const result1 = await schemaPlugin.validateConfig({});
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContainEqual(
        expect.objectContaining({
          field: 'requiredField',
          message: expect.stringContaining('required'),
        })
      );

      // Wrong type
      const result2 = await schemaPlugin.validateConfig({
        requiredField: 'valid',
        numberField: 'not a number',
      });
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContainEqual(
        expect.objectContaining({
          field: 'numberField',
          expected: 'number',
          actual: 'string',
        })
      );

      // Valid config
      const result3 = await schemaPlugin.validateConfig({
        requiredField: 'valid',
        numberField: 42,
      });
      expect(result3.valid).toBe(true);
    });
  });

  describe('updateConfig() - Update configuration', () => {
    it('should update configuration', async () => {
      await plugin.initialize(mockContext);

      (plugin as any).updateConfig({ key3: 'value3' });

      const config = (plugin as any).config;
      expect(config.key3).toBe('value3');
      expect(config.key1).toBe('value1'); // Existing config preserved
    });

    it('should call onConfigChange hook', async () => {
      const onConfigChangeHook = vi.fn();

      const pluginWithHook = new TestPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        hooks: { onConfigChange: onConfigChangeHook },
      });

      await pluginWithHook.initialize(mockContext);
      (pluginWithHook as any).updateConfig({ newKey: 'newValue' });

      expect(onConfigChangeHook).toHaveBeenCalledTimes(1);
      expect(onConfigChangeHook).toHaveBeenCalledWith(
        expect.objectContaining({ newKey: 'newValue' })
      );
    });
  });

  describe('getConfig() - Get configuration', () => {
    it('should return current configuration', async () => {
      await plugin.initialize(mockContext);

      const config = (plugin as any).getConfig();

      expect(config.key1).toBe('value1');
    });

    it('should return a copy, not the original', async () => {
      await plugin.initialize(mockContext);

      const config1 = (plugin as any).getConfig();
      const config2 = (plugin as any).getConfig();

      expect(config1).not.toBe(config2);
    });
  });

  describe('isInitialized() - Check initialization status', () => {
    it('should return false before initialization', () => {
      expect((plugin as any).isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await plugin.initialize(mockContext);

      expect((plugin as any).isInitialized()).toBe(true);
    });

    it('should return false after shutdown', async () => {
      await plugin.initialize(mockContext);
      await plugin.shutdown();

      expect((plugin as any).isInitialized()).toBe(false);
    });
  });
});
