/**
 * Config Commands - Lightweight helper for configuration access
 *
 * Handles:
 *   oi config get <key>     - Get a configuration value
 *   oi config list          - List all configuration values
 *
 * All commands are pure proxies: they forward requests to the host via IPC.
 */

import chalk from 'chalk';

import type { IpcRequest, ConfigListResponse } from '../../types/ipc.js';
import { sendIpcRequest } from '../IpcClient.js';
import type { CommandContext } from './HistoryCommands.js';

function reqId(): string {
  return `cfg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Get a configuration value
 *
 * Usage: oi config get <key>
 */
export async function configGet(args: string[], ctx: CommandContext): Promise<void> {
  const key = args[0];

  if (!key) {
    console.error(chalk.red('Error: key argument required'));
    console.error(chalk.dim('Usage: oi config get <key>'));
    process.exit(1);
  }

  const request: IpcRequest = {
    id: reqId(),
    method: 'config.get',
    executor: {
      pid: process.pid,
      aiTerminal: true,
      conversationId: ctx.conversationId,
    },
    params: { key },
  };

  const response = await sendIpcRequest(request, ctx.socketPath);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as { key: string; value: unknown };
  console.log(`${chalk.cyan(data.key)}: ${chalk.bold(JSON.stringify(data.value))}`);
}

/**
 * List all configuration values
 *
 * Usage: oi config list
 */
export async function configList(_args: string[], ctx: CommandContext): Promise<void> {
  const request: IpcRequest = {
    id: reqId(),
    method: 'config.list',
    executor: {
      pid: process.pid,
      aiTerminal: true,
      conversationId: ctx.conversationId,
    },
    params: {},
  };

  const response = await sendIpcRequest(request, ctx.socketPath);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as ConfigListResponse;
  if (!data || data.items.length === 0) {
    console.log(chalk.dim('No configuration values available.'));
    return;
  }

  console.log(chalk.bold('\nConfiguration:'));
  console.log(chalk.dim('─'.repeat(50)));

  for (const item of data.items) {
    const desc = item.description ? chalk.dim(`  # ${item.description}`) : '';
    console.log(`  ${chalk.cyan(item.key)}: ${chalk.bold(JSON.stringify(item.value))}${desc}`);
  }
  console.log();
}
