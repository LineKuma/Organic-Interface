/**
 * Interactive CLI editor for model configuration
 *
 * Provides a rich interactive command-line interface for
 * managing model configurations: providers, models, API keys,
 * presets, and global settings.
 *
 * Uses the Prompt component from @organic/ui for user input
 * and chalk for terminal styling.
 */

import { createLogger, type Logger } from '@organic/utils';
import chalk from 'chalk';

import type {
  ProviderId,
  ProviderConfig,
  ModelConfig,
  PresetDefinition,
  ApiKeyConfig,
  ModelParameters,
} from '../types/index.js';
import { PROVIDER_DEFINITIONS } from '../types/provider.js';
import { MODEL_DEFINITIONS } from '../types/model.js';

import { ModelConfigStore } from '../services/ModelConfigStore.js';
import { ModelConfigService } from '../services/ModelConfigService.js';

// ── Helpers ──────────────────────────────────────────────────────

/** Generate a simple unique ID */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/** Format a boolean for display */
function fmtBool(value: boolean): string {
  return value ? chalk.green('enabled') : chalk.red('disabled');
}

/** Format a timestamp for display */
function fmtTime(ts?: number): string {
  if (!ts) return chalk.dim('never');
  return new Date(ts).toLocaleString();
}

/** Print a section header */
function header(title: string): void {
  console.log(`\n${chalk.bold.cyan('═══')} ${chalk.bold.white(title)} ${chalk.bold.cyan('═══')}`);
}

/** Print a labeled value */
function field(label: string, value: string): void {
  console.log(`  ${chalk.dim(label + ':')} ${value}`);
}

// ── Main CLI Class ───────────────────────────────────────────────

/**
 * Interactive CLI for model configuration management.
 *
 * Provides a menu-driven interface for:
 * - Viewing configuration status
 * - Adding/editing/removing providers
 * - Managing API keys (add, rotate, enable/disable)
 * - Adding/editing/removing models
 * - Managing presets
 * - Configuring global settings
 * - Running validation and integrity checks
 */
export class ModelConfigCLI {
  private store: ModelConfigStore;
  private service: ModelConfigService;
  private logger: Logger;
  private running: boolean = false;

