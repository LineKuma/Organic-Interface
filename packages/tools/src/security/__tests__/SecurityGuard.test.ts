/**
 * SecurityGuard Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecurityGuard, createSecurityGuard } from '../SecurityGuard.js';

describe('SecurityGuard', () => {
  let guard: SecurityGuard;

  beforeEach(() => {
    guard = new SecurityGuard();
  });

  afterEach(() => {
    guard.removeAllListeners();
  });

  describe('construction', () => {
    it('should create with default preset (plan)', () => {
      expect(guard.getPreset()).toBe('plan');
      expect(guard.getPermissionLevel()).toBe('L1');
    });

    it('should create with custom preset', () => {
      const custom = new SecurityGuard({ preset: 'work' });
      expect(custom.getPreset()).toBe('work');
      expect(custom.getPermissionLevel()).toBe('L3');
    });

    it('should create via factory function', () => {
      const g = createSecurityGuard();
      expect(g).toBeInstanceOf(SecurityGuard);
    });
  });

  describe('preset management', () => {
    it('should get current preset', () => {
      expect(guard.getPreset()).toBe('plan');
    });

    it('should get preset config', () => {
      const config = guard.getPresetConfig();
      expect(config.preset).toBe('plan');
      expect(config.permissionLevel).toBe('L1');
      expect(config.requiresApproval).toBe(true);
    });

    it('should get permission level', () => {
      expect(guard.getPermissionLevel()).toBe('L1');
    });

    it('should switch to a higher preset when escalation is allowed', () => {
      const result = guard.switchPreset('create');
      expect(result).toBe(true);
      expect(guard.getPreset()).toBe('create');
    });

    it('should block escalation when allowEscalation is false', () => {
      const strict = new SecurityGuard({ preset: 'plan', allowEscalation: false });
      const result = strict.switchPreset('work');
      expect(result).toBe(false);
      expect(strict.getPreset()).toBe('plan');
    });

    it('should allow downgrading regardless of escalation setting', () => {
      const high = new SecurityGuard({ preset: 'work', allowEscalation: false });
      const result = high.switchPreset('plan');
      expect(result).toBe(true);
      expect(high.getPreset()).toBe('plan');
    });

    it('should return true when switching to same preset', () => {
      expect(guard.switchPreset('plan')).toBe(true);
    });

    it('should emit preset:changed event', () => {
      const onChange = vi.fn();
      guard.on('preset:changed', onChange);

      guard.switchPreset('work');
      expect(onChange).toHaveBeenCalledWith('work', 'plan');
    });
  });

  describe('isAtLeast', () => {
    it('should return true when current preset is higher', () => {
      const high = new SecurityGuard({ preset: 'work' });
      expect(high.isAtLeast('plan')).toBe(true);
      expect(high.isAtLeast('create')).toBe(true);
      expect(high.isAtLeast('work')).toBe(true);
    });

    it('should return false when current preset is lower', () => {
      expect(guard.isAtLeast('create')).toBe(false);
      expect(guard.isAtLeast('work')).toBe(false);
      expect(guard.isAtLeast('yolo')).toBe(false);
    });
  });

  describe('checkOperation', () => {
    it('should allow read in plan preset', () => {
      const result = guard.checkOperation('tool-1', 'read');
      expect(result.allowed).toBe(true);
    });

    it('should deny write in plan preset', () => {
      const result = guard.checkOperation('tool-1', 'write');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
      expect(result.reason).toContain('plan');
    });

    it('should deny execute in plan preset', () => {
      const result = guard.checkOperation('tool-1', 'execute');
      expect(result.allowed).toBe(false);
    });

    it('should deny filesystem in plan preset', () => {
      const result = guard.checkOperation('tool-1', 'filesystem');
      expect(result.allowed).toBe(false);
    });

    it('should deny network in plan preset', () => {
      const result = guard.checkOperation('tool-1', 'network');
      expect(result.allowed).toBe(false);
    });

    it('should emit operation:blocked when denied', () => {
      const onBlocked = vi.fn();
      guard.on('operation:blocked', onBlocked);

      guard.checkOperation('tool-1', 'write');
      expect(onBlocked).toHaveBeenCalledTimes(1);
      expect(onBlocked.mock.calls[0][0].toolId).toBe('tool-1');
      expect(onBlocked.mock.calls[0][0].operation).toBe('write');
    });

    it('should emit operation:allowed when allowed', () => {
      const onAllowed = vi.fn();
      guard.on('operation:allowed', onAllowed);

      guard.checkOperation('tool-1', 'read');
      expect(onAllowed).toHaveBeenCalledTimes(1);
      expect(onAllowed.mock.calls[0][0].toolId).toBe('tool-1');
    });
  });

  describe('authorize', () => {
    it('should deny when operation is not allowed', async () => {
      const response = await guard.authorize('tool-1', {}, 'write', {});
      expect(response.approved).toBe(false);
      expect(response.reason).toContain('not allowed');
    });

    it('should auto-approve in YOLO preset', async () => {
      const yolo = new SecurityGuard({ preset: 'yolo' });
      const response = await yolo.authorize('tool-1', {}, 'read', {});
      expect(response.approved).toBe(true);
      expect(response.reason).toContain('YOLO');
    });

    it('should deny when no approval listeners in non-YOLO preset', async () => {
      const response = await guard.authorize('tool-1', {}, 'read', {});
      expect(response.approved).toBe(false);
      expect(response.reason).toContain('No approval handler');
    });
  });

  describe('approve/deny delegation', () => {
    it('should delegate approve to approval service', async () => {
      const approvalService = guard.getApprovalService();
      approvalService.on('approval:requested', () => {});

      const promise = guard.authorize('tool-1', {}, 'read', {});
      const requestId = approvalService.getPendingRequests()[0].id;

      const result = guard.approve(requestId, 'Approved');
      expect(result).toBe(true);

      const response = await promise;
      expect(response.approved).toBe(true);
    });

    it('should delegate deny to approval service', async () => {
      const approvalService = guard.getApprovalService();
      approvalService.on('approval:requested', () => {});

      const promise = guard.authorize('tool-1', {}, 'read', {});
      const requestId = approvalService.getPendingRequests()[0].id;

      const result = guard.deny(requestId, 'Denied');
      expect(result).toBe(true);

      const response = await promise;
      expect(response.approved).toBe(false);
    });
  });

  describe('getApprovalService', () => {
    it('should return the approval service instance', () => {
      const approvalService = guard.getApprovalService();
      expect(approvalService).toBeDefined();
      expect(typeof approvalService.requestApproval).toBe('function');
    });
  });

  describe('getPendingApprovals', () => {
    it('should return empty array when no pending', () => {
      expect(guard.getPendingApprovals()).toEqual([]);
    });

    it('should return pending approvals', async () => {
      const approvalService = guard.getApprovalService();
      approvalService.on('approval:requested', () => {});

      guard.authorize('tool-1', {}, 'read', {});

      const pending = guard.getPendingApprovals();
      expect(pending).toHaveLength(1);
      expect(pending[0].toolId).toBe('tool-1');

      // Clean up
      guard.approve(pending[0].id);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = guard.getStats();
      expect(stats.preset).toBe('plan');
      expect(stats.permissionLevel).toBe('L1');
      expect(stats.requiresApproval).toBe(true);
      expect(stats.operationCount).toBe(0);
      expect(stats.pendingApprovals).toBe(0);
    });

    it('should track operation count', () => {
      guard.checkOperation('tool-1', 'read');
      guard.checkOperation('tool-2', 'read');
      expect(guard.getStats().operationCount).toBe(2);
    });

    it('should reflect preset changes', () => {
      guard.switchPreset('work');
      const stats = guard.getStats();
      expect(stats.preset).toBe('work');
      expect(stats.permissionLevel).toBe('L3');
    });
  });

  describe('preset path validation', () => {
    it('should allow plan -> create -> work -> yolo escalation', () => {
      const g = new SecurityGuard({ preset: 'plan' });
      expect(g.switchPreset('create')).toBe(true);
      expect(g.switchPreset('work')).toBe(true);
      expect(g.switchPreset('yolo')).toBe(true);
    });

    it('should allow yolo -> work -> create -> plan downgrade', () => {
      const g = new SecurityGuard({ preset: 'yolo' });
      expect(g.switchPreset('work')).toBe(true);
      expect(g.switchPreset('create')).toBe(true);
      expect(g.switchPreset('plan')).toBe(true);
    });
  });
});
