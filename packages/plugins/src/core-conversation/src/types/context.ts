/**
 * Context types for core conversation plugin
 */

import type { Message } from './input.js';

/**
 * Context window
 */
export interface ContextWindow {
  /** Window unique identifier */
  id: string;
  /** Associated session ID */
  sessionId: string;
  /** Messages in window */
  messages: Message[];
  /** Window configuration */
  config: ContextWindowConfig;
  /** Token count estimate */
  tokenCount: number;
  /** Message count */
  messageCount: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Context window configuration (re-exported from session)
 */
export interface ContextWindowConfig {
  /** Window size (number of messages) */
  windowSize: number;
  /** Window type */
  windowType: ContextWindowType;
  /** Include system messages */
  includeSystemMessages: boolean;
  /** Include tool calls */
  includeToolCalls: boolean;
  /** Maximum token limit */
  maxTokens?: number;
}

/**
 * Context window type (re-exported from session)
 */
export enum ContextWindowType {
  /** Recent N messages */
  RECENT_MESSAGES = 'recent_messages',
  /** Token-based window */
  TOKEN_BASED = 'token_based',
  /** Semantic-based window */
  SEMANTIC_BASED = 'semantic_based',
}

/**
 * Context updates for modification
 */
export interface ContextUpdates {
  /** System message to add */
  systemMessage?: Message;
  /** User preferences */
  preferences?: Record<string, unknown>;
  /** Custom context data */
  data?: Record<string, unknown>;
}

/**
 * Context statistics
 */
export interface ContextStats {
  /** Total message count */
  messageCount: number;
  /** Estimated token count */
  tokenCount: number;
  /** System message count */
  systemMessageCount: number;
  /** Tool call count */
  toolCallCount: number;
  /** First message timestamp */
  firstMessageAt: number;
  /** Last message timestamp */
  lastMessageAt: number;
}

/**
 * Compression strategy for context
 */
export enum CompressionStrategy {
  /** Summary-based compression */
  SUMMARY = 'summary',
  /** Trim middle messages */
  TRIM_MIDDLE = 'trim_middle',
  /** Selective message keeping */
  SELECTIVE = 'selective',
}

/**
 * Conversation context for internal use
 */
export interface ConversationContext {
  /** Session ID */
  sessionId: string;
  /** Message history */
  messages: Message[];
  /** System message */
  systemMessage?: string;
  /** User preferences */
  preferences: Record<string, unknown>;
  /** Custom data */
  data: Record<string, unknown>;
  /** Last update timestamp */
  lastUpdated: number;
}