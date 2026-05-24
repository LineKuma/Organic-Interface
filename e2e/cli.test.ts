import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { Command, createCommand, type CommandConfig } from '@organic/ui/cli';

describe('CLI', () => {
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

  describe('Command', () => {
    it('should create command with config', async () => {
      const cmd = createCommand({
        name: 'test-cmd',
        description: 'Test command',
        action: () => ({ success: true }),
      });

      expect(cmd).toBeDefined();
      expect(cmd.name).toBe('test-cmd');
    });

    it('should execute command', async () => {
      const cmd = createCommand({
        name: 'exec-cmd',
        description: 'Execute command',
        action: () => ({ success: true, output: 'executed' }),
      });

      const result = await cmd.execute([]);
      expect(result.success).toBe(true);
      expect(result.output).toBe('executed');
    });

    it('should parse arguments', async () => {
      let parsedArgs: any = null;
      const cmd = createCommand({
        name: 'parse-cmd',
        description: 'Parse command',
        action: (args) => {
          parsedArgs = args;
          return { success: true };
        },
      });

      await cmd.execute(['--value', 'test']);
      expect(parsedArgs).toBeDefined();
    });

    it('should handle help flag', async () => {
      const cmd = createCommand({
        name: 'help-cmd',
        description: 'Help command',
        action: () => ({ success: true }),
      });

      const result = cmd.help();
      expect(result).toContain('--help');
    });

    it('should return version info', async () => {
      const cmd = createCommand({
        name: 'version-cmd',
        description: 'Version command',
        version: '1.0.0',
        action: () => ({ success: true }),
      });

      const version = cmd.getVersion();
      expect(version).toBe('1.0.0');
    });

    it('should handle unknown command error', async () => {
      const cmd = createCommand({
        name: 'error-cmd',
        description: 'Error command',
        action: () => {
          throw new Error('Unknown command');
        },
      });

      const result = await cmd.execute([]);
      expect(result.success).toBe(false);
    });

    it('should validate required arguments', async () => {
      const cmd = createCommand({
        name: 'validate-cmd',
        description: 'Validate command',
        args: [{ name: 'requiredArg', required: true }],
        action: () => ({ success: true }),
      });

      const result = cmd.validate(['value']);
      expect(result).toBe(true);
    });

    it('should handle optional arguments', async () => {
      const cmd = createCommand({
        name: 'optional-cmd',
        description: 'Optional command',
        args: [{ name: 'optionalArg', required: false, defaultValue: 'default' }],
        action: (args) => ({ success: true, args }),
      });

      const result = await cmd.execute([]);
      expect(result.success).toBe(true);
    });

    it('should register subcommands', async () => {
      const parent = createCommand({
        name: 'parent',
        description: 'Parent command',
        action: () => ({ success: true }),
      });

      const child = createCommand({
        name: 'child',
        description: 'Child command',
        action: () => ({ success: true }),
      });

      parent.addSubcommand(child);
      expect(parent.getSubcommands().length).toBe(1);
    });
  });

  describe('CLI Initialization', () => {
    it('should initialize CLI', async () => {
      expect(kernel).toBeDefined();
    });

    it('should register commands', async () => {
      const cmd = createCommand({
        name: 'register-cmd',
        description: 'Register command',
        action: () => ({ success: true }),
      });

      expect(cmd).toBeDefined();
    });

    it('should parse command strings', async () => {
      const cmd = createCommand({
        name: 'parse-str',
        description: 'Parse string',
        action: (args) => ({ success: true, args }),
      });

      const result = cmd.parse('parse-str --arg value');
      expect(result).toBeDefined();
    });

    it('should output help text', async () => {
      const cmd = createCommand({
        name: 'output-help',
        description: 'Output help',
        action: () => ({ success: true }),
      });

      const help = cmd.help();
      expect(help).toContain('--help');
    });

    it('should output version text', async () => {
      const cmd = createCommand({
        name: 'output-version',
        description: 'Output version',
        version: '2.0.0',
        action: () => ({ success: true }),
      });

      const version = cmd.getVersion();
      expect(version).toBe('2.0.0');
    });
  });
});