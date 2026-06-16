/**
 * SecurityGuard - Enforces security preset policies on tool executions
 *
 * Acts as the gatekeeper between tool execution requests and the active security preset.
 * Checks whether an operation is allowed under the current preset and manages
 * the approval flow for non-YOLO presets.
 */

import { createLogger, type Logger } from '@organic/utils';
import { EventEmitter } from 'events';
import type {
  SecurityPreset,
  SecurityPresetConfig,
  PermissionLevel,
  ToolPermissionType,
  ApprovalResponse,
} from '../types/index.js';
import { getPresetConfig } from './SecurityPreset.js';
import { ApprovalService } from './ApprovalService.js';

/**
 * SecurityGuard events
 */
export interface SecurityGuardEvents {
  /** Fired when the preset is changed */
  'preset:changed': [SecurityPreset, SecurityPreset];
  /** Fired when an operation is blocked by the security policy */
  'operation:blocked': [
    { toolId: string; operation: string; preset: SecurityPreset; reason: string },
  ];
  /** Fired when an operation is allowed */
  'operation:allowed': [{ toolId: string; operation: string; preset: SecurityPreset }];
}

/**
 * SecurityGuard configuration
 */
export interface SecurityGuardConfig {
  /** Initial security preset */
  preset: SecurityPreset;
  /** Approval service instance (created if not provided) */
  approvalService?: ApprovalService;
  /** Whether to allow preset escalation (e.g., plan -> create) */
  allowEscalation: boolean;
  /** Whether to log all security decisions */
  auditLog: boolean;
}

const DEFAULT_GUARD_CONFIG: SecurityGuardConfig = {
  preset: 'plan',
  allowEscalation: true,
  auditLog: true,
};

/**
 * SecurityGuard - Enforces preset-based security policies
 */
export class SecurityGuard extends EventEmitter {
  private config: SecurityGuardConfig;
  private readonly logger: Logger;
  private presetConfig: SecurityPresetConfig;
  private readonly approvalService: ApprovalService;
  private operationCount = 0;

  constructor(config: Partial<SecurityGuardConfig> = {}) {
    super();
    this.config = { ...DEFAULT_GUARD_CONFIG, ...config };
    this.logger = createLogger({ prefix: 'security-guard' });
    this.presetConfig = getPresetConfig(this.config.preset);
    this.approvalService = this.config.approvalService ?? new ApprovalService();

    this.logger.info(`SecurityGuard initialized with preset: ${this.config.preset}`);
  }

  // ── Preset Management ──────────────────────────────────────────

  /**
   * Get the current security preset
   */
  getPreset(): SecurityPreset {
    return this.config.preset;
  }

  /**
   * Get the current preset configuration
   */
  getPresetConfig(): SecurityPresetConfig {
    return this.presetConfig;
  }

  /**
   * Get the current permission level
   */
  getPermissionLevel(): PermissionLevel {
    return this.presetConfig.permissionLevel;
  }

  /**
   * Switch to a different security preset
   *
   * For plan -> create -> work -> yolo, escalation requires allowEscalation=true.
   * Downgrading (yolo -> work -> create -> plan) is always allowed.
   */
  switchPreset(newPreset: SecurityPreset): boolean {
    if (newPreset === this.config.preset) {
      return true;
    }

    const currentIndex = this.getPresetIndex(this.config.preset);
    const newIndex = this.getPresetIndex(newPreset);

    // Escalating (going to a higher privilege level)
    if (newIndex > currentIndex && !this.config.allowEscalation) {
      this.logger.warn(`Preset escalation blocked: ${this.config.preset} -> ${newPreset}`);
      return false;
    }

    const oldPreset = this.config.preset;
    this.config.preset = newPreset;
    this.presetConfig = getPresetConfig(newPreset);

    this.logger.info(`Preset switched: ${oldPreset} -> ${newPreset}`);
    this.emit('preset:changed', newPreset, oldPreset);
    return true;
  }

  /**
   * Check if the current preset is at least the given level
   */
  isAtLeast(preset: SecurityPreset): boolean {
    const current = this.getPresetIndex(this.config.preset);
    const target = this.getPresetIndex(preset);
    return current >= target;
  }

  // ── Operation Authorization ────────────────────────────────────

  /**
   * Check if an operation is allowed under the current preset.
   * Returns the reason if blocked, or null if allowed.
   */
  checkOperation(toolId: string, operation: string): { allowed: boolean; reason?: string } {
    const allowedOps = this.presetConfig.allowedOperations;

    if (!allowedOps.includes(operation as ToolPermissionType)) {
      const reason =
        `Operation '${operation}' not allowed in '${this.config.preset}' preset. ` +
        `Allowed: [${allowedOps.join(', ')}]`;
      this.logger.warn(`Blocked: ${toolId} - ${reason}`);
      this.emit('operation:blocked', {
        toolId,
        operation,
        preset: this.config.preset,
        reason,
      });
      return { allowed: false, reason };
    }

    this.operationCount++;
    this.emit('operation:allowed', { toolId, operation, preset: this.config.preset });
    return { allowed: true };
  }

  /**
   * Authorize a tool execution. Checks permissions first, then requests
   * approval if required by the current preset.
   *
   * @returns The approval response (or immediate allow for YOLO)
   */
  async authorize(
    toolId: string,
    input: unknown,
    operation: string,
    metadata?: Record<string, unknown>
  ): Promise<ApprovalResponse> {
    // Step 1: Check if the operation is allowed
    const check = this.checkOperation(toolId, operation);
    if (!check.allowed) {
      return {
        approved: false,
        reason: check.reason,
        timestamp: Date.now(),
      };
    }

    // Step 2: Check if approval is required
    if (!this.presetConfig.requiresApproval) {
      // YOLO mode - no approval needed
      this.logger.debug(`Auto-approved (YOLO): ${toolId}`);
      return {
        approved: true,
        reason: 'Auto-approved (YOLO preset)',
        timestamp: Date.now(),
      };
    }

    // Step 3: Request human approval
    return this.approvalService.requestApproval(
      toolId,
      input,
      this.config.preset,
      operation,
      metadata
    );
  }

  /**
   * Approve a pending approval request
   */
  approve(requestId: string, reason?: string): boolean {
    return this.approvalService.approve(requestId, reason);
  }

  /**
   * Deny a pending approval request
   */
  deny(requestId: string, reason?: string): boolean {
    return this.approvalService.deny(requestId, reason);
  }

  // ── Approval Service Access ────────────────────────────────────

  /**
   * Get the approval service instance
   */
  getApprovalService(): ApprovalService {
    return this.approvalService;
  }

  /**
   * Get pending approval requests
   */
  getPendingApprovals() {
    return this.approvalService.getPendingRequests();
  }

  // ── Statistics ─────────────────────────────────────────────────

  /**
   * Get guard statistics
   */
  getStats() {
    return {
      preset: this.config.preset,
      permissionLevel: this.presetConfig.permissionLevel,
      requiresApproval: this.presetConfig.requiresApproval,
      operationCount: this.operationCount,
      pendingApprovals: this.approvalService.getPendingCount(),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private getPresetIndex(preset: SecurityPreset): number {
    const presets: SecurityPreset[] = ['plan', 'create', 'work', 'yolo'];
    return presets.indexOf(preset);
  }
}

/**
 * Create a SecurityGuard instance
 */
export function createSecurityGuard(config?: Partial<SecurityGuardConfig>): SecurityGuard {
  return new SecurityGuard(config);
}
