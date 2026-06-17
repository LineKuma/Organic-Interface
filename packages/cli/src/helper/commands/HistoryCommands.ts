/**
 * History Commands - Lightweight helper for conversation history
 *
 * Handles:
 *   oi history ls       - List all conversation contexts
 *   oi history show     - Show messages in a context (default: current)
 *   oi history count    - Count messages in a context
 */

import chalk from 'chalk';

import type { IpcRequest, HistoryListResponse, HistoryGetResponse } from '../../types/ipc.js';
import { sendIpcRequest } from '../IpcClient.js';
import { getConversationId } from '../../types/ipc.js';

/** Generate a unique request ID */
function reqId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * List all conversation contexts
 *
 * Usage: oi history ls
 */
export async function historyList(_args: string[]): Promise<void> {
  const request: IpcRequest = {
    id: reqId(),
    method: 'history.list',
    conversationId: getConversationId(),
    aiTerminal: true,
  };

  const response = await sendIpcRequest(request);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as HistoryListResponse;
  if (!data || data.contexts.length === 0) {
    console.log(chalk.dim('No conversation contexts available.'));
    return;
  }

  console.log(chalk.bold('\nConversation Contexts:'));
  console.log(chalk.dim('─'.repeat(70)));

  for (const ctx of data.contexts) {
    const isCurrent = ctx.contextId === data.currentContextId;
    const marker = isCurrent ? chalk.green('▶') : ' ';
    const name = isCurrent ? chalk.green(ctx.contextId) : ctx.contextId;
    const count = chalk.cyan(`${ctx.messageCount} msgs`);

    let timeStr = '';
    if (ctx.firstMessageAt) {
      timeStr = chalk.dim(`  ${new Date(ctx.firstMessageAt).toLocaleString()}`);
    }

    console.log(`${marker} ${name}  ${count}${timeStr}`);
  }

  if (data.currentContextId) {
    console.log(chalk.dim('\n  ▶ = current context'));
  }
  console.log();
}

/**
 * Show messages in a conversation context
 *
 * Usage: oi history show [contextId] [--last N] [--first N]
 */
export async function historyShow(args: string[]): Promise<void> {
  let contextId: string | undefined;
  let lastN: number | undefined;
  let firstN: number | undefined;

  // Parse args
  let i = 0;
  while (i < args.length) {
    switch (args[i]) {
      case '--last':
        lastN = parseInt(args[++i], 10);
        break;
      case '--first':
        firstN = parseInt(args[++i], 10);
        break;
      default:
        if (!contextId && !args[i].startsWith('--')) {
          contextId = args[i];
        }
        break;
    }
    i++;
  }

  const request: IpcRequest = {
    id: reqId(),
    method: 'history.get',
    conversationId: getConversationId(),
    aiTerminal: true,
    params: {
      contextId: contextId ?? 'current',
      lastN,
      firstN,
    },
  };

  const response = await sendIpcRequest(request);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as HistoryGetResponse;
  if (!data || data.messages.length === 0) {
    console.log(chalk.dim('No messages in this context.'));
    return;
  }

  console.log(
    chalk.bold(
      `\nConversation: ${chalk.cyan(data.contextId)}  (${data.totalCount} messages total, showing ${data.messages.length})`
    )
  );
  console.log(chalk.dim('─'.repeat(70)));

  for (const msg of data.messages) {
    const senderColor =
      msg.senderType === 'user'
        ? chalk.blue
        : msg.senderType === 'agent'
          ? chalk.green
          : msg.senderType === 'system'
            ? chalk.yellow
            : chalk.dim;

    const header = `${senderColor(`[${msg.senderName}]`)} ${chalk.dim(`#${msg.index}`)}`;
    console.log(`\n${header}`);

    // Truncate long content
    const content =
      msg.content.length > 500
        ? msg.content.substring(0, 500) + chalk.dim('... (truncated)')
        : msg.content;
    console.log(content);
  }
  console.log();
}

/**
 * Count messages in a conversation context
 *
 * Usage: oi history count [contextId]
 */
export async function historyCount(args: string[]): Promise<void> {
  const contextId = args[0] ?? 'current';

  const request: IpcRequest = {
    id: reqId(),
    method: 'history.count',
    conversationId: getConversationId(),
    aiTerminal: true,
    params: { contextId },
  };

  const response = await sendIpcRequest(request);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as { contextId: string; count: number };
  console.log(`${chalk.cyan(data.contextId)}: ${chalk.bold(data.count)} messages`);
}
