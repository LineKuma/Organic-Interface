/**
 * CoreConversationPlugin - Core conversation plugin for Organic Interface
 *
 * This plugin provides the main user interaction interface, handling
 * text-based CLI input/output for conversations. It follows the Linux
 * design philosophy where the plugin acts as a system program interacting
 * with the kernel (core) to provide rich functionality.
 *
 * Design Philosophy:
 * - Kernel (core): Provides base services, task scheduling, resource management
 * - Plugin (peripheral): Implements specific business logic, user interaction
 * - core-conversation: The primary user-facing plugin, equivalent to "shell" in Linux
 */

import type {
  PluginContext,
  PluginInput,
  PluginOutput,
  InitializeResult,
  PluginInterface,
  KernelApi,
} from '@organic/utils';

import { SessionManager, type SessionManagerOptions } from './SessionManager.js';
import { ContextManager, type ContextManagerOptions } from './ContextManager.js';
import { InputParser, type InputParserOptions } from './InputParser.js';
import { OutputFormatter, type OutputFormatterOptions } from './OutputFormatter.js';
import { ConversationError, ConversationErrorCode } from './errors/index.js';
import type {
  Session,
  SessionConfig,
  SessionCreateOptions,
  SessionFilter,
  Message,
  ParsedInput,
  ConversationResult,
  ResponseMessage,
  ResponseType,
  ResultType,
  FormattedOutput,
} from './types/index.js';

/**
 * Plugin metadata
 */
const METADATA = {
  id: 'core-conversation',
  name: 'core-conversation',
  version: '1.0.0',
  description: 'Core conversation plugin for text-based interaction',
  apiVersion: '1.0.0',
  minKernelVersion: '1.0.0',
  dependencies: [],
  defaultConfig: {
    maxSessionHistory: 100,
    defaultTimeout: 30000,
    enableStreaming: false,
    maxSessions: 100,
    defaultContextWindowSize: 50,
  },
};

/**
 * Plugin configuration schema
 */
const CONFIG_SCHEMA = {
  maxSessionHistory: {
    type: 'number',
    required: false,
    default: 100,
    description: 'Maximum number of messages to keep in session history',
  },
  defaultTimeout: {
    type: 'number',
    required: false,
    default: 30000,
    description: 'Default timeout for operations in milliseconds',
  },
  enableStreaming: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Enable streaming response support',
  },
  maxSessions: {
    type: 'number',
    required: false,
    default: 100,
    description: 'Maximum number of concurrent sessions',
  },
  defaultContextWindowSize: {
    type: 'number',
    required: false,
    default: 50,
    description: 'Default context window size (number of messages)',
  },
};

/**
 * Conversation action types
 */
enum ConversationAction {
  CREATE_SESSION = 'create_session',
  SEND_MESSAGE = 'send_message',
  RESUME_SESSION = 'resume_session',
  CLOSE_SESSION = 'close_session',
  LIST_SESSIONS = 'list_sessions',
  GET_SESSION = 'get_session',
  GET_CONTEXT = 'get_context',
  CLEAR_CONTEXT = 'clear_context',
  UPDATE_CONTEXT = 'update_context',
}

/**
 * Core conversation plugin implementation
 */
export class CoreConversationPlugin implements PluginInterface {
  /** Plugin name */
  readonly name: string = METADATA.name;

  /** Plugin version */
  readonly version: string = METADATA.version;

  /** Plugin description */
  readonly description: string = METADATA.description;

  /** Kernel API interface */
  private kernel: KernelApi | null = null;

  /** Plugin configuration */
  private config: Record<string, unknown> = {};

  /** Whether plugin is initialized */
  private initialized: boolean = false;

  /** Session manager instance */
  private sessionManager: SessionManager | null = null;

  /** Context manager instance */
  private contextManager: ContextManager | null = null;

  /** Input parser instance */
  private inputParser: InputParser | null = null;

