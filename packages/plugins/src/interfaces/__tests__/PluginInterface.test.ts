/**
 * PluginInterface Type Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PluginLifecycleState,
  type PluginMetadata,
  type PluginDependency,
  type PluginHooks,
  type PluginConfig,
  type PluginInterface,
  type ValidateResult,
  type ValidationError,
  type PluginStatus,
  type PluginStats,
} from '@organic/plugins/interfaces/PluginInterface';

describe('PluginInterface Types', () => {
  describe('PluginMetadata', () => {
    it('should define all required properties', () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
      };

      expect(metadata.id).toBe('test-plugin');
      expect(metadata.name).toBe('test-plugin');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.apiVersion).toBe('1.0.0');
    });

    it('should support optional properties', () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
        description: 'A test plugin',
        minKernelVersion: '1.0.0',
        dependencies: [{ pluginName: 'dep-plugin', versionRange: '>=1.0.0', optional: true }],
        defaultConfig: { key: 'value' },
        hooks: {
          onLoad: vi.fn(),
          onUnload: vi.fn(),
        },
        author: 'Test Author',
      };

      expect(metadata.description).toBeDefined();
      expect(metadata.minKernelVersion).toBe('1.0.0');
      expect(metadata.dependencies).toHaveLength(1);
      expect(metadata.defaultConfig).toEqual({ key: 'value' });
      expect(metadata.hooks).toBeDefined();
      expect(metadata.author).toBe('Test Author');
    });

    it('should have readonly id, name, version properties', () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
      };

      // These should be readonly at the type level
      // We can't test runtime readonly directly, but TypeScript ensures it
      expect(metadata.id).toBe('test-plugin');
      expect(metadata.name).toBe('test-plugin');
      expect(metadata.version).toBe('1.0.0');
    });
  });

  describe('PluginDependency', () => {
    it('should define dependency structure', () => {
      const dependency: PluginDependency = {
        pluginName: 'required-plugin',
        versionRange: '>=1.0.0',
      };

      expect(dependency.pluginName).toBe('required-plugin');
      expect(dependency.versionRange).toBe('>=1.0.0');
    });

    it('should support optional flag', () => {
      const optionalDependency: PluginDependency = {
        pluginName: 'optional-plugin',
        versionRange: '>=1.0.0',
        optional: true,
      };

      expect(optionalDependency.optional).toBe(true);
    });
  });

  describe('PluginHooks', () => {
    it('should define all hook types', () => {
      const hooks: PluginHooks = {
        onLoad: vi.fn(),
        onUnload: vi.fn(),
        onError: vi.fn(),
        onConfigChange: vi.fn(),
      };

      expect(typeof hooks.onLoad).toBe('function');
      expect(typeof hooks.onUnload).toBe('function');
      expect(typeof hooks.onError).toBe('function');
      expect(typeof hooks.onConfigChange).toBe('function');
    });

    it('should support partial hooks', () => {
      const hooks: PluginHooks = {
        onLoad: vi.fn(),
      };

      expect(hooks.onLoad).toBeDefined();
      expect(hooks.onUnload).toBeUndefined();
      expect(hooks.onError).toBeUndefined();
      expect(hooks.onConfigChange).toBeUndefined();
    });
  });

  describe('PluginLifecycleState', () => {
    it('should have all expected states', () => {
      expect(PluginLifecycleState.DISCOVERED).toBe('discovered');
      expect(PluginLifecycleState.RESOLVED).toBe('resolved');
      expect(PluginLifecycleState.LOADING).toBe('loading');
      expect(PluginLifecycleState.INITIALIZED).toBe('initialized');
      expect(PluginLifecycleState.ACTIVE).toBe('active');
      expect(PluginLifecycleState.RUNNING).toBe('running');
      expect(PluginLifecycleState.SHUTTING_DOWN).toBe('shutting_down');
      expect(PluginLifecycleState.SHUTDOWN).toBe('shutdown');
      expect(PluginLifecycleState.ERROR).toBe('error');
      expect(PluginLifecycleState.UNLOADED).toBe('unloaded');
    });
  });

  describe('PluginConfig', () => {
    it('should define plugin configuration structure', () => {
      const config: PluginConfig = {
        pluginId: 'test-plugin',
      };

      expect(config.pluginId).toBe('test-plugin');
    });

    it('should support optional configuration properties', () => {
      const config: PluginConfig = {
        pluginId: 'test-plugin',
        config: { key: 'value' },
        enabled: true,
        priority: 100,
      };

      expect(config.config).toEqual({ key: 'value' });
      expect(config.enabled).toBe(true);
      expect(config.priority).toBe(100);
    });
  });

  describe('PluginInterface', () => {
    it('should define the base plugin interface structure', () => {
      const mockPlugin: PluginInterface = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        getMetadata: () => ({
          id: 'test-plugin',
          name: 'test-plugin',
          version: '1.0.0',
          apiVersion: '1.0.0',
        }),
        initialize: vi.fn(async () => ({ success: true })),
        execute: vi.fn(async () => ({ success: true })),
        shutdown: vi.fn(async () => {}),
        validateConfig: vi.fn(async () => ({ valid: true })),
      };

      expect(mockPlugin.name).toBe('test-plugin');
      expect(mockPlugin.version).toBe('1.0.0');
      expect(typeof mockPlugin.getMetadata).toBe('function');
      expect(typeof mockPlugin.initialize).toBe('function');
      expect(typeof mockPlugin.execute).toBe('function');
      expect(typeof mockPlugin.shutdown).toBe('function');
      expect(typeof mockPlugin.validateConfig).toBe('function');
    });
  });

  describe('ValidateResult', () => {
    it('should define validation result structure', () => {
      const validResult: ValidateResult = { valid: true };

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toBeUndefined();
    });

    it('should include errors when validation fails', () => {
      const invalidResult: ValidateResult = {
        valid: false,
        errors: [
          {
            field: 'requiredField',
            message: 'Field is required',
            expected: 'string',
            actual: undefined,
          },
        ],
      };

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors![0].field).toBe('requiredField');
    });
  });

  describe('ValidationError', () => {
    it('should define validation error structure', () => {
      const error: ValidationError = {
        field: 'email',
        message: 'Invalid email format',
        expected: 'email@example.com',
        actual: 'invalid-email',
      };

      expect(error.field).toBe('email');
      expect(error.message).toBe('Invalid email format');
      expect(error.expected).toBe('email@example.com');
      expect(error.actual).toBe('invalid-email');
    });
  });

  describe('PluginStatus', () => {
    it('should define plugin status structure', () => {
      const status: PluginStatus = {
        pluginId: 'test-plugin',
        state: PluginLifecycleState.RUNNING,
        enabled: true,
      };

      expect(status.pluginId).toBe('test-plugin');
      expect(status.state).toBe(PluginLifecycleState.RUNNING);
      expect(status.enabled).toBe(true);
    });

    it('should support optional error and stats', () => {
      const status: PluginStatus = {
        pluginId: 'test-plugin',
        state: PluginLifecycleState.ERROR,
        enabled: false,
        error: 'Initialization failed',
        lastStateChange: Date.now(),
        stats: {
          totalExecutions: 100,
          successfulExecutions: 95,
          failedExecutions: 5,
          avgExecutionTime: 50,
          lastExecution: Date.now(),
        },
      };

      expect(status.error).toBe('Initialization failed');
      expect(status.lastStateChange).toBeDefined();
      expect(status.stats).toBeDefined();
      expect(status.stats!.totalExecutions).toBe(100);
    });
  });

  describe('PluginStats', () => {
    it('should define plugin statistics structure', () => {
      const stats: PluginStats = {
        totalExecutions: 1000,
        successfulExecutions: 980,
        failedExecutions: 20,
        avgExecutionTime: 45.5,
      };

      expect(stats.totalExecutions).toBe(1000);
      expect(stats.successfulExecutions).toBe(980);
      expect(stats.failedExecutions).toBe(20);
      expect(stats.avgExecutionTime).toBe(45.5);
    });

    it('should support optional lastExecution', () => {
      const now = Date.now();
      const stats: PluginStats = {
        totalExecutions: 100,
        successfulExecutions: 100,
        failedExecutions: 0,
        avgExecutionTime: 10,
        lastExecution: now,
      };

      expect(stats.lastExecution).toBe(now);
    });
  });
});
