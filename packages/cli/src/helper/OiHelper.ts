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
 * CLI arguments (provided by the AI tool):
 *   --socket /path/to/sock   - Socket path to host IPC server
 *   --ctx conversation_id     - Current conversation context
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

import { parseHelperArgs } from '../types/ipc.js';
import type { CommandContext } from './commands/HistoryCommands.js';
import { pingHost } from './IpcClient.js';
import { historyList, historyShow, historyCount } from './commands/HistoryCommands.js';
import { macroResolve, macroPreview } from './commands/MacroCommands.js';
import { configGet, configList } from './commands/ConfigCommands.js';

/** Command handler type */
type CommandHandler = (args: string[], ctx: CommandContext) => Promise<void>;

/** Command definition */
interface CommandDef {
  handler: CommandHandler;
  description: string;
  usage: string;
}

/**
 * OI Helper CLI - Pure proxy
 *
 * The helper is a thin wrapper that forwards all commands to the
 * host via IPC. It has no direct access to conversation data,
 * configuration, or any other host resources.
 *
 * The AI tool invokes it as:
 *   oi --socket /tmp/oi-ipc-host.sock --ctx conv_123 <command...>
 */
export class OiHelper {
  private commands: Map<string, CommandDef> = new Map();

  constructor() {
    this.registerCommands();
  }

  /** Register all available commands */
  private registerCommands(): void {
    this.cmd('history ls', historyList, 'List conversation contexts', 'oi history ls');
    this.cmd(
      'history show',
      historyShow,
      'Show messages in a context',
      'oi history show [contextId] [--last N] [--first N]'
    );
    this.cmd(
      'history count',
      historyCount,
      'Count messages in a context',
      'oi history count [contextId]'
    );

    this.cmd(
      'macro resolve',
      macroResolve,
      'Resolve macro expressions in text',
      'oi macro resolve <text>'
    );
    this.cmd('macro preview', macroPreview, 'Preview macro expressions', 'oi macro preview <text>');

    this.cmd('config get', configGet, 'Get a configuration value', 'oi config get <key>');
    this.cmd('config list', configList, 'List all configuration values', 'oi config list');
  }

  /** Register a command */
  private cmd(name: string, handler: CommandHandler, description: string, usage: string): void {
    this.commands.set(name, { handler, description, usage });
  }

  /** Run the CLI with the given arguments */
  async run(argv: string[]): Promise<void> {
    // Parse CLI args to extract socket path and context
    const parsed = parseHelperArgs(argv);

    const ctx: CommandContext = {
      socketPath: parsed.socketPath,
      conversationId: parsed.conversationId,
    };

    const command = parsed.command;

    // No arguments: show help
    if (command.length === 0) {
      this.showHelp(ctx);
      return;
    }

    // Help command
    if (command[0] === 'help' || command[0] === '--help' || command[0] === '-h') {
      this.showHelp(ctx);
      return;
    }

    // Ping command
    if (command[0] === 'ping') {
      await this.handlePing(ctx);
      return;
    }

    // Health command
    if (command[0] === 'health') {
      await this.handleHealth(ctx);
      return;
    }

    // Try to match a command
    const cmdName = command.slice(0, 2).join(' ');
    const cmd = this.commands.get(cmdName);

    if (cmd) {
      await cmd.handler(command.slice(2), ctx);
      return;
    }

    // Try single-word command
    const singleCmd = this.commands.get(command[0]);
    if (singleCmd) {
      await singleCmd.handler(command.slice(1), ctx);
      return;
    }

    console.error(chalk.red(`Unknown command: ${command.join(' ')}`));
    console.error(chalk.dim('Run "oi help" for available commands.'));
    process.exit(1);
  }

  /** Show help text */
  private showHelp(ctx: CommandContext): void {
    console.log(chalk.bold.cyan('\n  Organic Interface CLI'));
    console.log(chalk.dim('  Lightweight helper for AI terminal interaction\n'));

    console.log(`  ${chalk.dim('Socket:')}  ${chalk.cyan(ctx.socketPath)}`);
    if (ctx.conversationId) {
      console.log(`  ${chalk.dim('Context:')} ${chalk.cyan(ctx.conversationId)}`);
    }
    console.log();

    console.log(chalk.bold('  Commands:'));
    console.log();

    const categories: Record<string, CommandDef[]> = {};

    for (const [name, cmd] of this.commands) {
      const category = name.split(' ')[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(cmd);
    }

    for (const [category, cmds] of Object.entries(categories)) {
      console.log(chalk.bold(`  ${category}:`));
      for (const cmd of cmds) {
        console.log(`    ${chalk.cyan(cmd.usage)}`);
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

  /** Handle ping command */
  private async handlePing(ctx: CommandContext): Promise<void> {
    console.log(chalk.dim('Pinging host...'));
    const reachable = await pingHost(ctx.socketPath);
    if (reachable) {
      console.log(chalk.green('Host is reachable.'));
    } else {
      console.log(chalk.red('Host is not reachable.'));
      console.log(chalk.dim('Make sure the OI host process is running with an IPC server.'));
    }
  }

  /** Handle health command */
  private async handleHealth(ctx: CommandContext): Promise<void> {
    console.log(chalk.bold('\n  Health Status:'));
    console.log(chalk.dim('  ─'.repeat(40)));

    console.log(`  Socket:    ${chalk.cyan(ctx.socketPath)}`);
    console.log(
      `  Context:   ${ctx.conversationId ? chalk.cyan(ctx.conversationId) : chalk.dim('not set')}`
    );

    const reachable = await pingHost(ctx.socketPath);
    console.log(`  Host:      ${reachable ? chalk.green('connected') : chalk.red('unreachable')}`);

    console.log();
  }
}
