/**
 * IPC Protocol Types
 *
 * Defines the communication protocol between the lightweight
 * AI helper and the host process via Unix domain socket.
 *
 * Protocol: JSON-based request/response over Unix socket
 * Socket path: /tmp/oi-ipc-{hostPid}.sock
 *
 * Environment variables:
 *   OI_AI_TERMINAL=true    - Set by AI tool; signals AI context
 *   OI_CONVERSATION_ID=xxx  - Current conversation ID
 *   OI_IPC_SOCKET=/path     - Override IPC socket path
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

/** Base IPC request */
export interface IpcRequest {
  /** Unique request ID */
  id: string;
  /** Method name */
  method: IpcMethod;
  /** Method parameters */
  params?: Record<string, unknown>;
  /** Conversation ID (from OI_CONVERSATION_ID) */
  conversationId?: string;
  /** Whether this is from an AI terminal */
  aiTerminal?: boolean;
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
  /** Current context (from OI_CONVERSATION_ID) */
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

// ── Environment ──────────────────────────────────────────────────

/** Known environment variable names */
export const ENV_AI_TERMINAL = 'OI_AI_TERMINAL';
export const ENV_CONVERSATION_ID = 'OI_CONVERSATION_ID';
export const ENV_IPC_SOCKET = 'OI_IPC_SOCKET';

/** Default IPC socket path pattern */
export function getDefaultSocketPath(): string {
  const pid = process.env[ENV_CONVERSATION_ID] ? process.pid : 'host';
  return `/tmp/oi-ipc-${pid}.sock`;
}

/** Check if running in AI terminal mode */
export function isAiTerminal(): boolean {
  return process.env[ENV_AI_TERMINAL] === 'true';
}

/** Get the current conversation ID from environment */
export function getConversationId(): string | undefined {
  return process.env[ENV_CONVERSATION_ID];
}

/** Get the IPC socket path */
export function getSocketPath(): string {
  return process.env[ENV_IPC_SOCKET] ?? getDefaultSocketPath();
}
