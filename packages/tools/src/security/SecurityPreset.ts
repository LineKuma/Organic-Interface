/**
 * Security Preset Definitions
 *
 * Maps each preset to its permission level, allowed operations, and approval requirements.
 *
 * Preset hierarchy:
 *   plan   (L1) - Read-only: read files, search, analyze. No modifications. Requires approval.
 *   create (L2) - Read-write: file read/write, no command execution. Requires approval.
 *   work   (L3) - Read-write-execute: all tools, shell commands. Requires approval.
 *   yolo   (L4) - Full access: all tools, NO approval required.
 */

import type { SecurityPreset, SecurityPresetConfig, ToolPermissionType } from '../types/index.js';

/**
 * All security preset configurations
 */
export const SECURITY_PRESETS: Record<SecurityPreset, SecurityPresetConfig> = {
  plan: {
    preset: 'plan',
    permissionLevel: 'L1',
    allowedOperations: ['read'],
    requiresApproval: true,
    description:
      'Plan mode: Read-only. Can read files, search code, and analyze. No modifications allowed.',
  },
  create: {
    preset: 'create',
    permissionLevel: 'L2',
    allowedOperations: ['read', 'write', 'filesystem'],
    requiresApproval: true,
    description:
      'Create mode: Read-write. Can read and write files, create directories. No command execution.',
  },
  work: {
    preset: 'work',
    permissionLevel: 'L3',
    allowedOperations: ['read', 'write', 'execute', 'filesystem', 'network'],
    requiresApproval: true,
    description:
      'Work mode: Read-write-execute. Full tool access including shell commands. Requires approval.',
  },
  yolo: {
    preset: 'yolo',
    permissionLevel: 'L4',
    allowedOperations: ['read', 'write', 'execute', 'filesystem', 'network'],
    requiresApproval: false,
    description:
      'YOLO mode: Unrestricted. Full access to all tools without any approval requirements.',
  },
};

/**
 * Get the preset configuration for a given preset name
 */
export function getPresetConfig(preset: SecurityPreset): SecurityPresetConfig {
  return SECURITY_PRESETS[preset];
}

/**
 * Check if a given preset allows a specific operation type
 */
export function presetAllowsOperation(
  preset: SecurityPreset,
  operation: ToolPermissionType
): boolean {
  const config = SECURITY_PRESETS[preset];
  return config.allowedOperations.includes(operation);
}

/**
 * Get all preset names
 */
export function getPresetNames(): SecurityPreset[] {
  return Object.keys(SECURITY_PRESETS) as SecurityPreset[];
}

/**
 * Get the preset that maps to a given permission level.
 * Returns the most restrictive preset for that level.
 */
export function getPresetByPermissionLevel(level: string): SecurityPreset | null {
  switch (level) {
    case 'L1':
      return 'plan';
    case 'L2':
      return 'create';
    case 'L3':
      return 'work';
    case 'L4':
      return 'yolo';
    default:
      return null;
  }
}
