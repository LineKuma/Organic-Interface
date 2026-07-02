/**
 * ApprovalService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApprovalService, createApprovalService } from '../ApprovalService.js';
import type { ApprovalRequest } from '../../types/index.js';

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(() => {
    service = new ApprovalService();
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  describe('construction', () => {
    it('should create with default config', () => {
      expect(service.hasListeners()).toBe(false);
      expect(service.getPendingCount()).toBe(0);
    });

    it('should create with autoApproveOnNoListeners', async () => {
      const autoService = new ApprovalService({ autoApproveOnNoListeners: true });
      const response = await autoService.requestApproval(
        'tool-1',
        { key: 'value' },
        'plan',
        'read'
      );
      expect(response.approved).toBe(true);
      expect(response.reason).toContain('auto-approved');
    });

    it('should create via factory function', () => {
      const s = createApprovalService();
      expect(s).toBeInstanceOf(ApprovalService);
    });
  });

  describe('requestApproval', () => {
    it('should deny when no listeners and autoApproveOnNoListeners is false', async () => {
      const response = await service.requestApproval('tool-1', { key: 'value' }, 'plan', 'read');
      expect(response.approved).toBe(false);
      expect(response.reason).toContain('No approval handler');
    });

    it('should create a pending request when listeners are registered', async () => {
      service.on('approval:requested', () => {
        // Listener registered but not handling
      });

      const promise = service.requestApproval('tool-1', { key: 'value' }, 'plan', 'read');
      expect(service.getPendingCount()).toBe(1);

      const requests = service.getPendingRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].toolId).toBe('tool-1');
      expect(requests[0].preset).toBe('plan');
      expect(requests[0].operation).toBe('read');

      // Clean up by approving
      service.approve(requests[0].id);
      await promise;
    });
  });

  describe('approve', () => {
    it('should approve a pending request', async () => {
      const requests: ApprovalRequest[] = [];
      service.on('approval:requested', req => requests.push(req));

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      const requestId = service.getPendingRequests()[0].id;

      const result = service.approve(requestId, 'Looks good');
      expect(result).toBe(true);

      const response = await promise;
      expect(response.approved).toBe(true);
      expect(response.reason).toBe('Looks good');
      expect(service.getPendingCount()).toBe(0);
    });

    it('should approve with default reason when none provided', async () => {
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      const requestId = service.getPendingRequests()[0].id;

      service.approve(requestId);
      const response = await promise;
      expect(response.approved).toBe(true);
      expect(response.reason).toBe('Approved by user');
    });

    it('should return false for non-existent request', () => {
      expect(service.approve('non-existent')).toBe(false);
    });
  });

  describe('deny', () => {
    it('should deny a pending request', async () => {
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      const requestId = service.getPendingRequests()[0].id;

      const result = service.deny(requestId, 'Not safe');
      expect(result).toBe(true);

      const response = await promise;
      expect(response.approved).toBe(false);
      expect(response.reason).toBe('Not safe');
      expect(service.getPendingCount()).toBe(0);
    });

    it('should deny with default reason', async () => {
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      const requestId = service.getPendingRequests()[0].id;

      service.deny(requestId);
      const response = await promise;
      expect(response.approved).toBe(false);
      expect(response.reason).toBe('Denied by user');
    });

    it('should return false for non-existent request', () => {
      expect(service.deny('non-existent')).toBe(false);
    });
  });

  describe('approveAll', () => {
    it('should approve all pending requests', async () => {
      service.on('approval:requested', () => {});

      const promise1 = service.requestApproval('tool-1', {}, 'plan', 'read');
      const promise2 = service.requestApproval('tool-2', {}, 'plan', 'read');

      expect(service.getPendingCount()).toBe(2);

      const count = service.approveAll('Bulk approve');
      expect(count).toBe(2);
      expect(service.getPendingCount()).toBe(0);

      const [r1, r2] = await Promise.all([promise1, promise2]);
      expect(r1.approved).toBe(true);
      expect(r2.approved).toBe(true);
    });

    it('should return 0 when no pending requests', () => {
      expect(service.approveAll()).toBe(0);
    });
  });

  describe('denyAll', () => {
    it('should deny all pending requests', async () => {
      service.on('approval:requested', () => {});

      const promise1 = service.requestApproval('tool-1', {}, 'plan', 'read');
      const promise2 = service.requestApproval('tool-2', {}, 'plan', 'read');

      const count = service.denyAll('Bulk deny');
      expect(count).toBe(2);
      expect(service.getPendingCount()).toBe(0);

      const [r1, r2] = await Promise.all([promise1, promise2]);
      expect(r1.approved).toBe(false);
      expect(r2.approved).toBe(false);
    });

    it('should return 0 when no pending requests', () => {
      expect(service.denyAll()).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all pending requests as denied', async () => {
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      service.clearAll();

      expect(service.getPendingCount()).toBe(0);
      const response = await promise;
      expect(response.approved).toBe(false);
      expect(response.reason).toBe('Cleared');
    });
  });

  describe('timeout', () => {
    it('should timeout and deny pending requests', async () => {
      vi.useFakeTimers();

      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      expect(service.getPendingCount()).toBe(1);

      // Fast-forward past the default timeout (60s)
      vi.advanceTimersByTime(60001);

      const response = await promise;
      expect(response.approved).toBe(false);
      expect(response.reason).toContain('timed out');
      expect(service.getPendingCount()).toBe(0);

      vi.useRealTimers();
    });

    it('should not timeout when timeout is 0', async () => {
      const noTimeoutService = new ApprovalService({ defaultTimeout: 0 });
      noTimeoutService.on('approval:requested', () => {});

      const promise = noTimeoutService.requestApproval('tool-1', {}, 'plan', 'read');
      expect(noTimeoutService.getPendingCount()).toBe(1);

      // Clean up
      noTimeoutService.approve(noTimeoutService.getPendingRequests()[0].id);
      await promise;
      noTimeoutService.removeAllListeners();
    });
  });

  describe('events', () => {
    it('should emit approval:requested event', async () => {
      const onRequested = vi.fn();
      service.on('approval:requested', onRequested);

      service.on('approval:requested', () => {}); // Second listener to satisfy listener check
      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');

      expect(onRequested).toHaveBeenCalledTimes(1);
      const request: ApprovalRequest = onRequested.mock.calls[0][0];
      expect(request.toolId).toBe('tool-1');
      expect(request.preset).toBe('plan');
      expect(request.operation).toBe('read');

      service.approve(service.getPendingRequests()[0].id);
      await promise;
    });

    it('should emit approval:approved event', async () => {
      const onApproved = vi.fn();
      service.on('approval:approved', onApproved);
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      service.approve(service.getPendingRequests()[0].id);
      await promise;

      expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it('should emit approval:denied event', async () => {
      const onDenied = vi.fn();
      service.on('approval:denied', onDenied);
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      service.deny(service.getPendingRequests()[0].id);
      await promise;

      expect(onDenied).toHaveBeenCalledTimes(1);
    });

    it('should emit approval:timeout event', async () => {
      vi.useFakeTimers();

      const onTimeout = vi.fn();
      service.on('approval:timeout', onTimeout);
      service.on('approval:requested', () => {});

      const promise = service.requestApproval('tool-1', {}, 'plan', 'read');
      vi.advanceTimersByTime(60001);
      await promise;

      expect(onTimeout).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should emit approval:cleared event', () => {
      const onCleared = vi.fn();
      service.on('approval:cleared', onCleared);

      service.clearAll();
      expect(onCleared).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasListeners', () => {
    it('should return false when no listeners', () => {
      expect(service.hasListeners()).toBe(false);
    });

    it('should return true when listeners are registered', () => {
      service.on('approval:requested', () => {});
      expect(service.hasListeners()).toBe(true);
    });
  });

  describe('getPendingRequests', () => {
    it('should return empty array when no pending', () => {
      expect(service.getPendingRequests()).toEqual([]);
    });

    it('should return request objects', () => {
      service.on('approval:requested', () => {});
      service.requestApproval('tool-1', { key: 'val' }, 'plan', 'read');

      const requests = service.getPendingRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].toolId).toBe('tool-1');
      expect(requests[0].input).toEqual({ key: 'val' });
      expect(requests[0].id).toMatch(/^approval_\d+_\d+$/);
      expect(requests[0].timestamp).toBeGreaterThan(0);

      // Clean up
      service.approve(requests[0].id);
    });
  });
});
