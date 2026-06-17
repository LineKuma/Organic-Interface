/**
 * Macro Commands - Lightweight helper for macro operations
 *
 * Handles:
 *   oi macro resolve <text>        - Resolve macro expressions in text
 *   oi macro preview <text>        - Preview macro expressions without resolution
 */

import chalk from 'chalk';

import type { IpcRequest, MacroResolveResponse, MacroPreviewResponse } from '../../types/ipc.js';
import { sendIpcRequest } from '../IpcClient.js';
import { getConversationId } from '../../types/ipc.js';

function reqId(): string {
  return `macro-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Resolve macro expressions in text
 *
 * Usage: oi macro resolve "text with {{macros}}"
 */
export async function macroResolve(args: string[]): Promise<void> {
  const text = args.join(' ');

  if (!text) {
    console.error(chalk.red('Error: text argument required'));
    console.error(chalk.dim('Usage: oi macro resolve "text with {{macros}}"'));
    process.exit(1);
  }

  const request: IpcRequest = {
    id: reqId(),
    method: 'macro.resolve',
    conversationId: getConversationId(),
    aiTerminal: true,
    params: { text },
  };

  const response = await sendIpcRequest(request);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as MacroResolveResponse;
  console.log(chalk.bold('\nResolved:'));
  console.log(data.resolved);
  console.log(
    chalk.dim(`\n(${data.macroCount} macros resolved, ${data.unresolvedCount} unresolved)`)
  );
}

/**
 * Preview macro expressions in text
 *
 * Usage: oi macro preview "text with {{macros}}"
 */
export async function macroPreview(args: string[]): Promise<void> {
  const text = args.join(' ');

  if (!text) {
    console.error(chalk.red('Error: text argument required'));
    console.error(chalk.dim('Usage: oi macro preview "text with {{macros}}"'));
    process.exit(1);
  }

  const request: IpcRequest = {
    id: reqId(),
    method: 'macro.preview',
    conversationId: getConversationId(),
    aiTerminal: true,
    params: { text },
  };

  const response = await sendIpcRequest(request);

  if (!response.success) {
    console.error(chalk.red(`Error: ${response.error}`));
    process.exit(1);
  }

  const data = response.data as MacroPreviewResponse;
  if (data.macros.length === 0) {
    console.log(chalk.dim('No macro expressions found.'));
    return;
  }

  console.log(chalk.bold(`\n${data.macros.length} macro(s) found:`));
  for (const macro of data.macros) {
    console.log(`  ${chalk.cyan(macro.type)} ${chalk.dim('→')} ${macro.raw}`);
  }
  console.log();
}