  constructor(store?: ModelConfigStore, logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'ModelConfigCLI' });
    this.store = store ?? new ModelConfigStore(this.logger);
    this.service = new ModelConfigService(this.store, this.logger);
  }

  /** Get the underlying store */
  getStore(): ModelConfigStore {
    return this.store;
  }

  /** Start the interactive CLI session */
  async start(): Promise<void> {
    this.running = true;
    this.showBanner();

    while (this.running) {
      await this.showMainMenu();
    }
  }

  /** Stop the CLI */
  stop(): void {
    this.running = false;
  }

  // ── Display ────────────────────────────────────────────────────

  private showBanner(): void {
    console.log(chalk.bold.cyan('\n  ╔══════════════════════════════════════╗'));
    console.log(
      chalk.bold.cyan('  ║') +
        chalk.bold.white('   Model Configuration Manager       ') +
        chalk.bold.cyan('║')
    );
    console.log(chalk.bold.cyan('  ╚══════════════════════════════════════╝\n'));
    this.showStatus();
  }

  private showStatus(): void {
    const health = this.service.getHealthSummary();
    const integrity = health.healthy
      ? chalk.green('OK')
      : chalk.red(`${health.integrityErrors.length} errors`);

    console.log(chalk.dim('  Status:'));
    console.log(`    Providers: ${health.providers.enabled}/${health.providers.total} enabled`);
    console.log(`    Models:    ${health.models.enabled}/${health.models.total} enabled`);
    console.log(`    Keys:      ${health.keys.active}/${health.keys.total} active`);
    console.log(`    Presets:   ${health.presets.total} (${health.presets.userDefined} custom)`);
    console.log(`    Integrity: ${integrity}`);
    console.log();
  }

  // ── Main Menu ──────────────────────────────────────────────────

  private async showMainMenu(): Promise<void> {
    console.log(chalk.bold('Main Menu:'));
    console.log(`  ${chalk.cyan('1.')} View Configuration`);
    console.log(`  ${chalk.cyan('2.')} Manage Providers`);
    console.log(`  ${chalk.cyan('3.')} Manage API Keys`);
    console.log(`  ${chalk.cyan('4.')} Manage Models`);
    console.log(`  ${chalk.cyan('5.')} Manage Presets`);
    console.log(`  ${chalk.cyan('6.')} Global Settings`);
    console.log(`  ${chalk.cyan('7.')} Quick Setup Wizard`);
    console.log(`  ${chalk.cyan('8.')} Run Validation & Integrity Check`);
    console.log(`  ${chalk.cyan('9.')} Export Configuration`);
    console.log(`  ${chalk.cyan('0.')} Exit`);

    const choice = await this.promptInput('Select option');

    switch (choice) {
      case '1':
        await this.viewConfig();
        break;
      case '2':
        await this.manageProviders();
        break;
      case '3':
        await this.manageKeys();
        break;
      case '4':
        await this.manageModels();
        break;
      case '5':
        await this.managePresets();
        break;
      case '6':
        await this.manageSettings();
        break;
      case '7':
        await this.setupWizard();
        break;
      case '8':
        await this.runValidation();
        break;
      case '9':
        this.exportConfig();
        break;
      case '0':
        this.stop();
        console.log(chalk.dim('\n  Goodbye!\n'));
        break;
      default:
        console.log(chalk.yellow('  Invalid option'));
    }
  }

  // ── View Config ────────────────────────────────────────────────

  private async viewConfig(): Promise<void> {
    header('Configuration Overview');

    // Settings
    const settings = this.store.getSettings();
    console.log(chalk.bold('\n  Global Settings:'));
    field('Default Provider', settings.defaultProvider ?? chalk.dim('none'));
    field('Default Model', settings.defaultModel ?? chalk.dim('none'));
    field('Default Preset', settings.defaultPreset ?? chalk.dim('none'));
    field('Max Retries', String(settings.maxRetries));
    field('Request Timeout', `${settings.requestTimeout}ms`);
    field('Auto Key Rotation', fmtBool(settings.autoKeyRotation));
    field('Auto Model Fallback', fmtBool(settings.autoModelFallback));
    field('Log Level', settings.logLevel);

    // Providers
    console.log(chalk.bold('\n  Providers:'));
    const providers = this.store.getProviders();
    if (providers.length === 0) {
      console.log(chalk.dim('    No providers configured'));
    } else {
      for (const p of providers) {
        const status = p.enabled ? chalk.green('●') : chalk.red('○');
        console.log(
          `    ${status} ${chalk.cyan(p.provider)} ${chalk.dim(`(${p.label})`)} - ${p.keys.length} keys`
        );
      }
    }

    // Models
    console.log(chalk.bold('\n  Models:'));
    const models = this.store.getModels();
    if (models.length === 0) {
      console.log(chalk.dim('    No models configured'));
    } else {
      for (const m of models) {
        const status = m.enabled ? chalk.green('●') : chalk.red('○');
        console.log(
          `    ${status} ${chalk.cyan(m.id)} ${chalk.dim(`[${m.modelId}] → ${m.provider}`)}`
        );
        if (m.defaultPreset) {
          console.log(`      ${chalk.dim('preset:')} ${m.defaultPreset}`);
        }
      }
    }

    // Presets
    console.log(chalk.bold('\n  Presets:'));
    const presets = this.store.getPresets();
    for (const p of presets) {
      const tag = p.builtIn ? chalk.dim('[built-in]') : chalk.yellow('[custom]');
      console.log(`    ${chalk.cyan(p.id)} ${tag} - ${p.name}`);
      console.log(`      ${chalk.dim(p.description)}`);
    }

    await this.promptInput('\nPress Enter to continue');
  }

  // ── Manage Providers ───────────────────────────────────────────

  private async manageProviders(): Promise<void> {
    header('Manage Providers');

    const providers = this.store.getProviders();
    if (providers.length > 0) {
      console.log(chalk.bold('\n  Configured Providers:'));
      for (let i = 0; i < providers.length; i++) {
        const p = providers[i];
        const status = p.enabled ? chalk.green('enabled') : chalk.red('disabled');
        console.log(
          `    ${chalk.cyan(`${i + 1}.`)} ${p.provider} ${chalk.dim(`(${p.label})`)} [${status}] - ${p.keys.length} keys`
        );
      }
    }

    console.log(`\n  ${chalk.cyan('a.')} Add Provider`);
    if (providers.length > 0) {
      console.log(`  ${chalk.cyan('e.')} Edit Provider`);
      console.log(`  ${chalk.cyan('d.')} Delete Provider`);
      console.log(`  ${chalk.cyan('t.')} Toggle Provider`);
    }
    console.log(`  ${chalk.cyan('b.')} Back`);

    const choice = await this.promptInput('Select action');

    switch (choice) {
      case 'a':
        await this.addProviderInteractive();
        break;
      case 'e':
        await this.editProviderInteractive();
        break;
      case 'd':
        await this.deleteProviderInteractive();
        break;
      case 't':
        await this.toggleProviderInteractive();
        break;
      case 'b':
        return;
      default:
        console.log(chalk.yellow('  Invalid option'));
    }
  }

  private async addProviderInteractive(): Promise<void> {
    header('Add Provider');

    // Show available providers
    const availableIds = Object.keys(PROVIDER_DEFINITIONS) as ProviderId[];
    console.log(chalk.bold('\n  Available Providers:'));
    for (let i = 0; i < availableIds.length; i++) {
      const def = PROVIDER_DEFINITIONS[availableIds[i]];
      console.log(
        `    ${chalk.cyan(`${i + 1}.`)} ${def.name} ${chalk.dim(`[${def.id}]`)} - ${def.category}`
      );
    }

    const idx = await this.promptInput('Select provider (number)');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > availableIds.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const providerId = availableIds[num - 1];
    const def = PROVIDER_DEFINITIONS[providerId];

    const label = await this.promptInput('Provider label', def.name);
    const baseUrl = await this.promptInput('Base URL (leave empty for default)', '');
    const keyLabel = await this.promptInput('API key label', 'default');
    const keyRef = await this.promptInput('API key reference (env var or key vault path)', '');

    if (!keyRef) {
      console.log(chalk.yellow('  No API key provided - provider will be added without keys'));
    }

    const now = Date.now();
    const config: ProviderConfig = {
      provider: providerId,
      label: label || def.name,
      baseUrlOverride: baseUrl || undefined,
      keys: keyRef
        ? [
            {
              id: generateId('key'),
              label: keyLabel || 'default',
              priority: 10,
              enabled: true,
              usageCount: 0,
              keyRef,
            },
          ]
        : [],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = this.store.addProvider(config);
    if (result.success) {
      console.log(chalk.green(`\n  Provider "${providerId}" added successfully!`));
    } else {
      console.log(chalk.red(`\n  Failed: ${result.error}`));
    }

    await this.promptInput('\nPress Enter to continue');
  }

  private async editProviderInteractive(): Promise<void> {
    const providers = this.store.getProviders();
    if (providers.length === 0) {
      console.log(chalk.dim('  No providers to edit'));
      return;
    }

    for (let i = 0; i < providers.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${providers[i].provider} ${chalk.dim(`(${providers[i].label})`)}`
      );
    }

    const idx = await this.promptInput('Select provider to edit');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > providers.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const p = providers[num - 1];

    const label = await this.promptInput('New label', p.label);
    const baseUrl = await this.promptInput('New base URL', p.baseUrlOverride ?? '');
    const enabled = await this.promptConfirm('Enabled', p.enabled);

    const result = this.store.updateProvider(p.provider, p.label, {
      label: label || p.label,
      baseUrlOverride: baseUrl || undefined,
      enabled,
    });

    if (result.success) {
      console.log(chalk.green('  Provider updated!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async deleteProviderInteractive(): Promise<void> {
    const providers = this.store.getProviders();
    if (providers.length === 0) {
      console.log(chalk.dim('  No providers to delete'));
      return;
    }

    for (let i = 0; i < providers.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${providers[i].provider} ${chalk.dim(`(${providers[i].label})`)}`
      );
    }

    const idx = await this.promptInput('Select provider to delete');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > providers.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const p = providers[num - 1];
    const confirm = await this.promptConfirm(
      `Delete provider "${p.provider}:${p.label}" and all its keys?`,
      false
    );

    if (!confirm) {
      console.log(chalk.dim('  Cancelled'));
      return;
    }

    const result = this.store.removeProvider(p.provider, p.label);
    if (result.success) {
      console.log(chalk.green('  Provider deleted!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async toggleProviderInteractive(): Promise<void> {
    const providers = this.store.getProviders();
    if (providers.length === 0) {
      console.log(chalk.dim('  No providers to toggle'));
      return;
    }

    for (let i = 0; i < providers.length; i++) {
      const status = providers[i].enabled ? chalk.green('enabled') : chalk.red('disabled');
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${providers[i].provider} ${chalk.dim(`(${providers[i].label})`)} [${status}]`
      );
    }

    const idx = await this.promptInput('Select provider to toggle');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > providers.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const p = providers[num - 1];
    const result = this.store.updateProvider(p.provider, p.label, { enabled: !p.enabled });
    if (result.success) {
      console.log(chalk.green(`  Provider ${p.enabled ? 'disabled' : 'enabled'}!`));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  // ── Manage Keys ────────────────────────────────────────────────

  private async manageKeys(): Promise<void> {
    header('Manage API Keys');

    const providers = this.store.getProviders();
    if (providers.length === 0) {
      console.log(chalk.yellow('  No providers configured. Add a provider first.'));
      await this.promptInput('\nPress Enter to continue');
      return;
    }

    // Select provider
    for (let i = 0; i < providers.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${providers[i].provider} ${chalk.dim(`(${providers[i].label})`)} - ${providers[i].keys.length} keys`
      );
    }

    const idx = await this.promptInput('Select provider');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > providers.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const provider = providers[num - 1];

    // Show keys
    console.log(chalk.bold(`\n  Keys for ${provider.provider} (${provider.label}):`));
    if (provider.keys.length === 0) {
      console.log(chalk.dim('    No keys configured'));
    } else {
      for (let i = 0; i < provider.keys.length; i++) {
        const k = provider.keys[i];
        const status = k.enabled ? chalk.green('active') : chalk.red('inactive');
        const lastUsed = k.lastUsedAt ? fmtTime(k.lastUsedAt) : 'never';
        console.log(
          `    ${chalk.cyan(`${i + 1}.`)} ${k.label} [${status}] priority:${k.priority} uses:${k.usageCount} last:${lastUsed}`
        );
      }
    }

    console.log(`\n  ${chalk.cyan('a.')} Add Key`);
    console.log(`  ${chalk.cyan('e.')} Edit Key`);
    if (provider.keys.length > 0) {
      console.log(`  ${chalk.cyan('d.')} Delete Key`);
      console.log(`  ${chalk.cyan('t.')} Toggle Key`);
    }
    console.log(`  ${chalk.cyan('b.')} Back`);

    const choice = await this.promptInput('Select action');

    switch (choice) {
      case 'a':
        await this.addKeyInteractive(provider.provider);
        break;
      case 'e':
        await this.editKeyInteractive(provider);
        break;
      case 'd':
        await this.deleteKeyInteractive(provider);
        break;
      case 't':
        await this.toggleKeyInteractive(provider);
        break;
      case 'b':
        return;
      default:
        console.log(chalk.yellow('  Invalid option'));
    }
  }

  private async addKeyInteractive(providerId: ProviderId): Promise<void> {
    const label = await this.promptInput('Key label', 'default');
    const keyRef = await this.promptInput('Key reference (env var or path)', '');
    const priority = await this.promptInput('Priority (lower = higher)', '10');

    if (!keyRef) {
      console.log(chalk.red('  Key reference is required'));
      return;
    }

    const key: ApiKeyConfig = {
      id: generateId('key'),
      label: label || 'default',
      priority: parseInt(priority, 10) || 10,
      enabled: true,
      usageCount: 0,
      keyRef,
    };

    const result = this.store.addKey(providerId, key);
    if (result.success) {
      console.log(chalk.green('  Key added!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async editKeyInteractive(provider: ProviderConfig): Promise<void> {
    if (provider.keys.length === 0) return;

    for (let i = 0; i < provider.keys.length; i++) {
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${provider.keys[i].label}`);
    }

    const idx = await this.promptInput('Select key to edit');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > provider.keys.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const key = provider.keys[num - 1];
    const label = await this.promptInput('New label', key.label);
    const priority = await this.promptInput('New priority', String(key.priority));
    const keyRef = await this.promptInput('New key reference', key.keyRef);

    const result = this.store.updateKey(provider.provider, key.id, {
      label: label || key.label,
      priority: parseInt(priority, 10) || key.priority,
      keyRef: keyRef || key.keyRef,
    });

    if (result.success) {
      console.log(chalk.green('  Key updated!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async deleteKeyInteractive(provider: ProviderConfig): Promise<void> {
    if (provider.keys.length === 0) return;

    for (let i = 0; i < provider.keys.length; i++) {
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${provider.keys[i].label}`);
    }

    const idx = await this.promptInput('Select key to delete');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > provider.keys.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const key = provider.keys[num - 1];
    const confirm = await this.promptConfirm(`Delete key "${key.label}"?`, false);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled'));
      return;
    }

    const result = this.store.removeKey(provider.provider, key.id);
    if (result.success) {
      console.log(chalk.green('  Key deleted!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async toggleKeyInteractive(provider: ProviderConfig): Promise<void> {
    if (provider.keys.length === 0) return;

    for (let i = 0; i < provider.keys.length; i++) {
      const status = provider.keys[i].enabled ? chalk.green('active') : chalk.red('inactive');
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${provider.keys[i].label} [${status}]`);
    }

    const idx = await this.promptInput('Select key to toggle');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > provider.keys.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const key = provider.keys[num - 1];
    const result = this.store.updateKey(provider.provider, key.id, { enabled: !key.enabled });
    if (result.success) {
      console.log(chalk.green(`  Key ${key.enabled ? 'disabled' : 'enabled'}!`));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  // ── Manage Models ──────────────────────────────────────────────

  private async manageModels(): Promise<void> {
    header('Manage Models');

    const models = this.store.getModels();
    if (models.length > 0) {
      console.log(chalk.bold('\n  Configured Models:'));
      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const status = m.enabled ? chalk.green('enabled') : chalk.red('disabled');
        console.log(
          `    ${chalk.cyan(`${i + 1}.`)} ${m.id} ${chalk.dim(`[${m.modelId}] → ${m.provider}`)} [${status}]`
        );
      }
    }

    console.log(`\n  ${chalk.cyan('a.')} Add Model`);
    if (models.length > 0) {
      console.log(`  ${chalk.cyan('e.')} Edit Model`);
      console.log(`  ${chalk.cyan('d.')} Delete Model`);
      console.log(`  ${chalk.cyan('t.')} Toggle Model`);
    }
    console.log(`  ${chalk.cyan('b.')} Back`);

    const choice = await this.promptInput('Select action');

    switch (choice) {
      case 'a':
        await this.addModelInteractive();
        break;
      case 'e':
        await this.editModelInteractive();
        break;
      case 'd':
        await this.deleteModelInteractive();
        break;
      case 't':
        await this.toggleModelInteractive();
        break;
      case 'b':
        return;
      default:
        console.log(chalk.yellow('  Invalid option'));
    }
  }

  private async addModelInteractive(): Promise<void> {
    header('Add Model');

    const providers = this.store.getEnabledProviders();
    if (providers.length === 0) {
      console.log(chalk.yellow('  No enabled providers. Add and enable a provider first.'));
      await this.promptInput('\nPress Enter to continue');
      return;
    }

    // Select provider
    for (let i = 0; i < providers.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${providers[i].provider} ${chalk.dim(`(${providers[i].label})`)}`
      );
    }

    const provIdx = await this.promptInput('Select provider');
    const provNum = parseInt(provIdx, 10);
    if (isNaN(provNum) || provNum < 1 || provNum > providers.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const provider = providers[provNum - 1];
    const providerModels = MODEL_DEFINITIONS.filter(m => m.provider === provider.provider);

    if (providerModels.length === 0) {
      console.log(chalk.yellow(`  No model definitions available for ${provider.provider}`));
      return;
    }

    // Select model definition
    console.log(chalk.bold(`\n  Available models for ${provider.provider}:`));
    for (let i = 0; i < providerModels.length; i++) {
      const m = providerModels[i];
      const capabilities = m.capabilities.join(', ');
      console.log(`    ${chalk.cyan(`${i + 1}.`)} ${m.name} ${chalk.dim(`[${m.id}]`)}`);
      console.log(`       ${chalk.dim(m.description)}`);
      console.log(
        `       ${chalk.dim(`capabilities: ${capabilities}, max output: ${m.maxOutputTokens} tokens`)}`
      );
    }

    const modelIdx = await this.promptInput('Select model');
    const modelNum = parseInt(modelIdx, 10);
    if (isNaN(modelNum) || modelNum < 1 || modelNum > providerModels.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const modelDef = providerModels[modelNum - 1];
    const label = await this.promptInput('Model label', modelDef.name);

    // Select preset
    const presets = this.store.getPresets();
    if (presets.length > 0) {
      console.log(chalk.bold('\n  Available presets:'));
      for (let i = 0; i < presets.length; i++) {
        console.log(
          `    ${chalk.cyan(`${i + 1}.`)} ${presets[i].name} ${chalk.dim(`[${presets[i].id}]`)} - ${presets[i].description}`
        );
      }
      console.log(`    ${chalk.cyan('0.')} None`);
    }

    const presetIdx = await this.promptInput('Select default preset (0 for none)');
    const presetNum = parseInt(presetIdx, 10);
    let defaultPreset: string | undefined;
    if (!isNaN(presetNum) && presetNum > 0 && presetNum <= presets.length) {
      defaultPreset = presets[presetNum - 1].id;
    }

    const config: ModelConfig = {
      id: generateId('model'),
      modelId: modelDef.id,
      label: label || modelDef.name,
      provider: provider.provider,
      enabled: true,
      parameters: {},
      defaultPreset,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = this.store.addModel(config);
    if (result.success) {
      console.log(chalk.green(`\n  Model "${config.id}" added!`));
    } else {
      console.log(chalk.red(`\n  Failed: ${result.error}`));
    }

    await this.promptInput('\nPress Enter to continue');
  }

  private async editModelInteractive(): Promise<void> {
    const models = this.store.getModels();
    if (models.length === 0) {
      console.log(chalk.dim('  No models to edit'));
      return;
    }

    for (let i = 0; i < models.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${models[i].id} ${chalk.dim(`[${models[i].modelId}]`)}`
      );
    }

    const idx = await this.promptInput('Select model to edit');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > models.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const model = models[num - 1];
    const label = await this.promptInput('New label', model.label);
    const enabled = await this.promptConfirm('Enabled', model.enabled);

    // Edit parameters
    console.log(chalk.bold('\n  Edit Parameters (leave empty to keep current):'));
    const tempStr = await this.promptInput(
      `Temperature (${model.parameters.temperature ?? 'default'})`,
      ''
    );
    const topPStr = await this.promptInput(`Top P (${model.parameters.topP ?? 'default'})`, '');
    const maxTokensStr = await this.promptInput(
      `Max Tokens (${model.parameters.maxTokens ?? 'default'})`,
      ''
    );

    const updates: Partial<ModelConfig> = {
      label: label || model.label,
      enabled,
      parameters: { ...model.parameters },
    };

    if (tempStr) updates.parameters!.temperature = parseFloat(tempStr);
    if (topPStr) updates.parameters!.topP = parseFloat(topPStr);
    if (maxTokensStr) updates.parameters!.maxTokens = parseInt(maxTokensStr, 10);

    const result = this.store.updateModel(model.id, updates);
    if (result.success) {
      console.log(chalk.green('  Model updated!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async deleteModelInteractive(): Promise<void> {
    const models = this.store.getModels();
    if (models.length === 0) {
      console.log(chalk.dim('  No models to delete'));
      return;
    }

    for (let i = 0; i < models.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${models[i].id} ${chalk.dim(`[${models[i].modelId}]`)}`
      );
    }

    const idx = await this.promptInput('Select model to delete');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > models.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const model = models[num - 1];
    const confirm = await this.promptConfirm(`Delete model "${model.id}"?`, false);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled'));
      return;
    }

    const result = this.store.removeModel(model.id);
    if (result.success) {
      console.log(chalk.green('  Model deleted!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async toggleModelInteractive(): Promise<void> {
    const models = this.store.getModels();
    if (models.length === 0) {
      console.log(chalk.dim('  No models to toggle'));
      return;
    }

    for (let i = 0; i < models.length; i++) {
      const status = models[i].enabled ? chalk.green('enabled') : chalk.red('disabled');
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${models[i].id} ${chalk.dim(`[${models[i].modelId}]`)} [${status}]`
      );
    }

    const idx = await this.promptInput('Select model to toggle');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > models.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const model = models[num - 1];
    const result = this.store.updateModel(model.id, { enabled: !model.enabled });
    if (result.success) {
      console.log(chalk.green(`  Model ${model.enabled ? 'disabled' : 'enabled'}!`));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  // ── Manage Presets ─────────────────────────────────────────────

  private async managePresets(): Promise<void> {
    header('Manage Presets');

    const presets = this.store.getPresets();
    console.log(chalk.bold('\n  Presets:'));
    for (let i = 0; i < presets.length; i++) {
      const p = presets[i];
      const tag = p.builtIn ? chalk.dim('[built-in]') : chalk.yellow('[custom]');
      console.log(`    ${chalk.cyan(`${i + 1}.`)} ${p.name} ${tag} - ${p.description}`);
      const params = Object.entries(p.parameters)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      if (params) {
        console.log(`       ${chalk.dim(params)}`);
      }
    }

    console.log(`\n  ${chalk.cyan('a.')} Create Custom Preset`);
    console.log(`  ${chalk.cyan('c.')} Clone Preset`);
    const userPresets = presets.filter(p => !p.builtIn);
    if (userPresets.length > 0) {
      console.log(`  ${chalk.cyan('d.')} Delete Custom Preset`);
    }
    console.log(`  ${chalk.cyan('b.')} Back`);

    const choice = await this.promptInput('Select action');

    switch (choice) {
      case 'a':
        await this.createPresetInteractive();
        break;
      case 'c':
        await this.clonePresetInteractive();
        break;
      case 'd':
        await this.deletePresetInteractive();
        break;
      case 'b':
        return;
      default:
        console.log(chalk.yellow('  Invalid option'));
    }
  }

  private async createPresetInteractive(): Promise<void> {
    header('Create Custom Preset');

    const name = await this.promptInput('Preset name');
    if (!name) {
      console.log(chalk.red('  Name is required'));
      return;
    }

    const desc = await this.promptInput('Description', '');
    const id = await this.promptInput('Preset ID', name.toLowerCase().replace(/\s+/g, '-'));

    console.log(chalk.bold('\n  Parameter values (leave empty for default):'));
    const tempStr = await this.promptInput('Temperature (0-2)', '');
    const topPStr = await this.promptInput('Top P (0-1)', '');
    const presencePenaltyStr = await this.promptInput('Presence Penalty (-2 to 2)', '');
    const frequencyPenaltyStr = await this.promptInput('Frequency Penalty (-2 to 2)', '');
    const maxTokensStr = await this.promptInput('Max Tokens', '');

    const parameters: ModelParameters = {};
    if (tempStr) parameters.temperature = parseFloat(tempStr);
    if (topPStr) parameters.topP = parseFloat(topPStr);
    if (presencePenaltyStr) parameters.presencePenalty = parseFloat(presencePenaltyStr);
    if (frequencyPenaltyStr) parameters.frequencyPenalty = parseFloat(frequencyPenaltyStr);
    if (maxTokensStr) parameters.maxTokens = parseInt(maxTokensStr, 10);

    const preset: PresetDefinition = {
      id: id || name.toLowerCase().replace(/\s+/g, '-'),
      name,
      category: 'custom',
      description: desc || name,
      parameters,
      builtIn: false,
    };

    const result = this.store.addPreset(preset);
    if (result.success) {
      console.log(chalk.green('  Preset created!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async clonePresetInteractive(): Promise<void> {
    const presets = this.store.getPresets();
    for (let i = 0; i < presets.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${presets[i].name} ${chalk.dim(`[${presets[i].id}]`)}`
      );
    }

    const idx = await this.promptInput('Select preset to clone');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > presets.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const source = presets[num - 1];
    const newName = await this.promptInput('New preset name', `${source.name} (Copy)`);
    const newId = await this.promptInput('New preset ID', `${source.id}-copy`);

    const result = this.service.clonePreset(source.id, newId, newName || `${source.name} (Copy)`);
    if (result.success) {
      console.log(chalk.green('  Preset cloned!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  private async deletePresetInteractive(): Promise<void> {
    const userPresets = this.store.getPresets().filter(p => !p.builtIn);
    if (userPresets.length === 0) {
      console.log(chalk.dim('  No custom presets to delete'));
      return;
    }

    for (let i = 0; i < userPresets.length; i++) {
      console.log(
        `  ${chalk.cyan(`${i + 1}.`)} ${userPresets[i].name} ${chalk.dim(`[${userPresets[i].id}]`)}`
      );
    }

    const idx = await this.promptInput('Select preset to delete');
    const num = parseInt(idx, 10);
    if (isNaN(num) || num < 1 || num > userPresets.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const preset = userPresets[num - 1];
    const confirm = await this.promptConfirm(`Delete preset "${preset.name}"?`, false);
    if (!confirm) {
      console.log(chalk.dim('  Cancelled'));
      return;
    }

    const result = this.store.removePreset(preset.id);
    if (result.success) {
      console.log(chalk.green('  Preset deleted!'));
    } else {
      console.log(chalk.red(`  Failed: ${result.error}`));
    }
  }

  // ── Global Settings ────────────────────────────────────────────

  private async manageSettings(): Promise<void> {
    header('Global Settings');

    const settings = this.store.getSettings();
    field('1. Default Provider', settings.defaultProvider ?? chalk.dim('none'));
    field('2. Default Model', settings.defaultModel ?? chalk.dim('none'));
    field('3. Default Preset', settings.defaultPreset ?? chalk.dim('none'));
    field('4. Max Retries', String(settings.maxRetries));
    field('5. Request Timeout', `${settings.requestTimeout}ms`);
    field('6. Auto Key Rotation', fmtBool(settings.autoKeyRotation));
    field('7. Auto Model Fallback', fmtBool(settings.autoModelFallback));
    field('8. Log Level', settings.logLevel);

    console.log(`\n  ${chalk.dim('Enter number to edit, or b to go back')}`);
    const choice = await this.promptInput('Select setting to edit');

    switch (choice) {
      case '1': {
        const providers = this.store.getProviders();
        if (providers.length > 0) {
          for (let i = 0; i < providers.length; i++) {
            console.log(`  ${chalk.cyan(`${i + 1}.`)} ${providers[i].provider}`);
          }
          const idx = await this.promptInput('Select default provider (0 to clear)');
          const num = parseInt(idx, 10);
          if (num === 0) {
            this.store.updateSettings({ defaultProvider: undefined });
          } else if (num > 0 && num <= providers.length) {
            this.store.updateSettings({ defaultProvider: providers[num - 1].provider });
          }
        } else {
          console.log(chalk.dim('  No providers configured'));
        }
        break;
      }
      case '2': {
        const models = this.store.getModels();
        if (models.length > 0) {
          for (let i = 0; i < models.length; i++) {
            console.log(`  ${chalk.cyan(`${i + 1}.`)} ${models[i].id}`);
          }
          const idx = await this.promptInput('Select default model (0 to clear)');
          const num = parseInt(idx, 10);
          if (num === 0) {
            this.store.updateSettings({ defaultModel: undefined });
          } else if (num > 0 && num <= models.length) {
            this.store.updateSettings({ defaultModel: models[num - 1].id });
          }
        } else {
          console.log(chalk.dim('  No models configured'));
        }
        break;
      }
      case '3': {
        const presets = this.store.getPresets();
        for (let i = 0; i < presets.length; i++) {
          console.log(`  ${chalk.cyan(`${i + 1}.`)} ${presets[i].id}`);
        }
        const idx = await this.promptInput('Select default preset (0 to clear)');
        const num = parseInt(idx, 10);
        if (num === 0) {
          this.store.updateSettings({ defaultPreset: undefined });
        } else if (num > 0 && num <= presets.length) {
          this.store.updateSettings({ defaultPreset: presets[num - 1].id });
        }
        break;
      }
      case '4': {
        const val = await this.promptInput('Max retries (1-10)', String(settings.maxRetries));
        const num = parseInt(val, 10);
        if (num >= 1 && num <= 10) {
          this.store.updateSettings({ maxRetries: num });
          console.log(chalk.green('  Updated!'));
        }
        break;
      }
      case '5': {
        const val = await this.promptInput(
          'Timeout in ms (1000-300000)',
          String(settings.requestTimeout)
        );
        const num = parseInt(val, 10);
        if (num >= 1000 && num <= 300000) {
          this.store.updateSettings({ requestTimeout: num });
          console.log(chalk.green('  Updated!'));
        }
        break;
      }
      case '6': {
        this.store.updateSettings({ autoKeyRotation: !settings.autoKeyRotation });
        console.log(
          chalk.green(`  Auto key rotation: ${!settings.autoKeyRotation ? 'enabled' : 'disabled'}`)
        );
        break;
      }
      case '7': {
        this.store.updateSettings({ autoModelFallback: !settings.autoModelFallback });
        console.log(
          chalk.green(
            `  Auto model fallback: ${!settings.autoModelFallback ? 'enabled' : 'disabled'}`
          )
        );
        break;
      }
      case '8': {
        const levels = ['debug', 'info', 'warn', 'error'] as const;
        for (let i = 0; i < levels.length; i++) {
          console.log(`  ${chalk.cyan(`${i + 1}.`)} ${levels[i]}`);
        }
        const idx = await this.promptInput('Select log level');
        const num = parseInt(idx, 10);
        if (num >= 1 && num <= 4) {
          this.store.updateSettings({ logLevel: levels[num - 1] });
          console.log(chalk.green('  Updated!'));
        }
        break;
      }
      case 'b':
        return;
      default:
        console.log(chalk.yellow('  Invalid option'));
    }
  }

  // ── Setup Wizard ───────────────────────────────────────────────

  private async setupWizard(): Promise<void> {
    header('Quick Setup Wizard');

    console.log(
      chalk.dim('  This wizard will help you quickly set up a provider and its models.\n')
    );

    // Select provider
    const availableIds = Object.keys(PROVIDER_DEFINITIONS) as ProviderId[];
    for (let i = 0; i < availableIds.length; i++) {
      const def = PROVIDER_DEFINITIONS[availableIds[i]];
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${def.name} ${chalk.dim(`[${def.id}]`)}`);
    }

    const provIdx = await this.promptInput('Select provider');
    const provNum = parseInt(provIdx, 10);
    if (isNaN(provNum) || provNum < 1 || provNum > availableIds.length) {
      console.log(chalk.red('  Invalid selection'));
      return;
    }

    const providerId = availableIds[provNum - 1];
    const def = PROVIDER_DEFINITIONS[providerId];

    const keyLabel = await this.promptInput('API key label', 'default');
    const keyRef = await this.promptInput('API key reference (env var name or path)', '');
    const providerLabel = await this.promptInput('Provider label', def.name);

    if (!keyRef) {
      console.log(chalk.yellow('  No API key provided. Setup may fail at runtime.'));
    }

    const result = this.service.setupProviderWithModels(providerId, keyLabel, keyRef, {
      providerLabel: providerLabel || def.name,
    });

    if (result.provider.success) {
      console.log(chalk.green(`\n  Provider "${providerId}" set up successfully!`));
      const addedModels = result.models.filter(m => m.success);
      const failedModels = result.models.filter(m => !m.success);
      console.log(`  Models: ${addedModels.length} added, ${failedModels.length} failed`);
      if (failedModels.length > 0) {
        for (const m of failedModels) {
          console.log(chalk.red(`    - ${m.error}`));
        }
      }
    } else {
      console.log(chalk.red(`\n  Failed: ${result.provider.error}`));
    }

    await this.promptInput('\nPress Enter to continue');
  }

  // ── Validation ─────────────────────────────────────────────────

  private async runValidation(): Promise<void> {
    header('Validation & Integrity Check');

    const integrity = this.store.checkIntegrity();
    const validation = this.service.validateAll();

    console.log(chalk.bold('\n  Integrity:'));
    if (integrity.valid) {
      console.log(chalk.green('    All integrity checks passed!'));
    } else {
      console.log(chalk.red(`    ${integrity.errors.length} integrity error(s) found:`));
      for (const err of integrity.errors) {
        console.log(chalk.red(`      [${err.entityType}] ${err.entityId}: ${err.message}`));
      }
    }

    console.log(chalk.bold('\n  Warnings:'));
    if (validation.modelsWithoutProvider.length > 0) {
      console.log(
        chalk.yellow(
          `    ${validation.modelsWithoutProvider.length} model(s) without configured provider`
        )
      );
    }
    if (validation.providersWithoutKeys.length > 0) {
      console.log(
        chalk.yellow(`    ${validation.providersWithoutKeys.length} provider(s) without API keys`)
      );
    }
    if (validation.providersWithoutModels.length > 0) {
      console.log(
        chalk.yellow(
          `    ${validation.providersWithoutModels.length} provider(s) without configured models`
        )
      );
    }
    if (
      validation.modelsWithoutProvider.length === 0 &&
      validation.providersWithoutKeys.length === 0 &&
      validation.providersWithoutModels.length === 0
    ) {
      console.log(chalk.green('    No warnings!'));
    }

    await this.promptInput('\nPress Enter to continue');
  }

  // ── Export ─────────────────────────────────────────────────────

  private exportConfig(): void {
    header('Export Configuration');
    const json = this.store.serialize();
    console.log(chalk.dim('\n  JSON:'));
    console.log(json);
    console.log();
  }

  // ── Input Helpers ──────────────────────────────────────────────

  private async promptInput(message: string, defaultValue: string = ''): Promise<string> {
    const prompt = defaultValue
      ? `${chalk.cyan('?')} ${message} ${chalk.dim(`[${defaultValue}]`)}: `
      : `${chalk.cyan('?')} ${message}: `;

    return new Promise(resolve => {
      const readline = require('node:readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      readline.question(prompt, (answer: string) => {
        readline.close();
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  private async promptConfirm(message: string, defaultValue: boolean): Promise<boolean> {
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    const answer = await this.promptInput(message + suffix);
    const normalized = answer.toLowerCase();
    if (normalized === '') return defaultValue;
    if (normalized === 'y' || normalized === 'yes') return true;
    if (normalized === 'n' || normalized === 'no') return false;
    return defaultValue;
  }
}
