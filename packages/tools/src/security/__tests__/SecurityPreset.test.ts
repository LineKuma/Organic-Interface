/**
 * SecurityPreset Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SECURITY_PRESETS,
  getPresetConfig,
  presetAllowsOperation,
  getPresetNames,
  getPresetByPermissionLevel,
} from '../SecurityPreset.js';
import type { SecurityPreset } from '../../types/index.js';

describe('SecurityPreset', () => {
  describe('SECURITY_PRESETS', () => {
    it('should have all four presets defined', () => {
      expect(Object.keys(SECURITY_PRESETS)).toHaveLength(4);
      expect(SECURITY_PRESETS.plan).toBeDefined();
      expect(SECURITY_PRESETS.create).toBeDefined();
      expect(SECURITY_PRESETS.work).toBeDefined();
      expect(SECURITY_PRESETS.yolo).toBeDefined();
    });

    it('plan preset should be read-only with L1 permission', () => {
      const config = SECURITY_PRESETS.plan;
      expect(config.preset).toBe('plan');
      expect(config.permissionLevel).toBe('L1');
      expect(config.allowedOperations).toEqual(['read']);
      expect(config.requiresApproval).toBe(true);
      expect(config.description).toContain('Read-only');
    });

    it('create preset should allow read/write/filesystem with L2 permission', () => {
      const config = SECURITY_PRESETS.create;
      expect(config.preset).toBe('create');
      expect(config.permissionLevel).toBe('L2');
      expect(config.allowedOperations).toEqual(['read', 'write', 'filesystem']);
      expect(config.requiresApproval).toBe(true);
    });

    it('work preset should allow all operations with L3 permission', () => {
      const config = SECURITY_PRESETS.work;
      expect(config.preset).toBe('work');
      expect(config.permissionLevel).toBe('L3');
      expect(config.allowedOperations).toContain('read');
      expect(config.allowedOperations).toContain('write');
      expect(config.allowedOperations).toContain('execute');
      expect(config.allowedOperations).toContain('filesystem');
      expect(config.allowedOperations).toContain('network');
      expect(config.requiresApproval).toBe(true);
    });

    it('yolo preset should allow all operations without approval', () => {
      const config = SECURITY_PRESETS.yolo;
      expect(config.preset).toBe('yolo');
      expect(config.permissionLevel).toBe('L4');
      expect(config.allowedOperations).toHaveLength(5);
      expect(config.requiresApproval).toBe(false);
      expect(config.description).toContain('YOLO');
    });
  });

  describe('getPresetConfig', () => {
    it('should return the correct config for each preset', () => {
      const presets: SecurityPreset[] = ['plan', 'create', 'work', 'yolo'];
      for (const preset of presets) {
        const config = getPresetConfig(preset);
        expect(config.preset).toBe(preset);
      }
    });
  });

  describe('presetAllowsOperation', () => {
    it('should allow read operations in plan preset', () => {
      expect(presetAllowsOperation('plan', 'read')).toBe(true);
    });

    it('should deny write operations in plan preset', () => {
      expect(presetAllowsOperation('plan', 'write')).toBe(false);
      expect(presetAllowsOperation('plan', 'execute')).toBe(false);
      expect(presetAllowsOperation('plan', 'filesystem')).toBe(false);
      expect(presetAllowsOperation('plan', 'network')).toBe(false);
    });

    it('should allow read/write/filesystem in create preset', () => {
      expect(presetAllowsOperation('create', 'read')).toBe(true);
      expect(presetAllowsOperation('create', 'write')).toBe(true);
      expect(presetAllowsOperation('create', 'filesystem')).toBe(true);
    });

    it('should deny execute/network in create preset', () => {
      expect(presetAllowsOperation('create', 'execute')).toBe(false);
      expect(presetAllowsOperation('create', 'network')).toBe(false);
    });

    it('should allow all operations in work preset', () => {
      const ops: ToolPermissionType[] = ['read', 'write', 'execute', 'filesystem', 'network'];
      for (const op of ops) {
        expect(presetAllowsOperation('work', op)).toBe(true);
      }
    });

    it('should allow all operations in yolo preset', () => {
      const ops: ToolPermissionType[] = ['read', 'write', 'execute', 'filesystem', 'network'];
      for (const op of ops) {
        expect(presetAllowsOperation('yolo', op)).toBe(true);
      }
    });
  });

  describe('getPresetNames', () => {
    it('should return all four preset names', () => {
      const names = getPresetNames();
      expect(names).toHaveLength(4);
      expect(names).toContain('plan');
      expect(names).toContain('create');
      expect(names).toContain('work');
      expect(names).toContain('yolo');
    });
  });

  describe('getPresetByPermissionLevel', () => {
    it('should map L1 to plan', () => {
      expect(getPresetByPermissionLevel('L1')).toBe('plan');
    });

    it('should map L2 to create', () => {
      expect(getPresetByPermissionLevel('L2')).toBe('create');
    });

    it('should map L3 to work', () => {
      expect(getPresetByPermissionLevel('L3')).toBe('work');
    });

    it('should map L4 to yolo', () => {
      expect(getPresetByPermissionLevel('L4')).toBe('yolo');
    });

    it('should return null for unknown levels', () => {
      expect(getPresetByPermissionLevel('L5')).toBeNull();
      expect(getPresetByPermissionLevel('L0')).toBeNull();
      expect(getPresetByPermissionLevel('unknown')).toBeNull();
    });
  });
});
