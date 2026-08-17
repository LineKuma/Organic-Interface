/**
 * IPC Protocol Types
 *
 * Defines the communication protocol between the lightweight
 * AI helper and the host process via Unix domain socket.
 *
 * Protocol: JSON-based request/response over Unix socket
 * Socket path: provided by host via command line argument
 *
 * Architecture:
 *   - Lightweight helper: only proxies commands to host via IPC
 *   - Host: authenticates, performs permission checks, executes
 *   - All context (conversation ID, executor identity) is carried
 *     in the IPC request, no environment variables needed
 *   - Hard isolation: helper cannot access host data directly
 */

// ── IPC Request / Response ───────────────────────────────────────

/** IPC method names */
export type IpcMethod =
  | 'history.list'
  | 'history.get'
  | 'history.count'
  | 'macro.resolve'
  | 'macro.preview'
  | 'config.get'
  | 'config.list'
  | 'ping';

/** Executor identity - determined by the host */
export interface ExecutorIdentity {
  /** Process ID of the helper */
  pid: number;
  /** Whether this is from an AI terminal */
  aiTerminal: boolean;
  /** Conversation ID (set by the AI tool, validated by host) */
  conversationId?: string;
}

/** Base IPC request */
export interface IpcRequest {
  /** Unique request ID */
  id: string;
  /** Method name */
  method: IpcMethod;
  /** Method parameters */
  params?: Record<string, unknown>;
  /** Executor identity (set by helper, validated by host) */
  executor?: ExecutorIdentity;
}

/** IPC response */
export interface IpcResponse {
  /** Matching request ID */
  id: string;
  /** Whether the request succeeded */
  success: boolean;
  /** Result data (if success) */
  data?: unknown;
  /** Error message (if failed) */
  error?: string;
  /** Error code */
  errorCode?: string;
}

// ── History IPC Data ─────────────────────────────────────────────

/** History list item */
export interface HistoryListItem {
  /** Context ID */
  contextId: string;
  /** Number of messages */
  messageCount: number;
  /** First message timestamp */
  firstMessageAt?: number;
  /** Last message timestamp */
  lastMessageAt?: number;
  /** Session ID */
  sessionId?: string;
}

/** Single message in history response */
export interface HistoryMessageItem {
  /** Message index */
  index: number;
  /** Message ID */
  id: string;
  /** Sender type */
  senderType: string;
  /** Sender name */
  senderName: string;
  /** Message type */
  type: string;
  /** Content text */
  content: string;
  /** Timestamp */
  timestamp?: number;
}

/** History list response */
export interface HistoryListResponse {
  /** Available contexts */
  contexts: HistoryListItem[];
  /** Current context (from executor identity) */
  currentContextId?: string;
}

/** History get response */
export interface HistoryGetResponse {
  /** Context ID */
  contextId: string;
  /** Total message count */
  totalCount: number;
  /** Requested messages */
  messages: HistoryMessageItem[];
  /** Range info */
  range?: {
    start: number;
    end: number;
  };
}

// ── Macro IPC Data ───────────────────────────────────────────────

/** Macro resolve response */
export interface MacroResolveResponse {
  /** Original text */
  original: string;
  /** Resolved text */
  resolved: string;
  /** Number of macros found */
  macroCount: number;
  /** Whether all resolved */
  allResolved: boolean;
  /** Unresolved count */
  unresolvedCount: number;
}

/** Macro preview response */
export interface MacroPreviewResponse {
  /** Macros found */
  macros: Array<{
    type: string;
    args: string[];
    raw: string;
  }>;
}

// ── Config IPC Data ──────────────────────────────────────────────

/** Config item */
export interface ConfigItem {
  key: string;
  value: unknown;
  description?: string;
}

/** Config list response */
export interface ConfigListResponse {
  items: ConfigItem[];
}

// ── CLI Arguments ─────────────────────────────────────────────────

/** Known CLI argument names for the helper */
export const CLI_ARG_SOCKET = 'socket';
export const CLI_ARG_CONVERSATION = 'ctx';

/** CLI arguments parsed by the helper */
export interface HelperCliArgs {
  /** Socket path to connect to the host */
  socketPath: string;
  /** Conversation ID (current context) */
  conversationId?: string;
  /** The actual command to execute */
  command: string[];
}

/**
 * Parse CLI arguments for the helper.
 * The AI tool invokes: oi --socket /path/to/sock --ctx conv_123 <command...>
 */
export function parseHelperArgs(argv: string[]): HelperCliArgs {
  let socketPath = '/tmp/oi-ipc-host.sock';
  let conversationId: string | undefined;
  const command: string[] = [];

  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--socket' && i + 1 < argv.length) {
      socketPath = argv[i + 1];
      i += 2;
    } else if (argv[i] === '--ctx' && i + 1 < argv.length) {
      conversationId = argv[i + 1];
      i += 2;
    } else {
      command.push(argv[i]);
      i++;
    }
  }

  return { socketPath, conversationId, command };
}

/**
 * Determine the default socket path.
 * When the host starts, it creates a socket at a known location.
 * The helper connects to this socket.
 */
export function getDefaultSocketPath(): string {
  return '/tmp/oi-ipc-host.sock';
}
