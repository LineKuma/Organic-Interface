/**
 * UIAgent - AI agent for UI operations
 *
 * Provides an AI-driven agent that can perceive interface state,
 * trigger interactions, and receive execution results.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import {
  UIOperationManager,
  type UIOperationType,
  type UIOperationInput,
  type UIOperationResult,
  type UIOperationContext,
  type UIPermissionLevel,
} from './UIOperation.js';
import type { Sandbox, SandboxConfig, SandboxSession } from './Sandbox.js';
import { createSandbox } from './Sandbox.js';

/**
 * UIAgent configuration
 */
export interface UIAgentConfig {
  /** Agent ID */
  agentId: string;

  /** Agent name */
  name: string;

  /** Sandbox configuration */
  sandbox: SandboxConfig;

  /** Default timeout for operations */
  defaultTimeout: number;

  /** Default retry count */
  defaultRetryCount: number;

  /** Enable operation recording */
  enableRecording: boolean;

  /** Enable auto-confirmation for sensitive operations */
  autoConfirmSensitive: boolean;

  /** Maximum operations per session */
  maxOperationsPerSession: number;

  /** Session timeout in milliseconds */
  sessionTimeout: number;
}

/**
 * Default UIAgent configuration
 */
export const DEFAULT_UI_AGENT_CONFIG: UIAgentConfig = {
  agentId: `ui-agent-${Date.now()}`,
  name: 'UIAgent',
  sandbox: {
    enabled: true,
    permissionLevel: 'L2',
    allowedDomains: ['*'],
    deniedDomains: [],
    allowedPaths: [],
    deniedPaths: ['/etc', '/root', '/sys', '/proc'],
    allowedOperations: [
      'click',
      'input',
      'select',
      'scroll',
      'hover',
      'wait',
      'getText',
      'getAttribute',
      'screenshot',
    ],
    deniedOperations: [],
    maxOperationDuration: 30000,
    maxOperationsPerSession: 1000,
    enableRecording: true,
    requireConfirmation: true,
  },
  defaultTimeout: 30000,
  defaultRetryCount: 3,
  enableRecording: true,
  autoConfirmSensitive: false,
  maxOperationsPerSession: 1000,
  sessionTimeout: 3600000, // 1 hour
};

/**
 * UIAgent state
 */
export interface UIAgentState {
  /** Agent status */
  status: UIAgentStatus;

  /** Current session */
  currentSession?: string;

  /** Total operations */
  totalOperations: number;

  /** Successful operations */
  successfulOperations: number;

  /** Failed operations */
  failedOperations: number;

  /** Last operation time */
  lastOperationTime?: number;

  /** Current permission level */
  permissionLevel: UIPermissionLevel;
}

/**
 * UIAgent status
 */
export type UIAgentStatus = 'idle' | 'busy' | 'paused' | 'error' | 'offline';

/**
 * UIAgent events
 */
export interface UIAgentEvents {
  'agent:start': { agentId: string; timestamp: number };
  'agent:stop': { agentId: string; timestamp: number };
  'agent:pause': { agentId: string; timestamp: number };
  'agent:resume': { agentId: string; timestamp: number };
  'session:start': { agentId: string; sessionId: string; timestamp: number };
  'session:end': { agentId: string; sessionId: string; timestamp: number };
  'operation:request': {
    agentId: string;
    sessionId: string;
    operation: UIOperationType;
    timestamp: number;
  };
  'operation:execute': {
    agentId: string;
    sessionId: string;
    result: UIOperationResult;
    timestamp: number;
  };
  'operation:confirm': { agentId: string; operation: UIOperationType; timestamp: number };
  'operation:cancel': {
    agentId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
  'permission:denied': {
    agentId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
}

/**
 * Operation request
 */
export interface UIOperationRequest {
  /** Operation type */
  type: UIOperationType;

  /** Operation input */
  input: UIOperationInput;

  /** Options */
  options?: {
    timeout?: number;
    retry?: number;
    force?: boolean;
  };
}

/**
 * UIAgent - AI-driven UI operation agent
 */
export class UIAgent extends EventEmitter {
  /** Agent configuration */
  private config: UIAgentConfig;

  /** Agent state */
  private state: UIAgentState;

  /** Operation manager */
  private operationManager: UIOperationManager;

  /** Sandbox */
  private sandbox: Sandbox;

  /** Logger instance */
  private logger: Logger;

  /** Active sessions */
  private sessions: Map<string, SandboxSession> = new Map();

  /** Pending confirmations */
  private pendingConfirmations: Map<string, UIOperationRequest> = new Map();

  /**
   * Create a new UIAgent instance
   */
  constructor(config: Partial<UIAgentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_UI_AGENT_CONFIG, ...config };
    this.state = {
      status: 'offline',
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      permissionLevel: this.config.sandbox.permissionLevel,
    };

    this.logger = createLogger({ prefix: `ui-agent:${this.config.name}` });
    this.operationManager = new UIOperationManager();
    this.sandbox = createSandbox(this.config.sandbox);

    // Set up operation manager events
    this.setupOperationManagerEvents();
  }

  // ==================== Lifecycle ====================

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.state.status !== 'offline') {
      this.logger.warn('Agent is not offline');
      return;
    }

