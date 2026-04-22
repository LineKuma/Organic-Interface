/**
 * InfoService - System information service for Kernel
 *
 * Provides system info, project context, platform detection,
 * and environment variable access.
 */

import os from 'node:os';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';

// ==================== Type Definitions ====================

/**
 * Project context information
 */
export interface ProjectContext {
  /** Project root directory */
  root: string;
  /** Project name */
  name: string;
  /** Project version */
  version: string;
  /** Project description */
  description?: string;
  /** Project metadata */
  metadata?: Record<string, unknown>;
  /** Package.json path */
  packageJsonPath?: string;
}

/**
 * System information
 */
export interface SystemInfo {
  /** Operating system platform */
  platform: string;
  /** CPU architecture */
  arch: string;
  /** Node.js version */
  nodeVersion: string;
  /** Kernel version */
  kernelVersion: string;
  /** System uptime in seconds */
  uptime: number;
  /** CPU count */
  cpuCount: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** Free memory in bytes */
  freeMemory: number;
  /** Hostname */
  hostname: string;
}

/**
 * Platform information
 */
export interface PlatformInfo {
  /** Is Windows */
  isWindows: boolean;
  /** Is macOS */
  isMac: boolean;
  /** Is Linux */
  isLinux: boolean;
  /** Is CI environment */
  isCI: boolean;
  /** Home directory */
  homeDir: string;
  /** Temporary directory */
  tempDir: string;
  /** Current working directory */
  cwd: string;
  /** Terminal type */
  terminalType: string;
  /** Color support level */
  colorSupport: 'none' | 'basic' | '256' | '16m';
}

/**
 * Runtime information
 */
export interface RuntimeInfo {
  /** Environment */
  env: 'development' | 'production' | 'test';
  /** Debug mode */
  debug: boolean;
  /** Test mode */
  test: boolean;
  /** Node environment variables */
  nodeEnvs: string[];
  /** Process ID */
  pid: number;
  /** Process uptime */
  processUptime: number;
}

/**
 * Config value type
 */
export type ConfigValue = string | number | boolean | object | null | undefined;

/**
 * InfoService configuration
 */
export interface InfoServiceConfig {
  /** Project root directory (auto-detected if not provided) */
  projectRoot?: string;
  /** Custom kernel version */
  kernelVersion?: string;
  /** Auto-detect project from package.json */
  autoDetectProject?: boolean;
}

// ==================== InfoService Implementation ====================

/**
 * InfoService - System information service for Kernel
 *
 * Provides comprehensive system, platform, and project information
 * for plugins to use in text interactions and configuration.
 */
export class InfoService {
  private readonly projectRoot: string;
  private readonly kernelVersion: string;
  private projectContext: ProjectContext | null = null;
  private cachedSystemInfo: SystemInfo | null = null;
  private cachedPlatformInfo: PlatformInfo | null = null;

  constructor(config: InfoServiceConfig = {}) {
    // Auto-detect project root
    this.projectRoot = config.projectRoot ?? this.detectProjectRoot();
    this.kernelVersion = config.kernelVersion ?? '0.1.0';

    // Auto-detect project context if enabled
    if (config.autoDetectProject !== false) {
      this.projectContext = this.loadProjectContext();
    }
  }

  // ==================== Project Context ====================

  /**
   * Get project context information
   */
  getProjectContext(): ProjectContext {
    if (!this.projectContext) {
      this.projectContext = this.loadProjectContext();
    }
    return { ...this.projectContext };
  }

  /**
   * Get project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get project name
   */
  getProjectName(): string {
    const context = this.getProjectContext();
    return context.name || 'unknown';
  }

  /**
   * Get project version
   */
  getProjectVersion(): string {
    const context = this.getProjectContext();
    return context.version || '0.0.0';
  }

  // ==================== System Information ====================

  /**
   * Get comprehensive system information
   */
  getSystemInfo(): SystemInfo {
    if (this.cachedSystemInfo) {
      // Update uptime dynamically
      return {
        ...this.cachedSystemInfo,
        uptime: os.uptime(),
        freeMemory: os.freemem(),
      };
    }

    this.cachedSystemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      kernelVersion: this.kernelVersion,
      uptime: os.uptime(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      hostname: os.hostname(),
    };

    return { ...this.cachedSystemInfo };
  }

  /**
   * Get platform-specific information
   */
  getPlatformInfo(): PlatformInfo {
    if (this.cachedPlatformInfo) {
      // Update cwd dynamically
      return {
        ...this.cachedPlatformInfo,
        cwd: process.cwd(),
      };
    }

    const platform = process.platform;
    const isCI = this.detectCI();

    this.cachedPlatformInfo = {
      isWindows: platform === 'win32',
      isMac: platform === 'darwin',
      isLinux: platform === 'linux',
      isCI,
      homeDir: os.homedir(),
      tempDir: os.tmpdir(),
      cwd: process.cwd(),
      terminalType: process.env.TERM || 'unknown',
      colorSupport: this.detectColorSupport(),
    };

    return { ...this.cachedPlatformInfo };
  }

