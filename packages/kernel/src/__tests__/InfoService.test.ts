/**
 * InfoService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { InfoService } from '../services/InfoService.js';

describe('InfoService', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save and clean env for predictable tests
    savedEnv = { ...process.env };
    delete process.env.PROJECT_ROOT;
    delete process.env.KERNEL_PROJECT_ROOT;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.DEBUG;
    delete process.env.NODE_ENV;
    delete process.env.TERM;
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.restoreAllMocks();
  });

  // ==================== Constructor ====================

  describe('Constructor', () => {
    it('should create with default config', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc).toBeInstanceOf(InfoService);
    });

    it('should use provided projectRoot', () => {
      const svc = new InfoService({ projectRoot: '/custom/root' });
      expect(svc.getProjectRoot()).toBe('/custom/root');
    });

    it('should use provided kernelVersion', () => {
      const svc = new InfoService({
        projectRoot: '/tmp/test-project',
        kernelVersion: '2.0.0',
      });
      const info = svc.getSystemInfo();
      expect(info.kernelVersion).toBe('2.0.0');
    });

    it('should use default kernelVersion when not provided', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getSystemInfo();
      expect(info.kernelVersion).toBe('0.1.0');
    });

    it('should auto-detect project root from env when not provided', () => {
      process.env.PROJECT_ROOT = '/tmp/from-env';
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const svc = new InfoService();
      expect(svc.getProjectRoot()).toBe('/tmp/from-env');
      existsSyncSpy.mockRestore();
    });

    it('should fallback to cwd when env root not set', () => {
      const svc = new InfoService();
      expect(svc.getProjectRoot()).toBe(process.cwd());
    });

    it('should not auto-detect project when autoDetectProject is false', () => {
      const svc = new InfoService({
        projectRoot: '/tmp/test-project',
        autoDetectProject: false,
      });
      const context = svc.getProjectContext();
      // With autoDetectProject: false, projectContext starts null, then loads on getProjectContext
      expect(context).toBeDefined();
      expect(context.root).toBe('/tmp/test-project');
    });
  });

  // ==================== Project Context ====================

  describe('getProjectContext()', () => {
    it('should return project context with default values when no package.json', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const svc = new InfoService({ projectRoot: '/tmp/my-project' });
      const context = svc.getProjectContext();
      expect(context.root).toBe('/tmp/my-project');
      expect(context.name).toBe('my-project'); // basename of root
      expect(context.version).toBe('0.0.0');
    });

    it('should load from package.json when it exists', () => {
      const packageJson = JSON.stringify({
        name: 'test-pkg',
        version: '3.2.1',
        description: 'A test package',
        author: 'test-author',
        license: 'MIT',
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(packageJson);

      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const context = svc.getProjectContext();

      expect(context.name).toBe('test-pkg');
      expect(context.version).toBe('3.2.1');
      expect(context.description).toBe('A test package');
      expect(context.metadata?.author).toBe('test-author');
      expect(context.metadata?.license).toBe('MIT');
    });

    it('should handle malformed package.json gracefully', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('not valid json {{{');

      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const context = svc.getProjectContext();

      // Falls back to default values
      expect(context.name).toBe('test-project');
      expect(context.version).toBe('0.0.0');
    });

    it('should cache project context after first load', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'cached-pkg', version: '1.0.0' })
      );

      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const context1 = svc.getProjectContext();
      const context2 = svc.getProjectContext();

      // readFileSync should only be called once (during construction)
      // Then getProjectContext returns cached value
      expect(context1.name).toBe('cached-pkg');
      expect(context1.version).toBe('1.0.0');
      expect(context2.name).toBe('cached-pkg');
      expect(context2.version).toBe('1.0.0');
    });

    it('should return a clone, not the original', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'pkg', version: '1.0.0' })
      );

      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const context1 = svc.getProjectContext();
      const context2 = svc.getProjectContext();

      expect(context1).not.toBe(context2);
    });
  });

  // ==================== Project Info Accessors ====================

  describe('getProjectRoot()', () => {
    it('should return the project root', () => {
      const svc = new InfoService({ projectRoot: '/my/project' });
      expect(svc.getProjectRoot()).toBe('/my/project');
    });
  });

  describe('getProjectName()', () => {
    it('should return project name from context', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'my-app', version: '1.0.0' })
      );
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getProjectName()).toBe('my-app');
    });

    it('should return "unknown" when no name available', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const svc = new InfoService({ projectRoot: '' });
      expect(svc.getProjectName()).toBe('unknown');
    });
  });

  describe('getProjectVersion()', () => {
    it('should return version from context', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'app', version: '2.0.0' })
      );
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getProjectVersion()).toBe('2.0.0');
    });

    it('should return "0.0.0" when no version available', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getProjectVersion()).toBe('0.0.0');
    });
  });

  // ==================== System Information ====================

  describe('getSystemInfo()', () => {
    it('should return comprehensive system info', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getSystemInfo();

      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('nodeVersion');
      expect(info).toHaveProperty('kernelVersion');
      expect(info).toHaveProperty('uptime');
      expect(info).toHaveProperty('cpuCount');
      expect(info).toHaveProperty('totalMemory');
      expect(info).toHaveProperty('freeMemory');
      expect(info).toHaveProperty('hostname');
      expect(info.nodeVersion).toBe(process.version);
    });

    it('should cache system info and update dynamic fields', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info1 = svc.getSystemInfo();
      const info2 = svc.getSystemInfo();

      // Static fields should be same object properties
      expect(info2.platform).toBe(info1.platform);
    });

    it('should return a clone, not the original', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info1 = svc.getSystemInfo();
      const info2 = svc.getSystemInfo();

      expect(info1).not.toBe(info2);
    });
  });

  // ==================== Platform Information ====================

  describe('getPlatformInfo()', () => {
    it('should detect platform correctly', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();

      expect(typeof info.isWindows).toBe('boolean');
      expect(typeof info.isMac).toBe('boolean');
      expect(typeof info.isLinux).toBe('boolean');
      expect(typeof info.isCI).toBe('boolean');
      expect(info).toHaveProperty('homeDir');
      expect(info).toHaveProperty('tempDir');
      expect(info).toHaveProperty('cwd');
      expect(info).toHaveProperty('terminalType');
      expect(info).toHaveProperty('colorSupport');
    });

    it('should detect CI environment when CI env var is set', () => {
      process.env.CI = 'true';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.isCI).toBe(true);
    });

    it('should detect GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.isCI).toBe(true);
    });

    it('should detect terminal type from TERM env', () => {
      process.env.TERM = 'xterm-256color';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.terminalType).toBe('xterm-256color');
    });

    it('should default terminal type to "unknown"', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.terminalType).toBe('unknown');
    });

    it('should return clone, not original', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info1 = svc.getPlatformInfo();
      const info2 = svc.getPlatformInfo();

      expect(info1).not.toBe(info2);
    });

    it('should cache platform info and update cwd dynamically', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info1 = svc.getPlatformInfo();
      const info2 = svc.getPlatformInfo();

      expect(info2.isLinux).toBe(info1.isLinux);
    });
  });

  // ==================== Runtime Information ====================

  describe('getRuntimeInfo()', () => {
    it('should return runtime info with default env (development)', () => {
      delete process.env.NODE_ENV;
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getRuntimeInfo();

      expect(info.env).toBe('development');
      expect(info.debug).toBe(false);
      expect(info.test).toBe(false);
      expect(typeof info.pid).toBe('number');
      expect(typeof info.processUptime).toBe('number');
      expect(Array.isArray(info.nodeEnvs)).toBe(true);
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getRuntimeInfo();

      expect(info.env).toBe('test');
      expect(info.test).toBe(true);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getRuntimeInfo();

      expect(info.env).toBe('production');
    });

    it('should detect debug mode from DEBUG=true', () => {
      process.env.DEBUG = 'true';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getRuntimeInfo();

      expect(info.debug).toBe(true);
    });

    it('should detect debug mode from DEBUG=1', () => {
      process.env.DEBUG = '1';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getRuntimeInfo();

      expect(info.debug).toBe(true);
    });

    it('should filter NODE_ prefixed env vars', () => {
      process.env.NODE_PATH = '/some/path';
      process.env.NODE_OPTIONS = '--max-old-space-size=4096';
      process.env.PATH = '/usr/bin';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getRuntimeInfo();

      expect(info.nodeEnvs).toContain('NODE_PATH');
      expect(info.nodeEnvs).toContain('NODE_OPTIONS');
      expect(info.nodeEnvs).not.toContain('PATH');
    });
  });

  // ==================== Configuration Access ====================

  describe('getConfig()', () => {
    it('should return env value for existing env var', () => {
      process.env.MY_CONFIG = 'hello';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getConfig('MY_CONFIG')).toBe('hello');
    });

    it('should return undefined for unknown key', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getConfig('NON_EXISTENT_KEY_XYZ')).toBeUndefined();
    });
  });

  describe('getAllConfigs()', () => {
    it('should return all env vars as config', () => {
      process.env.CONFIG_A = 'valueA';
      process.env.CONFIG_B = 'valueB';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const configs = svc.getAllConfigs();

      expect(configs.CONFIG_A).toBe('valueA');
      expect(configs.CONFIG_B).toBe('valueB');
    });
  });

  // ==================== Environment Variables ====================

  describe('getEnv()', () => {
    it('should return environment variable value', () => {
      process.env.TEST_VAR = 'test-value';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getEnv('TEST_VAR')).toBe('test-value');
    });

    it('should return undefined for non-existent env var', () => {
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      expect(svc.getEnv('NON_EXISTENT_VAR')).toBeUndefined();
    });
  });

  describe('getAllEnvs()', () => {
    it('should return all environment variables', () => {
      process.env.TEST_ENV = 'env-value';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const envs = svc.getAllEnvs();

      expect(envs.TEST_ENV).toBe('env-value');
      expect(typeof envs).toBe('object');
    });
  });

  // ==================== Path Helpers ====================

  describe('resolvePath()', () => {
    it('should resolve path relative to project root', () => {
      const svc = new InfoService({ projectRoot: '/my/project' });
      const resolved = svc.resolvePath('src', 'index.ts');
      expect(resolved).toBe(path.resolve('/my/project', 'src', 'index.ts'));
    });

    it('should handle single argument', () => {
      const svc = new InfoService({ projectRoot: '/my/project' });
      expect(svc.resolvePath('test')).toBe(path.resolve('/my/project', 'test'));
    });

    it('should handle absolute paths', () => {
      const svc = new InfoService({ projectRoot: '/my/project' });
      expect(svc.resolvePath('/absolute/path')).toBe('/absolute/path');
    });
  });

  describe('pathExists()', () => {
    it('should return true when path exists', () => {
      const accessSyncSpy = vi.spyOn(fs, 'accessSync').mockReturnValue(undefined);
      const svc = new InfoService({ projectRoot: '/my/project' });
      expect(svc.pathExists('existing', 'file.txt')).toBe(true);
      accessSyncSpy.mockRestore();
    });

    it('should return false when path does not exist', () => {
      vi.spyOn(fs, 'accessSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const svc = new InfoService({ projectRoot: '/my/project' });
      expect(svc.pathExists('nonexistent')).toBe(false);
    });
  });

  describe('getPackageJsonPath()', () => {
    it('should return package.json path under project root', () => {
      const svc = new InfoService({ projectRoot: '/my/project' });
      expect(svc.getPackageJsonPath()).toBe('/my/project/package.json');
    });
  });

  // ==================== Color Support Detection ====================

  describe('Color Support (via getPlatformInfo)', () => {
    it('should detect "none" when TERM is dumb', () => {
      process.env.TERM = 'dumb';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('none');
    });

    it('should detect "none" when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      Object.defineProperty(process.stdout, 'isTTY', { get: () => false, configurable: true });
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('none');
    });

    it('should detect "256" when TERM contains 256', () => {
      process.env.TERM = 'xterm-256color';
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('256');
    });

    it('should detect "basic" when TERM contains color', () => {
      process.env.TERM = 'xterm-color';
      Object.defineProperty(process.stdout, 'isTTY', { get: () => true, configurable: true });
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('basic');
    });

    it('should respect FORCE_COLOR=1', () => {
      process.env.FORCE_COLOR = '1';
      Object.defineProperty(process.stdout, 'isTTY', { get: () => false, configurable: true });
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('basic');
    });

    it('should respect FORCE_COLOR=2', () => {
      process.env.FORCE_COLOR = '2';
      Object.defineProperty(process.stdout, 'isTTY', { get: () => false, configurable: true });
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('256');
    });

    it('should respect FORCE_COLOR=3', () => {
      process.env.FORCE_COLOR = '3';
      Object.defineProperty(process.stdout, 'isTTY', { get: () => false, configurable: true });
      const svc = new InfoService({ projectRoot: '/tmp/test-project' });
      const info = svc.getPlatformInfo();
      expect(info.colorSupport).toBe('16m');
    });
  });

  // ==================== Constructor env detection ====================

  describe('Constructor - PROJECT_ROOT env detection', () => {
    it('should use KERNEL_PROJECT_ROOT if PROJECT_ROOT not set', () => {
      process.env.KERNEL_PROJECT_ROOT = '/tmp/kernel-root';
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const svc = new InfoService();
      expect(svc.getProjectRoot()).toBe('/tmp/kernel-root');
      existsSyncSpy.mockRestore();
    });

    it('should prefer PROJECT_ROOT over KERNEL_PROJECT_ROOT', () => {
      process.env.PROJECT_ROOT = '/tmp/project-root';
      process.env.KERNEL_PROJECT_ROOT = '/tmp/kernel-root';
      const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const svc = new InfoService();
      expect(svc.getProjectRoot()).toBe('/tmp/project-root');
      existsSyncSpy.mockRestore();
    });

    it('should fallback to cwd if env root does not exist on disk', () => {
      process.env.PROJECT_ROOT = '/nonexistent/path';
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const svc = new InfoService();
      expect(svc.getProjectRoot()).toBe(process.cwd());
    });
  });
});