    this.logger.info(`Starting UIAgent: ${this.config.name}`);
    this.setStatus('idle');

    this.emit('agent:start', { agentId: this.config.agentId, timestamp: Date.now() });
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (this.state.status === 'offline') {
      this.logger.warn('Agent is already offline');
      return;
    }

    this.logger.info(`Stopping UIAgent: ${this.config.name}`);

    // End all active sessions
    for (const [sessionId] of this.sessions) {
      await this.endSession(sessionId);
    }

    this.setStatus('offline');

    this.emit('agent:stop', { agentId: this.config.agentId, timestamp: Date.now() });
  }

  /**
   * Pause the agent
   */
  pause(): void {
    if (this.state.status !== 'idle' && this.state.status !== 'busy') {
      this.logger.warn('Agent cannot be paused in current state');
      return;
    }

    this.setStatus('paused');
    this.emit('agent:pause', { agentId: this.config.agentId, timestamp: Date.now() });
  }

  /**
   * Resume the agent
   */
  resume(): void {
    if (this.state.status !== 'paused') {
      this.logger.warn('Agent is not paused');
      return;
    }

    this.setStatus('idle');
    this.emit('agent:resume', { agentId: this.config.agentId, timestamp: Date.now() });
  }

  // ==================== Session Management ====================

  /**
   * Start a new session
   */
  startSession(): SandboxSession {
    if (this.state.status === 'offline' || this.state.status === 'paused') {
      throw new Error('Agent is not in a state that allows starting sessions');
    }

    const session = this.sandbox.createSession(this.config.agentId, this.state.permissionLevel);
    this.sessions.set(session.sessionId, session);
    this.state.currentSession = session.sessionId;

    this.emit('session:start', {
      agentId: this.config.agentId,
      sessionId: session.sessionId,
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    this.sandbox.terminateSession(sessionId);
    this.sessions.delete(sessionId);

    if (this.state.currentSession === sessionId) {
      this.state.currentSession = undefined;
    }

    this.emit('session:end', {
      agentId: this.config.agentId,
      sessionId,
      timestamp: Date.now(),
    });
  }

  /**
   * Get active session
   */
  getCurrentSession(): SandboxSession | undefined {
    if (!this.state.currentSession) {
      return undefined;
    }
    return this.sessions.get(this.state.currentSession);
  }

  // ==================== Operation Execution ====================

  /**
   * Execute a UI operation
   */
  async execute(request: UIOperationRequest): Promise<UIOperationResult> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session. Please start a session first.');
    }

    const operation = request.type;
    const input = request.input;

    this.emit('operation:request', {
      agentId: this.config.agentId,
      sessionId: session.sessionId,
      operation,
      timestamp: Date.now(),
    });

    // Check permission
    const permissionCheck = this.sandbox.checkPermission(
      session.sessionId,
      operation,
      input.selector
    );

    if (!permissionCheck.allowed) {
      this.emit('permission:denied', {
        agentId: this.config.agentId,
        operation,
        reason: permissionCheck.reason ?? 'Unknown',
        timestamp: Date.now(),
      });

      return {
        operationId: '',
        type: operation,
        success: false,
        error: permissionCheck.reason,
        executionTime: 0,
        status: 'failed',
        timestamp: Date.now(),
      };
    }

    // Handle sensitive operations
    if (permissionCheck.requiresConfirmation && !request.options?.force) {
      if (!this.config.autoConfirmSensitive) {
        const confirmed = await this.requestConfirmation(request);
        if (!confirmed) {
          this.emit('operation:cancel', {
            agentId: this.config.agentId,
            operation,
            reason: 'User cancelled',
            timestamp: Date.now(),
          });

          return {
            operationId: '',
            type: operation,
            success: false,
            error: 'Operation cancelled by user',
            executionTime: 0,
            status: 'cancelled',
            timestamp: Date.now(),
          };
        }
      }
    }

    // Set busy status
    this.setStatus('busy');

    // Create operation context
    const context: UIOperationContext = {
      operationId: '',
      agentId: this.config.agentId,
      sessionId: session.sessionId,
      permissionLevel: session.permissionLevel,
      timeout: request.options?.timeout ?? this.config.defaultTimeout,
      retryCount: request.options?.retry ?? this.config.defaultRetryCount,
      sandboxEnabled: this.config.sandbox.enabled,
      metadata: {},
    };

    try {
      const result = await this.operationManager.execute(operation, input, context);

      // Record operation in sandbox
      this.sandbox.recordOperation({
        session,
        operation,
        selector: input.selector,
        data: input as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });

      // Update statistics
      this.recordOperationResult(result.success);

      this.setStatus('idle');

      this.emit('operation:execute', {
        agentId: this.config.agentId,
        sessionId: session.sessionId,
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      this.recordOperationResult(false);

      const errorResult: UIOperationResult = {
        operationId: '',
        type: operation,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        status: 'failed',
        timestamp: Date.now(),
      };

      this.setStatus('idle');

      this.emit('operation:execute', {
        agentId: this.config.agentId,
        sessionId: session.sessionId,
        result: errorResult,
        timestamp: Date.now(),
      });

      return errorResult;
    }
  }

  /**
   * Execute multiple operations in sequence
   */
  async executeSequence(requests: UIOperationRequest[]): Promise<UIOperationResult[]> {
    const results: UIOperationResult[] = [];

    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);

      // Stop on failure unless configured otherwise
      if (!result.success && result.status !== 'cancelled') {
        this.logger.warn(`Operation failed, stopping sequence: ${request.type}`);
        break;
      }
    }

    return results;
  }

  /**
   * Request user confirmation for operation
   */
  private async requestConfirmation(request: UIOperationRequest): Promise<boolean> {
    const confirmationId = `confirm_${Date.now()}`;
    this.pendingConfirmations.set(confirmationId, request);

    // Emit confirmation event
    this.emit('operation:confirm', {
      agentId: this.config.agentId,
      operation: request.type,
      timestamp: Date.now(),
    });

    // In a real implementation, this would wait for user input
    // For now, we return false to indicate user needs to confirm
    return new Promise(resolve => {
      // Placeholder: In production, this would be resolved by user input
      setTimeout(() => resolve(false), 100);
    });
  }

  /**
   * Confirm pending operation
   */
  confirmOperation(confirmationId: string): void {
    this.pendingConfirmations.delete(confirmationId);
  }

  /**
   * Cancel pending operation
   */
  cancelOperation(confirmationId: string): void {
    this.pendingConfirmations.delete(confirmationId);
  }

  // ==================== Operation Registration ====================

  /**
   * Register an operation handler
   */
  registerOperationHandler(handler: UIOperationHandler): void {
    this.operationManager.registerHandler(handler);
  }

  /**
   * Unregister an operation handler
   */
  unregisterOperationHandler(type: UIOperationType): boolean {
    return this.operationManager.unregisterHandler(type);
  }

  // ==================== State Management ====================

  /**
   * Get agent state
   */
  getState(): UIAgentState {
    return { ...this.state };
  }

  /**
   * Get agent configuration
   */
  getConfig(): UIAgentConfig {
    return { ...this.config };
  }

  /**
   * Update permission level
   */
  setPermissionLevel(level: UIPermissionLevel): void {
    this.state.permissionLevel = level;

    // Update sandbox configuration
    this.sandbox.updateConfig({ permissionLevel: level });

    this.logger.info(`Permission level updated to: ${level}`);
  }

  /**
   * Get agent statistics
   */
  getStats(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    successRate: number;
    avgExecutionTime: number;
  } {
    const { totalOperations, successfulOperations, failedOperations } = this.state;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      successRate: totalOperations > 0 ? successfulOperations / totalOperations : 0,
      avgExecutionTime: 0, // Would need to track execution times
    };
  }

  // ==================== Private Methods ====================

  /**
   * Set agent status
   */
  private setStatus(status: UIAgentStatus): void {
    this.state.status = status;
  }

  /**
   * Record operation result
   */
  private recordOperationResult(success: boolean): void {
    this.state.totalOperations++;
    if (success) {
      this.state.successfulOperations++;
    } else {
      this.state.failedOperations++;
    }
    this.state.lastOperationTime = Date.now();
  }

  /**
   * Set up operation manager events
   */
  private setupOperationManagerEvents(): void {
    this.operationManager.on('operation:start', data => {
      this.logger.debug(`Operation started: ${data.type} (${data.operationId})`);
    });

    this.operationManager.on('operation:complete', data => {
      this.logger.debug(`Operation completed: ${data.type} (${data.operationId})`);
    });

    this.operationManager.on('operation:error', data => {
      this.logger.error(`Operation error: ${data.type} (${data.operationId}): ${data.error}`);
    });
  }
}

/**
 * Import type for operation handler
 */
type UIOperationHandler = {
  getType(): UIOperationType;
  supports(operation: UIOperationType): boolean;
  execute(input: unknown, context: UIOperationContext): Promise<UIOperationResult>;
  validate(
    input: unknown
  ): { path: string; message: string; expected?: string; actual?: unknown }[];
};

/**
 * Create a UIAgent instance
 */
export function createUIAgent(config?: Partial<UIAgentConfig>): UIAgent {
  return new UIAgent(config);
}
