/**
 * Session types for core conversation plugin
 */

/**
 * Session status enum
 */
export enum SessionStatus {
  /** Active session */
  ACTIVE = 'active',
  /** Idle session (no recent activity) */
  IDLE = 'idle',
  /** Closed session */
  CLOSED = 'closed',
  /** Archived session */
  ARCHIVED = 'archived',
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session title */
  title?: string;
  /** Session tags */
  tags?: string[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Context window configuration */
  contextWindow?: ContextWindowConfig;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Session time-to-live in milliseconds */
  ttl?: number;
}

/**
 * Context window configuration
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
 * Context window type
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
 * Session interface
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** Session title */
  title: string;
  /** Current session status */
  status: SessionStatus;
  /** Session tags */
  tags: string[];
  /** Session metadata */
  metadata: Record<string, unknown>;
  /** Context window configuration */
  contextWindow: ContextWindowConfig;
  /** Creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActiveAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Message count */
  messageCount: number;
  /** Associated project ID */
  projectId?: string;
}

/**
 * Session updates
 */
export interface SessionUpdates {
  /** Session title */
  title?: string;
  /** Session tags */
  tags?: string[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Session status */
  status?: SessionStatus;
  /** Context window configuration */
  contextWindow?: ContextWindowConfig;
}

/**
 * Session filter for listing
 */
export interface SessionFilter {
  /** Filter by status */
  status?: SessionStatus | SessionStatus[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by project */
  projectId?: string;
  /** Created after timestamp */
  createdAfter?: number;
  /** Created before timestamp */
  createdBefore?: number;
  /** Keyword search */
  keyword?: string;
}

/**
 * Session creation options
 */
export interface SessionCreateOptions {
  /** User ID */
  userId?: string;
  /** Session configuration */
  config?: SessionConfig;
}