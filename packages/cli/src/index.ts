/**
 * @organic/cli - Organic Interface Command Line Interface
 *
 * Provides the `oi` command-line tool for Organic Interface:
 *
 * - Lightweight helper for AI terminal use (via IPC)
 * - Host-side IPC server for conversation/macro/config access
 * - AI terminal environment variable guard (OI_AI_TERMINAL)
 * - Conversation ID injection (OI_CONVERSATION_ID)
 *
 * Commands (via `oi`):
 *   oi history ls           - List conversation contexts
 *   oi history show [id]    - Show messages in a context
 *   oi history count [id]   - Count messages in a context
 *   oi macro resolve <text> - Resolve macro expressions
 *   oi macro preview <text> - Preview macro expressions
 *   oi config get <key>     - Get configuration value
 *   oi config list          - List all configuration
 *   oi ping                 - Check host connectivity
 *   oi health               - Show health status
 *   oi help                 - Show help
 *
 * @example AI terminal usage:
 * ```bash
 * OI_AI_TERMINAL=true OI_CONVERSATION_ID=ctx_123 oi history ls
 * OI_AI_TERMINAL=true OI_CONVERSATION_ID=ctx_123 oi macro resolve "{{history:current:last:5}}"
 * ```
 *
 * @example Host usage:
 * ```typescript
 * import { IpcServer } from '@organic/cli';
 *
 * const server = new IpcServer('/tmp/oi-ipc.sock');
 * server.setContext({
 *   getContexts: () => contextManager.getAllContexts(),
 *   getMessages: (id) => contextManager.getMessages(id),
 * });
 * await server.start();
 * ```
 */

// Types
export * from './types/index.js';

// Host
export * from './host/index.js';

// Helper
export * from './helper/index.js';

/** Package version */
export const VERSION = '0.1.0';
