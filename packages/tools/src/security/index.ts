/**
 * Security Module - Security presets, authorization, and approval management
 *
 * Provides:
 * - SecurityGuard: Enforces preset-based policies on tool executions
 * - ApprovalService: Human-in-the-loop approval for non-YOLO presets
 * - SecurityPreset: Preset definitions (plan/create/work/yolo)
 *
 * Preset Model:
 *   plan   (L1): Read-only. Requires approval.
 *   create (L2): Read-write. Requires approval.
 *   work   (L3): Read-write-execute. Requires approval.
 *   yolo   (L4): Full access. No approval needed.
 */

export {
  SecurityGuard,
  createSecurityGuard,
  type SecurityGuardConfig,
  type SecurityGuardEvents,
} from './SecurityGuard.js';

export {
  ApprovalService,
  createApprovalService,
  type ApprovalServiceConfig,
  type ApprovalServiceEvents,
} from './ApprovalService.js';

export {
  SECURITY_PRESETS,
  getPresetConfig,
  presetAllowsOperation,
  getPresetNames,
  getPresetByPermissionLevel,
} from './SecurityPreset.js';
