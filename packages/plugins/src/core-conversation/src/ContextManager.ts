/**
 * ContextManager - Manages conversation context windows
 *
 * Provides context lifecycle management including message storage,
 * context retrieval, updates, and cleanup.
 */

import {
  type Message,
  MessageSender,
  type ContextWindow,
  type ContextWindowConfig,
  ContextWindowType,
  type ContextUpdates,
  type ContextStats,
  CompressionStrategy,
  type ConversationContext,
} from './types/index.js';
import { ContextError } from './errors/index.js';

/**
 * Default token estimate for messages
 */
const DEFAULT_TOKEN_ESTIMATE = 10;

/**
 * Context manager options
 */
export interface ContextManagerOptions {
  /** Default context window configuration */
  defaultConfig?: ContextWindowConfig;
  /** Maximum total messages per session */
  maxMessages?: number;
  /** Enable automatic compression */
  autoCompress?: boolean;
  /** Compression threshold (percentage of max) */
  compressionThreshold?: number;
}

/**
 * Context manager for managing conversation context windows
 */
export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private options: Required<ContextManagerOptions>;

  /**
   * Create a new ContextManager
   * @param options - Manager options
   */
  constructor(options: ContextManagerOptions = {}) {
    this.options = {
      defaultConfig: options.defaultConfig ?? {
        windowSize: 50,
        windowType: ContextWindowType.RECENT_MESSAGES,
        includeSystemMessages: true,
        includeToolCalls: true,
      },
      maxMessages: options.maxMessages ?? 1000,
      autoCompress: options.autoCompress ?? true,
      compressionThreshold: options.compressionThreshold ?? 0.8,
    };
  }

  // ==================== Public Methods ====================

  /**
   * Get or create context for a session
   * @param sessionId - Session identifier
   * @returns Conversation context
   */
  getContext(sessionId: string): ConversationContext {
    let context = this.contexts.get(sessionId);

    if (!context) {
      context = this.createContext(sessionId);
      this.contexts.set(sessionId, context);
    }

    return context;
  }

  /**
   * Get context window for a session
   * @param sessionId - Session identifier
   * @param config - Optional config override
   * @returns Context window
   */
  async getContextWindow(
    sessionId: string,
    config?: ContextWindowConfig
  ): Promise<ContextWindow> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    const windowConfig = config ?? this.options.defaultConfig;

    const messages = this.filterMessages(context.messages, windowConfig);
    const tokenCount = this.estimateTokenCount(messages);

    return {
      id: `ctx_${sessionId}_${Date.now()}`,
      sessionId,
      messages,
      config: windowConfig,
      tokenCount,
      messageCount: messages.length,
      createdAt: context.lastUpdated,
    };
  }

  /**
   * Add a message to the context
   * @param sessionId - Session identifier
   * @param message - Message to add
   */
  async addMessage(sessionId: string, message: Message): Promise<void> {
    // Get or create context
    const context = this.getContext(sessionId);

    // Add message
    context.messages.push(message);
    context.lastUpdated = Date.now();

    // Check for auto-compression
    if (this.options.autoCompress && context.messages.length >= this.options.maxMessages * this.options.compressionThreshold) {
      await this.compressContext(sessionId, CompressionStrategy.TRIM_MIDDLE);
    }
  }

  /**
   * Update a message in the context
   * @param sessionId - Session identifier
   * @param messageId - Message identifier
   * @param content - New content
   */
  async updateMessage(sessionId: string, messageId: string, content: string): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    const messageIndex = context.messages.findIndex((m) => m.id === messageId);

    if (messageIndex === -1) {
      throw ContextError.messageNotFound(sessionId, messageId);
    }

    context.messages[messageIndex].content = content;
    context.lastUpdated = Date.now();
  }

  /**
   * Delete a message from the context
   * @param sessionId - Session identifier
   * @param messageId - Message identifier
   */
  async deleteMessage(sessionId: string, messageId: string): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    const index = context.messages.findIndex((m) => m.id === messageId);

    if (index === -1) {
      throw ContextError.messageNotFound(sessionId, messageId);
    }

    context.messages.splice(index, 1);
    context.lastUpdated = Date.now();
  }

  /**
   * Clear all messages in the context
   * @param sessionId - Session identifier
   */
  async clearContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    context.messages = [];
    context.lastUpdated = Date.now();
  }

  /**
   * Get message history with optional limit
   * @param sessionId - Session identifier
   * @param limit - Maximum number of messages
   * @returns Message array
   */
  async getHistory(sessionId: string, limit?: number): Promise<Message[]> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    const messages = [...context.messages];

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Get context statistics
   * @param sessionId - Session identifier
   * @returns Context statistics
   */
  async getContextStats(sessionId: string): Promise<ContextStats> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    const messages = context.messages;
    const systemMessages = messages.filter((m) => m.sender === MessageSender.SYSTEM);
    const toolMessages = messages.filter((m) => m.sender === MessageSender.TOOL);

    return {
      messageCount: messages.length,
      tokenCount: this.estimateTokenCount(messages),
      systemMessageCount: systemMessages.length,
      toolCallCount: toolMessages.length,
      firstMessageAt: messages.length > 0 ? messages[0].timestamp : 0,
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].timestamp : 0,
    };
  }

  /**
   * Update context with additional data
   * @param sessionId - Session identifier
   * @param updates - Context updates
   */
  async updateContext(sessionId: string, updates: ContextUpdates): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    if (updates.systemMessage !== undefined) {
      context.systemMessage = updates.systemMessage;
    }

    if (updates.preferences !== undefined) {
      context.preferences = { ...context.preferences, ...updates.preferences };
    }

    if (updates.data !== undefined) {
      context.data = { ...context.data, ...updates.data };
    }

    context.lastUpdated = Date.now();
  }

  /**
   * Compress context using specified strategy
   * @param sessionId - Session identifier
   * @param strategy - Compression strategy
   */
  async compressContext(sessionId: string, strategy: CompressionStrategy): Promise<void> {
    const context = this.contexts.get(sessionId);

    if (!context) {
      throw ContextError.notFound(sessionId);
    }

    switch (strategy) {
      case CompressionStrategy.TRIM_MIDDLE:
        this.trimMiddle(context);
        break;
      case CompressionStrategy.SUMMARY:
        // In a real implementation, this would call an AI service to summarize
        this.trimMiddle(context);
        break;
      case CompressionStrategy.SELECTIVE:
        this.selectiveTrim(context);
        break;
    }

    context.lastUpdated = Date.now();
  }

  /**
   * Set system message for context
   * @param sessionId - Session identifier
   * @param systemMessage - System message content
   */
  setSystemMessage(sessionId: string, systemMessage: string): void {
    const context = this.getContext(sessionId);
    context.systemMessage = systemMessage;
    context.lastUpdated = Date.now();
  }

  /**
   * Delete context for a session
   * @param sessionId - Session identifier
   */
  deleteContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }

  /**
   * Get total context count
   */
  getContextCount(): number {
    return this.contexts.size;
  }

  /**
   * Shutdown and cleanup all contexts
   */
  shutdown(): void {
    this.contexts.clear();
  }

  // ==================== Private Methods ====================

  /**
   * Create a new context
   */
  private createContext(sessionId: string): ConversationContext {
    return {
      sessionId,
      messages: [],
      systemMessage: undefined,
      preferences: {},
      data: {},
      lastUpdated: Date.now(),
    };
  }

  /**
   * Filter messages based on window config
   */
  private filterMessages(messages: Message[], config: ContextWindowConfig): Message[] {
    let filtered = [...messages];

    // Filter by window type
    switch (config.windowType) {
      case ContextWindowType.RECENT_MESSAGES:
        filtered = this.filterRecentMessages(filtered, config.windowSize, config.includeSystemMessages);
        break;
      case ContextWindowType.TOKEN_BASED:
        filtered = this.filterByTokens(filtered, config.maxTokens ?? Infinity, config.includeSystemMessages);
        break;
      case ContextWindowType.SEMANTIC_BASED:
        // In a real implementation, this would use semantic similarity
        filtered = this.filterRecentMessages(filtered, config.windowSize, config.includeSystemMessages);
        break;
    }

    // Filter tool calls if needed
    if (!config.includeToolCalls) {
      filtered = filtered.filter((m) => m.sender !== MessageSender.TOOL);
    }

    return filtered;
  }

  /**
   * Filter to recent N messages
   */
  private filterRecentMessages(
    messages: Message[],
    windowSize: number,
    includeSystem: boolean
  ): Message[] {
    if (includeSystem) {
      return messages.slice(-windowSize);
    }

    // Exclude system messages from count
    const nonSystem = messages.filter((m) => m.sender !== MessageSender.SYSTEM);
    const systemCount = messages.length - nonSystem.length;

    if (nonSystem.length <= windowSize) {
      // Return all messages if non-system count is within limit
      return messages;
    }

    // Take system messages + recent non-system messages
    const recentNonSystem = nonSystem.slice(-windowSize);
    const systemMessages = messages.filter((m) => m.sender === MessageSender.SYSTEM);

    return [...systemMessages, ...recentNonSystem].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Filter by token count
   */
  private filterByTokens(
    messages: Message[],
    maxTokens: number,
    includeSystem: boolean
  ): Message[] {
    const filtered: Message[] = [];
    let tokenCount = 0;

    // Iterate in reverse to get most recent first
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      if (!includeSystem && message.sender === MessageSender.SYSTEM) {
        continue;
      }

      const messageTokens = this.estimateMessageTokens(message);

      if (tokenCount + messageTokens <= maxTokens) {
        filtered.unshift(message);
        tokenCount += messageTokens;
      } else {
        break;
      }
    }

    return filtered;
  }

  /**
   * Trim middle messages
   */
  private trimMiddle(context: ConversationContext): void {
    const messages = context.messages;
    if (messages.length <= 2) return;

    const keepFirst = Math.ceil(messages.length * 0.2);
    const keepLast = Math.ceil(messages.length * 0.6);

    // Always keep system messages at the start
    const systemMessages = messages.filter((m) => m.sender === MessageSender.SYSTEM);
    const nonSystemMessages = messages.filter((m) => m.sender !== MessageSender.SYSTEM);

    if (nonSystemMessages.length > keepFirst + keepLast) {
      const first = nonSystemMessages.slice(0, keepFirst);
      const last = nonSystemMessages.slice(-keepLast);
      context.messages = [...systemMessages, ...first, ...last].sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  /**
   * Selective trim - keep important messages
   */
  private selectiveTrim(context: ConversationContext): void {
    const messages = context.messages;

    // Keep first N and last N messages
    const keepFirst = 5;
    const keepLast = 20;

    if (messages.length <= keepFirst + keepLast) {
      return;
    }

    const first = messages.slice(0, keepFirst);
    const last = messages.slice(-keepLast);

    context.messages = [...first, ...last].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Estimate total token count
   */
  private estimateTokenCount(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0);
  }

  /**
   * Estimate token count for a single message
   */
  private estimateMessageTokens(message: Message): number {
    // Rough estimate: ~4 characters per token
    const contentTokens = Math.ceil((message.content?.length ?? 0) / 4);
    return contentTokens + DEFAULT_TOKEN_ESTIMATE;
  }
}