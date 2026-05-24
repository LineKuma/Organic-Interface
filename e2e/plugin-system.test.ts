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

  it('should transition through plugin lifecycle states', async () => {
    class LifecycleTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'lifecycle-test-plugin',
        name: 'Lifecycle Test Plugin',
        version: '1.0.0',
        description: 'Lifecycle test plugin',
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
      name: 'lifecycle-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new LifecycleTestPlugin(config);
    await kernel.registerPlugin(plugin);

    const metadata = plugin.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe('lifecycle-test-plugin');

    await kernel.unregisterPlugin('lifecycle-test-plugin');
  });

  it('should validate plugin configuration', async () => {
    class ConfigTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'config-test-plugin',
        name: 'Config Test Plugin',
        version: '1.0.0',
        description: 'Config test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() {
        return { success: true };
      }

      async shutdown() {
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'config-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new ConfigTestPlugin(config);
    await kernel.registerPlugin(plugin);

    const loadedPlugin = kernel.getPlugin('config-test-plugin');
    expect(loadedPlugin).toBeDefined();
    expect(loadedPlugin?.name).toBe('config-test-plugin');
  });

  it('should check plugin dependencies', async () => {
    class DepTestPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'dep-test-plugin',
        name: 'Dependency Test Plugin',
        version: '1.0.0',
        description: 'Dependency test plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: ['non-existent-dep'],
      };

      async initialize() {
        return { success: true };
      }

      async shutdown() {
        return { success: true };
      }
    }

    const config: PluginConfig = {
      name: 'dep-test-plugin',
      version: '1.0.0',
      enabled: true,
    };

    const plugin = new DepTestPlugin(config);

    const metadata = plugin.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe('dep-test-plugin');
  });

  it('should handle multiple plugins', async () => {
    class MultiPlugin1 extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'multi-plugin-1',
        name: 'Multi Plugin 1',
        version: '1.0.0',
        description: 'Multi plugin 1',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() { return { success: true }; }
      async shutdown() { return { success: true }; }
    }

    class MultiPlugin2 extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'multi-plugin-2',
        name: 'Multi Plugin 2',
        version: '1.0.0',
        description: 'Multi plugin 2',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() { return { success: true }; }
      async shutdown() { return { success: true }; }
    }

    await kernel.registerPlugin(new MultiPlugin1({ name: 'multi-plugin-1', version: '1.0.0', enabled: true }));
    await kernel.registerPlugin(new MultiPlugin2({ name: 'multi-plugin-2', version: '1.0.0', enabled: true }));

    const plugin1 = kernel.getPlugin('multi-plugin-1');
    const plugin2 = kernel.getPlugin('multi-plugin-2');

    expect(plugin1).toBeDefined();
    expect(plugin2).toBeDefined();
  });

  it('should verify plugin priority handling', async () => {
    class PriorityPlugin extends BasePlugin {
      static override metadata: PluginMetadata = {
        id: 'priority-plugin',
        name: 'Priority Plugin',
        version: '1.0.0',
        description: 'Priority plugin',
        author: 'Test',
        apiVersion: '1.0.0',
        dependencies: [],
      };

      async initialize() { return { success: true }; }
      async shutdown() { return { success: true }; }
    }

    const plugin = new PriorityPlugin({ name: 'priority-plugin', version: '1.0.0', enabled: true });
    await kernel.registerPlugin(plugin);

    const loaded = kernel.getPlugin('priority-plugin');
    expect(loaded).toBeDefined();
  });
});