/**
 * RemotePluginLoader - Remote plugin loading for Organic Interface
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

import type {
  PluginInterface,
  PluginMetadata,
  PluginConfig,
  PluginLifecycleState,
} from '../interfaces/PluginInterface.js';
import type {
  PluginLoaderInterface,
  PluginLoadResult,
  PluginDiscoveryResult,
  RemotePluginSource,
  RemotePluginLoadResult,
  CompatibilityResult,
  CompatibilityIssue,
} from '../interfaces/PluginLoaderInterface.js';
import { PluginLoader } from './PluginLoader.js';

/**
 * Remote plugin source type
 */
type SourceType = 'npm' | 'git' | 'http' | 'file';

/**
 * Remote plugin loader options
 */
export interface RemotePluginLoaderOptions {
  /** Directory for installing remote plugins */
  installDir?: string;
  /** Base URL for plugin registry */
  registryUrl?: string;
  /** Network timeout in milliseconds */
  timeout?: number;
  /** Enable SSL verification */
  verifySsl?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<RemotePluginLoaderOptions> = {
  installDir: './plugins/remote',
  registryUrl: 'https://registry.organic.example.com',
  timeout: 30000,
  verifySsl: true,
};

/**
 * Parse source type from URL
 */
function parseSourceType(source: string): SourceType {
  if (source.startsWith('npm:')) return 'npm';
  if (source.startsWith('git:') || source.startsWith('git+')) return 'git';
  if (source.startsWith('http://') || source.startsWith('https://')) return 'http';
  return 'file';
}

/**
 * RemotePluginLoader - Loads plugins from remote sources
 */
export class RemotePluginLoader implements PluginLoaderInterface {
  private options: Required<RemotePluginLoaderOptions>;
  private localLoader: PluginLoader;
  private remoteSources: Map<string, RemotePluginSource> = new Map();
  private installCache: Map<string, string> = new Map();

  /**
   * Create a new RemotePluginLoader
   * @param options - Loader options
   */
  constructor(options: RemotePluginLoaderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.localLoader = new PluginLoader({ baseDir: this.options.installDir });
  }

  /**
   * Load a plugin from remote source
   */
  async load(pluginId: string, config?: PluginConfig): Promise<PluginLoadResult> {
    // Check if already installed locally
    if (this.installCache.has(pluginId)) {
      return this.localLoader.load(pluginId, config);
    }

    // Get source info
    const source = this.remoteSources.get(pluginId);
    if (!source) {
      return {
        success: false,
        error: `Remote source not found for plugin: ${pluginId}`,
      };
    }

    try {
      // Install the plugin
      const installResult = await this.installPlugin(source);
      if (!installResult.success) {
        return installResult;
      }

      // Update cache
      this.installCache.set(pluginId, source.url);

      // Load from local
      return this.localLoader.load(pluginId, config);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unload a plugin
   */
  async unload(pluginId: string): Promise<void> {
    await this.localLoader.unload(pluginId);
    this.installCache.delete(pluginId);
  }

  /**
   * Reload a plugin
   */
  async reload(pluginId: string): Promise<PluginLoadResult> {
    await this.unload(pluginId);
    return this.load(pluginId);
  }

  /**
   * Discover available remote plugins (via registry)
   */
  async discover(): Promise<PluginDiscoveryResult[]> {
    // For now, return empty - would need registry API integration
    // In a real implementation, this would query the registry
    return [];
  }

  /**
   * Get plugin status
   */
  getStatus(pluginId: string) {
    return this.localLoader.getStatus(pluginId);
  }

  /**
   * Check if plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.localLoader.isLoaded(pluginId);
  }

  /**
   * List loaded plugins
   */
  listLoaded(): string[] {
    return this.localLoader.listLoaded();
  }

  /**
   * Validate compatibility
   */
  async validateCompatibility(metadata: PluginMetadata): Promise<CompatibilityResult> {
    return this.localLoader.validateCompatibility(metadata);
  }

  /**
   * Register a remote plugin source
   * @param pluginId - Plugin identifier
   * @param source - Remote source information
   */
  registerSource(pluginId: string, source: RemotePluginSource): void {
    this.remoteSources.set(pluginId, source);
  }

  /**
   * Unregister a remote plugin source
   * @param pluginId - Plugin identifier
   */
  unregisterSource(pluginId: string): void {
    this.remoteSources.delete(pluginId);
    this.installCache.delete(pluginId);
  }

  // ==================== Private Methods ====================

  /**
   * Install plugin from remote source
   */
  private async installPlugin(source: RemotePluginSource): Promise<RemotePluginLoadResult> {
    switch (source.type) {
      case 'http':
        return this.downloadPlugin(source);
      case 'npm':
        return this.installNpmPackage(source);
      case 'git':
        return this.cloneGitRepository(source);
      default:
        return {
          success: false,
          error: `Unsupported source type: ${source.type}`,
          source,
        };
    }
  }

  /**
   * Download plugin from HTTP/HTTPS URL
   */
  private async downloadPlugin(source: RemotePluginSource): Promise<RemotePluginLoadResult> {
    return new Promise((resolve) => {
      const protocol = source.url.startsWith('https') ? https : http;

      const req = protocol.get(source.url, { timeout: this.options.timeout }, (res) => {
        // Handle redirects
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectSource = { ...source, url: res.headers.location };
          this.downloadPlugin(redirectSource).then(resolve);
          return;
        }

        if (res.statusCode !== 200) {
          resolve({
            success: false,
            error: `Download failed with status: ${res.statusCode}`,
            source,
          });
          return;
        }

        // Collect data
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const pluginDir = this.getPluginInstallPath(source.pluginId);

            // Ensure directory exists
            fs.mkdirSync(pluginDir, { recursive: true });

            // Try to extract archive or save as file
            // For now, save raw content (would need proper archive extraction)
            const filePath = path.join(pluginDir, 'plugin.js');
            fs.writeFileSync(filePath, buffer);

            resolve({
              success: true,
              source,
              installPath: pluginDir,
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              source,
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          source,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Download timed out',
          source,
        });
      });
    });
  }

  /**
   * Install NPM package (placeholder - would need npm CLI or library)
   */
  private async installNpmPackage(source: RemotePluginSource): Promise<RemotePluginLoadResult> {
    // This would typically use npm registry API or npm CLI
    // For now, return error indicating implementation needed
    return {
      success: false,
      error: 'NPM package installation not yet implemented',
      source,
    };
  }

  /**
   * Clone git repository (placeholder - would need git CLI or library)
   */
  private async cloneGitRepository(source: RemotePluginSource): Promise<RemotePluginLoadResult> {
    // This would typically use git CLI or a library like simple-git
    // For now, return error indicating implementation needed
    return {
      success: false,
      error: 'Git repository cloning not yet implemented',
      source,
    };
  }

  /**
   * Get plugin install path
   */
  private getPluginInstallPath(pluginId: string): string {
    return path.join(this.options.installDir, pluginId);
  }
}