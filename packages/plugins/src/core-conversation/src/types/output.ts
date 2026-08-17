/**
 * Output types for core conversation plugin
 */

import type { ContextWindow } from './context.js';
import type { Session } from './session.js';

/**
 * Response content
 */
export interface ResponseContent {
  /** Text content */
  text: string;
  /** Content format */
  format: ContentFormat;
  /** Structured data */
  structuredData?: Record<string, unknown>;
}

/**
 * Content format enum
 */
export enum ContentFormat {
  /** Plain text */
  PLAIN_TEXT = 'plain_text',
  /** Markdown format */
  MARKDOWN = 'markdown',
  /** JSON format */
  JSON = 'json',
  /** HTML format */
  HTML = 'html',
}

/**
 * Response type enum
 */
export enum ResponseType {
  /** Text response */
  TEXT = 'text',
  /** Error response */
  ERROR = 'error',
  /** Confirmation request */
  CONFIRMATION = 'confirmation',
  /** Status update */
  STATUS = 'status',
  /** Stream response */
  STREAM = 'stream',
}

/**
 * Response message
 */
export interface ResponseMessage {
  /** Message identifier */
  id: string;
  /** Response content */
  content: ResponseContent;
  /** Response type */
  type: ResponseType;
  /** Sender information */
  sender: MessageSender;
  /** Timestamp */
  timestamp: number;
  /** Associated request ID */
  requestId?: string;
  /** Tool calls in response */
  toolCalls?: ToolCall[];
  /** Stream info */
  stream?: StreamInfo;
}

/**
 * Message sender (re-exported from input)
 */
export enum MessageSender {
  /** User message */
  USER = 'user',
  /** Assistant message */
  ASSISTANT = 'assistant',
  /** System message */
  SYSTEM = 'system',
  /** Tool message */
  TOOL = 'tool',
}

/**
 * Tool call in response
 */
export interface ToolCall {
  /** Tool identifier */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
  /** Execution status */
  status?: ToolCallStatus;
  /** Result */
  result?: unknown;
}

/**
 * Tool call status
 */
export enum ToolCallStatus {
  /** Pending */
  PENDING = 'pending',
  /** In progress */
  IN_PROGRESS = 'in_progress',
  /** Completed */
  COMPLETED = 'completed',
  /** Failed */
  FAILED = 'failed',
}

/**
 * Stream info
 */
export interface StreamInfo {
  /** Stream ID */
  streamId: string;
  /** Chunk count */
  chunkCount: number;
  /** Final chunk flag */
  isFinal: boolean;
}

/**
 * Conversation result
 */
export interface ConversationResult {
  /** Result type */
  type: ResultType;
  /** Message content */
  message?: ResponseMessage;
  /** Session information */
  session?: Session;
  /** Context window */
  contextWindow?: ContextWindow;
  /** Session list */
  sessions?: Session[];
  /** Tool call results */
  toolResults?: ToolCallResult[];
}

/**
 * Result type enum
 */
export enum ResultType {
  /** Message response */
  MESSAGE = 'message',
  /** Session information */
  SESSION = 'session',
  /** Session list */
  SESSION_LIST = 'session_list',
  /** Context window */
  CONTEXT = 'context',
  /** Confirmation response */
  CONFIRMATION = 'confirmation',
  /** Error response */
  ERROR = 'error',
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  /** Call identifier */
  callId: string;
  /** Tool name */
  toolName: string;
  /** Execution result */
  result: unknown;
  /** Success flag */
  success: boolean;
  /** Error information */
  error?: ToolCallError;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Tool call error
 */
export interface ToolCallError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: unknown;
}

/**
 * Formatted output
 */
export interface FormattedOutput {
  /** Output text */
  text: string;
  /** Output format */
  format: OutputFormat;
  /** Metadata */
  metadata: OutputMetadata;
}

/**
 * Output format enum
 */
export enum OutputFormat {
  /** Plain text */
  PLAIN = 'plain',
  /** Colored terminal output */
  TERMINAL = 'terminal',
  /** JSON format */
  JSON = 'json',
  /** Markdown format */
  MARKDOWN = 'markdown',
}

/**
 * Output metadata
 */
export interface OutputMetadata {
  /** Execution time in milliseconds */
  executionTime: number;
  /** Plugin version */
  pluginVersion: string;
  /** Session ID */
  sessionId?: string;
  /** Message ID */
  messageId?: string;
  /** Stream flag */
  stream?: boolean;
}
