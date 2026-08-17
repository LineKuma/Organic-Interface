/**
 * Sandbox - Security sandbox for UI operations
 *
 * Provides isolation and security controls for AI-driven
 * UI operations, limiting access to sensitive resources.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Enable sandbox */
  enabled: boolean;

  /** Permission level for sandbox */
  permissionLevel: UIPermissionLevel;

  /** Allowed domains/URLs */
  allowedDomains: string[];

  /** Denied domains/URLs */
  deniedDomains: string[];

  /** Allowed file paths */
  allowedPaths: string[];

  /** Denied file paths */
  deniedPaths: string[];

  /** Allowed operations */
  allowedOperations: UIOperationType[];

  /** Denied operations */
  deniedOperations: UIOperationType[];

  /** Maximum operation duration (ms) */
  maxOperationDuration: number;

  /** Maximum operations per session */
  maxOperationsPerSession: number;

  /** Enable operation recording */
  enableRecording: boolean;

  /** Require confirmation for sensitive operations */
  requireConfirmation: boolean;

  /** Network restrictions */
  networkRestrictions?: SandboxNetworkRestrictions;
}

/**
 * Default sandbox configuration
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  enabled: true,
  permissionLevel: 'L2',
  allowedDomains: ['*'],
  deniedDomains: [],
  allowedPaths: [],
  deniedPaths: ['/etc', '/root', '/sys', '/proc', '/var'],
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
};

/**
 * Network restrictions for sandbox
 */
export interface SandboxNetworkRestrictions {
  /** Allowed HTTP methods */
  allowedMethods: string[];

  /** Maximum request size */
  maxRequestSize: number;

  /** Maximum response size */
  maxResponseSize: number;

  /** Allowed headers */
  allowedHeaders: string[];

  /** Blocked headers (for security) */
  blockedHeaders: string[];
}

/**
 * Sandbox session
 */
export interface SandboxSession {
  /** Session ID */
  sessionId: string;

  /** Agent ID */
  agentId: string;

  /** Start time */
  startTime: number;

  /** End time */
  endTime?: number;

  /** Operation count */
  operationCount: number;

  /** Permission level */
  permissionLevel: UIPermissionLevel;

  /** Status */
  status: SandboxSessionStatus;
}

/**
 * Sandbox session status
 */
export type SandboxSessionStatus = 'active' | 'paused' | 'terminated' | 'completed';

/**
 * Sandbox operation context
 */
export interface SandboxOperationContext {
  /** Session */
  session: SandboxSession;

  /** Operation type */
  operation: UIOperationType;

  /** Target selector */
  selector: string;

  /** Additional data */
  data?: Record<string, unknown>;

  /** Timestamp */
  timestamp: number;
}

/**
 * Sandbox permission check result
 */
export interface PermissionCheckResult {
  /** Whether operation is allowed */
  allowed: boolean;

  /** Reason */
  reason?: string;

  /** Required confirmation */
  requiresConfirmation: boolean;

  /** Warnings */
  warnings: string[];
}

/**
 * UIPermissionLevel type alias
 */
export type UIPermissionLevel = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * UIOperationType type alias
 */
export type UIOperationType =
  | 'click'
  | 'input'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'wait'
  | 'getText'
  | 'getAttribute'
  | 'screenshot';

/**
 * Sandbox - Security sandbox for UI operations
 */
export class Sandbox extends EventEmitter {
  /** Sandbox configuration */
  private config: SandboxConfig;

  /** Active sessions */
  private sessions: Map<string, SandboxSession> = new Map();

  /** Operation history */
  private operationHistory: SandboxOperationContext[] = [];

  /** Logger instance */
  private logger: Logger;

