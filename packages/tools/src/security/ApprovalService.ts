/**
 * ApprovalService - Handles human-in-the-loop approval for tool executions
 *
 * When a tool execution requires approval (plan/create/work presets),
 * this service emits an approval request and waits for a human response.
 * YOLO preset bypasses this entirely.
 */

import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@organic/utils';
import type {
  ApprovalRequest,
  ApprovalResponse,
  SecurityPreset,
  ToolPermissionType,
} from '../types/index.js';

/**
 * ApprovalService events
 */
export interface ApprovalServiceEvents {
  /** Fired when a new approval request is created */
  'approval:requested': [ApprovalRequest];
  /** Fired when an approval request is approved */
  'approval:approved': [ApprovalRequest, ApprovalResponse];
  /** Fired when an approval request is denied */
  'approval:denied': [ApprovalRequest, ApprovalResponse];
  /** Fired when an approval request times out */
  'approval:timeout': [ApprovalRequest];
  /** Fired when all pending approvals are cleared */
  'approval:cleared': [];
}

/**
 * Pending approval entry
 */
interface PendingApproval {
  request: ApprovalRequest;
  resolve: (response: ApprovalResponse) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * ApprovalService configuration
 */
export interface ApprovalServiceConfig {
  /** Default timeout for approval requests in milliseconds (0 = no timeout) */
  defaultTimeout: number;
  /** Whether to auto-approve when no handler is listening (dangerous) */
  autoApproveOnNoListeners: boolean;
}

const DEFAULT_APPROVAL_CONFIG: ApprovalServiceConfig = {
  defaultTimeout: 60000, // 1 minute
  autoApproveOnNoListeners: false,
};

/**
 * ApprovalService - Manages human approval for tool executions
 */
export class ApprovalService extends EventEmitter {
  private readonly config: ApprovalServiceConfig;
  private readonly logger: Logger;
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private requestCounter = 0;

  constructor(config: Partial<ApprovalServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_APPROVAL_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'approval-service' });
  }

  /**
   * Request approval for a tool execution.
   * Returns a promise that resolves when approved or denied.
   */
  async requestApproval(
    toolId: string,
    input: unknown,
    preset: SecurityPreset,
    operation: ToolPermissionType,
    metadata?: Record<string, unknown>
  ): Promise<ApprovalResponse> {
    const request: ApprovalRequest = {
      id: `approval_${++this.requestCounter}_${Date.now()}`,
      toolId,
      input,
      preset,
      operation,
      timestamp: Date.now(),
      metadata,
    };

    this.logger.info(`Approval requested: ${toolId} (preset: ${preset}, op: ${operation})`);

    // Check if anyone is listening
    if (this.listenerCount('approval:requested') === 0) {
      if (this.config.autoApproveOnNoListeners) {
        this.logger.warn('No approval listeners, auto-approving');
        return { approved: true, reason: 'auto-approved (no listeners)', timestamp: Date.now() };
      }
      this.logger.warn('No approval listeners registered, denying by default');
      return { approved: false, reason: 'No approval handler registered', timestamp: Date.now() };
    }

    return new Promise<ApprovalResponse>(resolve => {
      const pending: PendingApproval = { request, resolve };

      // Set timeout if configured
      if (this.config.defaultTimeout > 0) {
        pending.timeoutId = setTimeout(() => {
          this.pendingApprovals.delete(request.id);
          this.emit('approval:timeout', request);
          this.logger.warn(`Approval timed out: ${request.id}`);
          resolve({
            approved: false,
            reason: `Approval timed out after ${this.config.defaultTimeout}ms`,
            timestamp: Date.now(),
          });
        }, this.config.defaultTimeout);
      }

      this.pendingApprovals.set(request.id, pending);
      this.emit('approval:requested', request);
    });
  }

  /**
   * Approve a pending approval request
   */
  approve(requestId: string, reason?: string): boolean {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      this.logger.warn(`Approval request not found: ${requestId}`);
      return false;
    }

    this.clearTimeout(pending);
    this.pendingApprovals.delete(requestId);

    const response: ApprovalResponse = {
      approved: true,
      reason: reason ?? 'Approved by user',
      timestamp: Date.now(),
    };

    this.emit('approval:approved', pending.request, response);
    pending.resolve(response);
    this.logger.info(`Approved: ${requestId}`);
    return true;
  }

  /**
   * Deny a pending approval request
   */
  deny(requestId: string, reason?: string): boolean {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      this.logger.warn(`Approval request not found: ${requestId}`);
      return false;
    }

    this.clearTimeout(pending);
    this.pendingApprovals.delete(requestId);

    const response: ApprovalResponse = {
      approved: false,
      reason: reason ?? 'Denied by user',
      timestamp: Date.now(),
    };

    this.emit('approval:denied', pending.request, response);
    pending.resolve(response);
    this.logger.info(`Denied: ${requestId}`);
    return true;
  }

  /**
   * Approve all pending requests
   */
  approveAll(reason?: string): number {
    let count = 0;
    for (const [id] of this.pendingApprovals) {
      if (this.approve(id, reason)) count++;
    }
    return count;
  }

  /**
   * Deny all pending requests
   */
  denyAll(reason?: string): number {
    let count = 0;
    for (const [id] of this.pendingApprovals) {
      if (this.deny(id, reason)) count++;
    }
    return count;
  }

  /**
   * Get all pending approval requests
   */
  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).map(p => p.request);
  }

  /**
   * Get the number of pending approval requests
   */
  getPendingCount(): number {
    return this.pendingApprovals.size;
  }

  /**
   * Clear all pending approvals (deny them)
   */
  clearAll(): void {
    for (const [id] of this.pendingApprovals) {
      this.deny(id, 'Cleared');
    }
    this.emit('approval:cleared', []);
  }

  /**
   * Check if there are approval listeners registered
   */
  hasListeners(): boolean {
    return this.listenerCount('approval:requested') > 0;
  }

  private clearTimeout(pending: PendingApproval): void {
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
      pending.timeoutId = undefined;
    }
  }
}

/**
 * Create an ApprovalService instance
 */
export function createApprovalService(config?: Partial<ApprovalServiceConfig>): ApprovalService {
  return new ApprovalService(config);
}
