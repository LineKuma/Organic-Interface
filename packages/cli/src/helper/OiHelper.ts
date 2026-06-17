/**
 * OiHelper - Lightweight CLI helper for AI terminal use
 *
 * This is the main entry point for the `oi` command when
 * invoked by an AI agent. It routes commands to the appropriate
 * handlers, which communicate with the host process via IPC.
 *
 * The helper is intentionally lightweight:
 * - No database access
 * - No conversation state
 * - No heavy dependencies
 * - All data comes from the host via IPC
 *
 * Environment variables:
 *   OI_AI_TERMINAL=true     - Must be set by AI tool
 *   OI_CONVERSATION_ID=xxx  - Current conversation context
 *
 * Commands:
 *   oi history ls            - List conversation contexts
 *   oi history show [id]     - Show messages in a context
 *   oi history count [id]    - Count messages in a context
 *   oi macro resolve <text>  - Resolve macro expressions
 *   oi macro preview <text>  - Preview macro expressions
 *   oi config get <key>      - Get configuration value
 *   oi config list           - List all configuration
 *   oi ping                  - Check host connectivity
 *   oi health                - Show health status
 *   oi help                  - Show help
 */

import chalk from 'chalk';

import { isAiTerminal, getConversationId } from '../types/ipc.js';
import { pingHost } from './IpcClient.js';
import { historyList, historyShow, historyCount } from './commands/HistoryCommands.js';
import { macroResolve, macroPreview } from './commands/MacroCommands.js';
import { configGet, configList } from './commands/ConfigCommands.js';

/** Command handler type */
type CommandHandler = (args: string[]) => Promise<void>;

/** Command definition */
interface CommandDef {
  handler: CommandHandler;
  description: string;
  usage: string;
  requiresAiTerminal: boolean;
}

/**
 * OI Helper CLI
 */
export class OiHelper {
  private commands: Map<string, CommandDef> = new Map();

  constructor() {
    this.registerCommands();
  }

  /** Register all available commands */
  private registerCommands(): void {
    // History commands
    this.cmd('history ls', historyList, 'List conversation contexts', 'oi history ls', true);
    this.cmd(
      'history show',
      historyShow,
      'Show messages in a context',
      'oi history show [contextId] [--last N] [--first N]',
      true
    );
    this.cmd(
      'history count',
      historyCount,
      'Count messages in a context',
      'oi history count [contextId]',
      true
    );

    // Macro commands
    this.cmd(
      'macro resolve',
      macroResolve,
      'Resolve macro expressions in text',
      'oi macro resolve <text>',
      true
    );
    this.cmd(
      'macro preview',
      macroPreview,
      'Preview macro expressions',
      'oi macro preview <text>',
      true
    );

    // Config commands
    this.cmd('config get', configGet, 'Get a configuration value', 'oi config get <key>', true);
    this.cmd('config list', configList, 'List all configuration values', 'oi config list', true);
  }

  /** Register a command */
  private cmd(
    name: string,
    handler: CommandHandler,
    description: string,
    usage: string,
    requiresAiTerminal: boolean
  ): void {
    this.commands.set(name, { handler, description, usage, requiresAiTerminal });
  }

  /** Run the CLI with the given arguments */
  async run(argv: string[]): Promise<void> {
    // No arguments: show help
    if (argv.length === 0) {
      this.showHelp();
      return;
    }

    // Help command
    if (argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
      this.showHelp();
      return;
    }

    // Ping command
    if (argv[0] === 'ping') {
      await this.handlePing();
      return;
    }

    // Health command
    if (argv[0] === 'health') {
      await this.handleHealth();
      return;
    }

    // Try to match a command
    const cmdName = argv.slice(0, 2).join(' ');
    const cmd = this.commands.get(cmdName);

    if (!cmd) {
      // Try single-word command
      const singleCmd = this.commands.get(argv[0]);
      if (!singleCmd) {
        console.error(chalk.red(`Unknown command: ${argv.join(' ')}`));
        console.error(chalk.dim('Run "oi help" for available commands.'));
        process.exit(1);
      }

      if (singleCmd.requiresAiTerminal && !isAiTerminal()) {
        this.showAiTerminalRequired();
        return;
      }

      await singleCmd.handler(argv.slice(1));
      return;
    }

    // Check AI terminal requirement
    if (cmd.requiresAiTerminal && !isAiTerminal()) {
      this.showAiTerminalRequired();
      return;
    }

    await cmd.handler(argv.slice(2));
  }