  /** Output formatter instance */
  private outputFormatter: OutputFormatter | null = null;

  /** Active session ID */
  private activeSessionId: string | null = null;

  /** Logger function */
  private logger: ((message: string, ...args: unknown[]) => void) | null = null;

  /**
   * Create a new CoreConversationPlugin
   */
  constructor() {
    // Constructor is minimal - initialization happens in initialize()
  }

  // ==================== PluginInterface Implementation ====================

  /**
   * Initialize the plugin
   * @param context - Plugin context with kernel API and configuration
   */
  async initialize(context: PluginContext): Promise<InitializeResult> {
    try {
      // Store kernel API
      this.kernel = context.kernel;

      // Merge configuration with defaults
      this.config = {
        ...METADATA.defaultConfig,
        ...context.config,
      };

      // Initialize managers
      const sessionOptions: SessionManagerOptions = {
        maxSessions: this.config.maxSessions as number,
        defaultTtl: this.config.defaultTimeout as number,
      };

      const contextOptions: ContextManagerOptions = {
        defaultConfig: {
          windowSize: this.config.defaultContextWindowSize as number,
          windowType: 0, // RECENT_MESSAGES
          includeSystemMessages: true,
          includeToolCalls: true,
        },
        maxMessages: this.config.maxSessionHistory as number,
      };

      const inputOptions: InputParserOptions = {
        maxLength: 10000,
        enableCommands: true,
        enableIntentExtraction: true,
      };

      const outputOptions: OutputFormatterOptions = {
        enableColors: false,
        maxLineWidth: 80,
        includeTimestamps: true,
        includeMetadata: false,
      };

      this.sessionManager = new SessionManager(sessionOptions);
      this.contextManager = new ContextManager(contextOptions);
      this.inputParser = new InputParser(inputOptions);
      this.outputFormatter = new OutputFormatter(outputOptions);

      // Set up logger if kernel provides one
      if (context.logger) {
        this.logger = (message: string, ...args: unknown[]) => {
          context.logger.info(`[core-conversation] ${message}`, ...args);
        };
      }

      this.initialized = true;
      this.log('Plugin initialized successfully');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a plugin action
   * @param input - Plugin input with action and parameters
   */
  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.initialized) {
      return {
        success: false,
        error: 'Plugin not initialized',
      };
    }

    const startTime = Date.now();

    try {
      const action = input.action as ConversationAction;
      const params = input.params ?? {};

      let result: ConversationResult;

      switch (action) {
        case ConversationAction.CREATE_SESSION:
          result = await this.handleCreateSession(params);
          break;

        case ConversationAction.SEND_MESSAGE:
          result = await this.handleSendMessage(params);
          break;

        case ConversationAction.RESUME_SESSION:
          result = await this.handleResumeSession(params);
          break;

        case ConversationAction.CLOSE_SESSION:
          result = await this.handleCloseSession(params);
          break;

        case ConversationAction.LIST_SESSIONS:
          result = await this.handleListSessions(params);
          break;

        case ConversationAction.GET_SESSION:
          result = await this.handleGetSession(params);
          break;

        case ConversationAction.GET_CONTEXT:
          result = await this.handleGetContext(params);
          break;

        case ConversationAction.CLEAR_CONTEXT:
          result = await this.handleClearContext(params);
          break;

        case ConversationAction.UPDATE_CONTEXT:
          result = await this.handleUpdateContext(params);
          break;

        default:
          throw new ConversationError(
            `Unknown action: ${action}`,
            ConversationErrorCode.INVALID_INPUT
          );
      }

      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          pluginVersion: METADATA.version,
        },
      };
    } catch (error) {
      this.log('Execution error', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Shutdown the plugin gracefully
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down plugin');

    // Clean up session manager
    if (this.sessionManager) {
      this.sessionManager.shutdown();
    }

    // Clean up context manager
    if (this.contextManager) {
      this.contextManager.shutdown();
    }

    // Clear state
    this.kernel = null;
    this.initialized = false;
    this.activeSessionId = null;

    this.log('Plugin shutdown complete');
  }

  // ==================== Action Handlers ====================

  /**
   * Handle create session action
   */
  private async handleCreateSession(params: Record<string, unknown>): Promise<ConversationResult> {
    const options: SessionCreateOptions = {
      userId: params.userId as string | undefined,
      config: params.config as SessionConfig | undefined,
    };

    const session = await this.sessionManager!.createSession(options);
    this.activeSessionId = session.id;

    return {
      type: ResultType.SESSION,
      session,
    };
  }

  /**
   * Handle send message action
   */
  private async handleSendMessage(params: Record<string, unknown>): Promise<ConversationResult> {
    const text = params.text as string;
    const sessionId = (params.sessionId as string) || this.activeSessionId;

    if (!sessionId) {
      throw new ConversationError(
        'No active session. Create or resume a session first.',
        ConversationErrorCode.SESSION_NOT_FOUND
      );
    }

    // Parse input
    const parsedInput = this.inputParser!.parse(text);

    // Validate input
    const validation = this.inputParser!.validate(parsedInput);
    if (!validation.valid) {
      throw new ConversationError(
        `Invalid input: ${validation.errors?.map((e) => e.message).join(', ')}`,
        ConversationErrorCode.INVALID_INPUT,
        { errors: validation.errors }
      );
    }

    // Create message
    const message = this.inputParser!.createMessage(parsedInput, sessionId);

    // Add message to context
    await this.contextManager!.addMessage(sessionId, message);

    // Increment message count
    await this.sessionManager!.incrementMessageCount(sessionId);

    // Get context for processing
    const contextWindow = await this.contextManager!.getContextWindow(sessionId);

    // Create response message (in real implementation, this would call AI service via kernel)
    const responseMessage: ResponseMessage = {
      id: this.generateMessageId(),
      content: {
        text: `Processed: ${parsedInput.normalizedText}`,
        format: 'plain_text',
      },
      type: ResponseType.TEXT,
      sender: 'assistant' as any,
      timestamp: Date.now(),
      requestId: parsedInput.metadata.timestamp.toString(),
    };

    // Add response to context
    await this.contextManager!.addMessage(sessionId, {
      id: responseMessage.id,
      content: responseMessage.content.text,
      sender: 'assistant' as any,
      timestamp: responseMessage.timestamp,
      sessionId,
    });

    return {
      type: ResultType.MESSAGE,
      message: responseMessage,
      session: await this.sessionManager!.getSession(sessionId) || undefined,
      contextWindow,
    };
  }

  /**
   * Handle resume session action
   */
  private async handleResumeSession(params: Record<string, unknown>): Promise<ConversationResult> {
    const sessionId = params.sessionId as string;

    if (!sessionId) {
      throw new ConversationError(
        'Session ID is required',
        ConversationErrorCode.INVALID_INPUT
      );
    }

    const session = await this.sessionManager!.resumeSession(sessionId);

    if (!session) {
      throw new ConversationError(
        `Session not found: ${sessionId}`,
        ConversationErrorCode.SESSION_NOT_FOUND
      );
    }

    this.activeSessionId = sessionId;

    return {
      type: ResultType.SESSION,
      session,
    };
  }

  /**
   * Handle close session action
   */
  private async handleCloseSession(params: Record<string, unknown>): Promise<ConversationResult> {
    const sessionId = (params.sessionId as string) || this.activeSessionId;

    if (!sessionId) {
      throw new ConversationError(
        'No session to close',
        ConversationErrorCode.INVALID_INPUT
      );
    }

    await this.sessionManager!.closeSession(sessionId);

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    return {
      type: ResultType.CONFIRMATION,
      message: {
        id: this.generateMessageId(),
        content: {
          text: `Session ${sessionId} closed successfully`,
          format: 'plain_text',
        },
        type: ResponseType.TEXT,
        sender: 'system' as any,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Handle list sessions action
   */
  private async handleListSessions(params: Record<string, unknown>): Promise<ConversationResult> {
    const filter: SessionFilter | undefined = params.filter as SessionFilter;
    const sessions = await this.sessionManager!.listSessions(filter);

    return {
      type: ResultType.SESSION_LIST,
      sessions,
    };
  }

  /**
   * Handle get session action
   */
  private async handleGetSession(params: Record<string, unknown>): Promise<ConversationResult> {
    const sessionId = (params.sessionId as string) || this.activeSessionId;

    if (!sessionId) {
      throw new ConversationError(
        'Session ID is required',
        ConversationErrorCode.INVALID_INPUT
      );
    }

    const session = await this.sessionManager!.getSession(sessionId);

    if (!session) {
      throw new ConversationError(
        `Session not found: ${sessionId}`,
        ConversationErrorCode.SESSION_NOT_FOUND
      );
    }

    return {
      type: ResultType.SESSION,
      session,
    };
  }

  /**
   * Handle get context action
   */
  private async handleGetContext(params: Record<string, unknown>): Promise<ConversationResult> {
    const sessionId = (params.sessionId as string) || this.activeSessionId;

    if (!sessionId) {
      throw new ConversationError(
        'Session ID is required',
        ConversationErrorCode.INVALID_INPUT
      );
    }

    const contextWindow = await this.contextManager!.getContextWindow(sessionId);

    return {
      type: ResultType.CONTEXT,
      contextWindow,
    };
  }

  /**
   * Handle clear context action
   */
  private async handleClearContext(params: Record<string, unknown>): Promise<ConversationResult> {
    const sessionId = (params.sessionId as string) || this.activeSessionId;

    if (!sessionId) {
      throw new ConversationError(
        'Session ID is required',
        ConversationErrorCode.INVALID_INPUT
      );
    }

    await this.contextManager!.clearContext(sessionId);

    return {
      type: ResultType.CONFIRMATION,
      message: {
        id: this.generateMessageId(),
        content: {
          text: `Context cleared for session ${sessionId}`,
          format: 'plain_text',
        },
        type: ResponseType.TEXT,
        sender: 'system' as any,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Handle update context action
   */
  private async handleUpdateContext(params: Record<string, unknown>): Promise<ConversationResult> {
    const sessionId = (params.sessionId as string) || this.activeSessionId;
    const updates = params.updates as Record<string, unknown>;

    if (!sessionId) {
      throw new ConversationError(
        'Session ID is required',
        ConversationErrorCode.INVALID_INPUT
      );
    }

    await this.contextManager!.updateContext(sessionId, updates as any);
    const contextWindow = await this.contextManager!.getContextWindow(sessionId);

    return {
      type: ResultType.CONTEXT,
      contextWindow,
    };
  }

  // ==================== Public API ====================

  /**
   * Get plugin metadata
   */
  getMetadata(): typeof METADATA {
    return { ...METADATA };
  }

  /**
   * Get configuration schema
   */
  getConfigSchema(): typeof CONFIG_SCHEMA {
    return { ...CONFIG_SCHEMA };
  }

  /**
   * Get active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get formatted output for a result
   */
  formatOutput(result: ConversationResult): FormattedOutput {
    return this.outputFormatter!.format(result);
  }

  /**
   * Parse user input
   */
  parseInput(text: string): ParsedInput {
    return this.inputParser!.parse(text);
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager!;
  }

  /**
   * Get context manager
   */
  getContextManager(): ContextManager {
    return this.contextManager!;
  }

  // ==================== Private Methods ====================

  /**
   * Log a message
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.logger) {
      this.logger(message, ...args);
    } else {
      console.log(`[core-conversation] ${message}`, ...args);
    }
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `msg_${timestamp}_${random}`;
  }
}

// Export metadata for discovery
export { METADATA, CONFIG_SCHEMA };