  /**
   * Create a new Sandbox instance
   */
  constructor(config: Partial<SandboxConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'ui-sandbox' });
  }

  // ==================== Configuration ====================

  /**
   * Get sandbox configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(updates: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Sandbox configuration updated');
  }

  /**
   * Enable/disable sandbox
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger.info(`Sandbox ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if sandbox is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ==================== Session Management ====================

  /**
   * Create a new session
   */
  createSession(agentId: string, permissionLevel?: UIPermissionLevel): SandboxSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session: SandboxSession = {
      sessionId,
      agentId,
      startTime: Date.now(),
      operationCount: 0,
      permissionLevel: permissionLevel ?? this.config.permissionLevel,
      status: 'active',
    };

    this.sessions.set(sessionId, session);
    this.logger.info(`Created sandbox session: ${sessionId} for agent: ${agentId}`);

    this.emit('session:created', { session, timestamp: Date.now() });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SandboxSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Terminate a session
   */
  terminateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'terminated';
    session.endTime = Date.now();

    this.logger.info(`Terminated sandbox session: ${sessionId}`);

    this.emit('session:terminated', { session, timestamp: Date.now() });

    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SandboxSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === 'active');
  }

  // ==================== Permission Checking ====================

  /**
   * Check if operation is allowed
   */
  checkPermission(
    sessionId: string,
    operation: UIOperationType,
    _selector: string,
    _data?: Record<string, unknown>
  ): PermissionCheckResult {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        allowed: false,
        reason: 'Invalid session',
        requiresConfirmation: false,
        warnings: ['Session not found'],
      };
    }

    if (session.status !== 'active') {
      return {
        allowed: false,
        reason: 'Session is not active',
        requiresConfirmation: false,
        warnings: [`Session status: ${session.status}`],
      };
    }

    // Check operation count limit
    if (session.operationCount >= this.config.maxOperationsPerSession) {
      return {
        allowed: false,
        reason: 'Maximum operations per session reached',
        requiresConfirmation: false,
        warnings: [`Operation count: ${session.operationCount}`],
      };
    }

    const warnings: string[] = [];

    // Check if operation is allowed
    if (
      this.config.allowedOperations.length > 0 &&
      !this.config.allowedOperations.includes(operation)
    ) {
      return {
        allowed: false,
        reason: `Operation not allowed: ${operation}`,
        requiresConfirmation: false,
        warnings,
      };
    }

    if (this.config.deniedOperations.includes(operation)) {
      return {
        allowed: false,
        reason: `Operation denied: ${operation}`,
        requiresConfirmation: false,
        warnings,
      };
    }

    // Check permission level
    const requiredLevel = this.getRequiredPermissionLevel(operation);
    if (!this.hasPermissionLevel(session.permissionLevel, requiredLevel)) {
      return {
        allowed: false,
        reason: `Insufficient permission level: ${session.permissionLevel} < ${requiredLevel}`,
        requiresConfirmation: false,
        warnings,
      };
    }

    // Check for sensitive operations
    const sensitiveOperations: UIOperationType[] = ['input'];
    const requiresConfirmation =
      this.config.requireConfirmation && sensitiveOperations.includes(operation);

    // Add warnings for sensitive operations
    if (requiresConfirmation) {
      warnings.push('This operation may involve sensitive data');
    }

    return {
      allowed: true,
      requiresConfirmation,
      warnings,
    };
  }

  /**
   * Get required permission level for operation
   */
  private getRequiredPermissionLevel(operation: UIOperationType): UIPermissionLevel {
    const levelMap: Record<UIOperationType, UIPermissionLevel> = {
      click: 'L2',
      input: 'L2',
      select: 'L2',
      scroll: 'L1',
      hover: 'L1',
      wait: 'L1',
      getText: 'L1',
      getAttribute: 'L1',
      screenshot: 'L1',
    };

    return levelMap[operation] ?? 'L1';
  }

  /**
   * Check if permission level is sufficient
   */
  private hasPermissionLevel(current: UIPermissionLevel, required: UIPermissionLevel): boolean {
    const levels: UIPermissionLevel[] = ['L1', 'L2', 'L3', 'L4'];
    return levels.indexOf(current) >= levels.indexOf(required);
  }

  // ==================== Operation Recording ====================

  /**
   * Record an operation
   */
  recordOperation(context: SandboxOperationContext): void {
    if (!this.config.enableRecording) {
      return;
    }

    this.operationHistory.push(context);

    // Update session operation count
    const session = this.sessions.get(context.session.sessionId);
    if (session) {
      session.operationCount++;
    }

    this.emit('operation:recorded', { context, timestamp: Date.now() });
  }

  /**
   * Get operation history for session
   */
  getOperationHistory(sessionId: string): SandboxOperationContext[] {
    return this.operationHistory.filter(op => op.session.sessionId === sessionId);
  }

  /**
   * Get all operation history
   */
  getAllOperationHistory(): SandboxOperationContext[] {
    return [...this.operationHistory];
  }

  /**
   * Clear operation history
   */
  clearHistory(sessionId?: string): void {
    if (sessionId) {
      this.operationHistory = this.operationHistory.filter(
        op => op.session.sessionId !== sessionId
      );
    } else {
      this.operationHistory = [];
    }

    this.logger.info(`Cleared operation history${sessionId ? ` for session: ${sessionId}` : ''}`);
  }

  // ==================== Utility Methods ====================

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): {
    session: SandboxSession;
    operationsToday: number;
    avgOperationDuration: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const sessionOperations = this.getOperationHistory(sessionId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const operationsToday = sessionOperations.filter(op => op.timestamp >= today.getTime()).length;

    return {
      session,
      operationsToday,
      avgOperationDuration: this.config.maxOperationDuration / 2, // Placeholder
    };
  }

  /**
   * Validate selector for security
   */
  validateSelector(selector: string): { valid: boolean; reason?: string } {
    // Basic security checks for selectors
    const dangerousPatterns = [/javascript:/i, /data:/i, /vbscript:/i];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(selector)) {
        return {
          valid: false,
          reason: `Dangerous pattern detected in selector: ${pattern}`,
        };
      }
    }

    return { valid: true };
  }
}

/**
 * Sandbox events
 */
export interface SandboxEvents {
  'session:created': { session: SandboxSession; timestamp: number };
  'session:terminated': { session: SandboxSession; timestamp: number };
  'operation:recorded': { context: SandboxOperationContext; timestamp: number };
  'permission:denied': {
    sessionId: string;
    operation: UIOperationType;
    reason: string;
    timestamp: number;
  };
}

/**
 * Create a sandbox instance
 */
export function createSandbox(config?: Partial<SandboxConfig>): Sandbox {
  return new Sandbox(config);
}