  /** Show help text */
  private showHelp(): void {
    console.log(chalk.bold.cyan('\n  Organic Interface CLI'));
    console.log(chalk.dim('  Lightweight helper for AI terminal interaction\n'));

    const aiTerminal = isAiTerminal();
    const conversationId = getConversationId();

    console.log(
      `  ${chalk.dim('AI Terminal:')} ${aiTerminal ? chalk.green('yes') : chalk.yellow('no')}`
    );
    if (conversationId) {
      console.log(`  ${chalk.dim('Context:')}     ${chalk.cyan(conversationId)}`);
    }
    console.log();

    console.log(chalk.bold('  Commands:'));
    console.log();

    // Group commands by category
    const categories: Record<string, CommandDef[]> = {};

    for (const [name, cmd] of this.commands) {
      const category = name.split(' ')[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ ...cmd, ...{ handler: cmd.handler } });
    }

    for (const [category, cmds] of Object.entries(categories)) {
      console.log(chalk.bold(`  ${category}:`));
      for (const cmd of cmds) {
        const tag = cmd.requiresAiTerminal ? chalk.dim(' [ai-only]') : '';
        console.log(`    ${chalk.cyan(cmd.usage)}${tag}`);
        console.log(`      ${chalk.dim(cmd.description)}`);
      }
      console.log();
    }

    console.log(`  ${chalk.bold('utility:')}`);
    console.log(`    ${chalk.cyan('oi help')}            ${chalk.dim('Show this help')}`);
    console.log(`    ${chalk.cyan('oi ping')}            ${chalk.dim('Check host connectivity')}`);
    console.log(`    ${chalk.cyan('oi health')}          ${chalk.dim('Show health status')}`);
    console.log();
  }

  /** Show AI terminal required message */
  private showAiTerminalRequired(): void {
    console.log(chalk.yellow('This command requires AI terminal context.'));
    console.log(
      chalk.dim('Set OI_AI_TERMINAL=true and OI_CONVERSATION_ID=xxx to use this command.')
    );
    console.log(
      chalk.dim('\nThis is a security measure to prevent unauthorized access to conversation data.')
    );
  }

  /** Handle ping command */
  private async handlePing(): Promise<void> {
    console.log(chalk.dim('Pinging host...'));
    const reachable = await pingHost();
    if (reachable) {
      console.log(chalk.green('Host is reachable.'));
    } else {
      console.log(chalk.red('Host is not reachable.'));
      console.log(chalk.dim('Make sure the OI host process is running with an IPC server.'));
    }
  }

  /** Handle health command */
  private async handleHealth(): Promise<void> {
    const aiTerminal = isAiTerminal();
    const conversationId = getConversationId();

    console.log(chalk.bold('\n  Health Status:'));
    console.log(chalk.dim('  ─'.repeat(40)));

    // AI Terminal status
    console.log(
      `  AI Terminal:   ${aiTerminal ? chalk.green('enabled') : chalk.yellow('disabled')}`
    );
    console.log(
      `  Context ID:    ${conversationId ? chalk.cyan(conversationId) : chalk.dim('not set')}`
    );

    // Host connectivity
    const reachable = await pingHost();
    console.log(
      `  Host:          ${reachable ? chalk.green('connected') : chalk.red('unreachable')}`
    );

    console.log();
  }
}