  // ==================== Runtime Information ====================

  /**
   * Get runtime information
   */
  getRuntimeInfo(): RuntimeInfo {
    const env = this.detectEnvironment();
    const debug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

    return {
      env,
      debug,
      test: process.env.NODE_ENV === 'test',
      nodeEnvs: Object.keys(process.env).filter(k => k.startsWith('NODE_')),
      pid: process.pid,
      processUptime: process.uptime(),
    };
  }

  // ==================== Configuration Access ====================

  /**
   * Get a configuration value
   * Note: Actual config values should be stored externally and passed to InfoService
   */
  getConfig(key: string): ConfigValue {
    // Try to get from environment first
    const envValue = process.env[key];
    if (envValue !== undefined) {
      return envValue;
    }

    // Return undefined for unknown keys
    return undefined;
  }

  /**
   * Get all configuration values (from environment)
   */
  getAllConfigs(): Record<string, ConfigValue> {
    const configs: Record<string, ConfigValue> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        configs[key] = value;
      }
    }

    return configs;
  }

  // ==================== Environment Variables ====================

  /**
   * Get an environment variable
   */
  getEnv(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Get all environment variables
   */
  getAllEnvs(): Record<string, string> {
    const envs: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        envs[key] = value;
      }
    }

    return envs;
  }

  // ==================== Path Helpers ====================

  /**
   * Resolve path relative to project root
   */
  resolvePath(...parts: string[]): string {
    return path.resolve(this.projectRoot, ...parts);
  }

  /**
   * Check if a path exists
   */
  pathExists(...parts: string[]): boolean {
    try {
      const fullPath = this.resolvePath(...parts);
      fs.accessSync(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get package.json path
   */
  getPackageJsonPath(): string {
    return path.join(this.projectRoot, 'package.json');
  }

  // ==================== Private Helper Methods ====================

  /**
   * Detect project root directory
   */
  private detectProjectRoot(): string {
    // Check for explicit root configuration
    const explicitRoot = process.env.PROJECT_ROOT || process.env.KERNEL_PROJECT_ROOT;
    if (explicitRoot && fs.existsSync(explicitRoot)) {
      return explicitRoot;
    }

    // Use cwd as fallback
    return process.cwd();
  }

  /**
   * Load project context from package.json
   */
  private loadProjectContext(): ProjectContext {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');

    try {
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);

        return {
          root: this.projectRoot,
          name: pkg.name || path.basename(this.projectRoot),
          version: pkg.version || '0.0.0',
          description: pkg.description,
          metadata: {
            author: pkg.author,
            license: pkg.license,
            repository: pkg.repository,
          },
          packageJsonPath,
        };
      }
    } catch (error) {
      // Ignore parsing errors, return default context
    }

    return {
      root: this.projectRoot,
      name: path.basename(this.projectRoot),
      version: '0.0.0',
      packageJsonPath,
    };
  }

  /**
   * Detect CI environment
   */
  private detectCI(): boolean {
    const ciVars = [
      'CI',
      'GITHUB_ACTIONS',
      'GITLAB_CI',
      'JENKINS_HOME',
      'CIRCLECI',
      'TRAVIS',
      'APPVEYOR',
      'BUILD_NUMBER',
      'GITHUB_TOKEN',
      'GITLAB_TOKEN',
    ];

    return ciVars.some(varName => !!process.env[varName]);
  }

  /**
   * Detect color support level
   */
  private detectColorSupport(): 'none' | 'basic' | '256' | '16m' {
    const term = process.env.TERM || '';

    if (term === 'dumb') {
      return 'none';
    }

    // Check for 16m (Truecolor) support
    if (term.includes('256') || term.includes('16m') || term.includes('rgb')) {
      return process.env.FORCE_COLOR === '16m' ? '16m' : '256';
    }

    // Check basic color support
    if (term.includes('color') || term.includes('xterm')) {
      return 'basic';
    }

    // Check NO_COLOR variable
    if (process.env.NO_COLOR) {
      return 'none';
    }

    // Check FORCE_COLOR
    if (process.env.FORCE_COLOR) {
      const force = parseInt(process.env.FORCE_COLOR, 10);
      if (force >= 3) return '16m';
      if (force >= 2) return '256';
      if (force >= 1) return 'basic';
    }

    return process.stdout.isTTY ? 'basic' : 'none';
  }

  /**
   * Detect environment (dev/prod/test)
   */
  private detectEnvironment(): 'development' | 'production' | 'test' {
    if (process.env.NODE_ENV === 'test') {
      return 'test';
    }
    if (process.env.NODE_ENV === 'production') {
      return 'production';
    }
    return 'development';
  }
}

// ==================== Export Types ====================

export type {
  InfoServiceConfig,
  ProjectContext,
  SystemInfo,
  PlatformInfo,
  RuntimeInfo,
  ConfigValue,
};
