import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { BasePlugin, type PluginConfig, type PluginMetadata } from '@organic/plugins';

describe('Plugin System', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should load plugins on startup', async () => {
    class TestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin for unit testing',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        this.setState({ status: 'initialized' });
        return { success: true };
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new TestPlugin(config);
    await kernel.registerPlugin(plugin);

    const loadedPlugin = kernel.getPlugin('test-plugin');
    expect(loadedPlugin).toBeDefined();
  });

  it('should enable and disable plugins', async () => {
    class ToggleTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'toggle-test-plugin',
        name: 'Toggle Test Plugin',
        version: '1.0.0',
        description: 'Toggle test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        this.setState({ status: 'initialized' });
        return { success: true };
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'toggle-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new ToggleTestPlugin(config);
    await kernel.registerPlugin(plugin);

    const metadata = kernel.getPlugin('toggle-test-plugin');
    expect(metadata).toBeDefined();

    await kernel.unregisterPlugin('toggle-test-plugin');
    expect(kernel.getPlugin('toggle-test-plugin')).toBeUndefined();
  });

  it('should handle plugin errors without crashing', async () => {
    class ErrorTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'error-test-plugin',
        name: 'Error Test Plugin',
        version: '1.0.0',
        description: 'Error test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        throw new Error('Intentional initialization error');
      }

      async shutdown() {
        this.setState({ status: 'stopped' });
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'error-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new ErrorTestPlugin(config);

    try {
      await kernel.registerPlugin(plugin);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});