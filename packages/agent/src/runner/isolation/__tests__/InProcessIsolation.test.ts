/**
 * InProcessIsolation - Logical isolation in current process tests
 */

import { describe, it, expect, vi } from 'vitest';
import { InProcessIsolation } from '../InProcessIsolation.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('InProcessIsolation', () => {
  describe('execute', () => {
    it('should execute a handler and return its result', async () => {
      const isolation = new InProcessIsolation();
      const result = await isolation.execute(
        { taskName: 'sum', payload: { a: 1, b: 2 } },
        payload => payload.a + payload.b
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should support async handlers', async () => {
      const isolation = new InProcessIsolation();
      const result = await isolation.execute(
        { taskName: 'async-task', payload: { n: 5 } },
        async payload => {
          await new Promise(r => setTimeout(r, 10));
          return payload.n * 2;
        }
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(10);
    });

    it('should capture handler errors', async () => {
      const isolation = new InProcessIsolation();
      const result = await isolation.execute({ taskName: 'fail', payload: {} }, () => {
        throw new Error('boom');
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toBe('boom');
    });

    it('should capture rejected promises', async () => {
      const isolation = new InProcessIsolation();
      const result = await isolation.execute({ taskName: 'reject', payload: {} }, async () => {
        throw new Error('rejected');
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('rejected');
    });

    it('should enforce timeout', async () => {
      const isolation = new InProcessIsolation({ defaultTimeout: 50 });
      const result = await isolation.execute({ taskName: 'slow', payload: {} }, async () => {
        await new Promise(r => setTimeout(r, 500));
        return 'late';
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });
  });

  describe('gating', () => {
    it('should forbid explicitly forbidden task names', async () => {
      const isolation = new InProcessIsolation({ forbiddenTaskNames: ['dangerous'] });
      const result = await isolation.execute(
        { taskName: 'dangerous', payload: {} },
        () => 'should not run'
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should reject non-permitted task names', async () => {
      const isolation = new InProcessIsolation({ permittedTaskNames: ['allowed'] });
      const result = await isolation.execute(
        { taskName: 'other', payload: {} },
        () => 'should not run'
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should allow permitted task names', async () => {
      const isolation = new InProcessIsolation({ permittedTaskNames: ['allowed'] });
      const result = await isolation.execute({ taskName: 'allowed', payload: {} }, () => 'ran');
      expect(result.success).toBe(true);
      expect(result.data).toBe('ran');
    });
  });

  describe('concurrency', () => {
    it('should limit concurrent executions', async () => {
      const isolation = new InProcessIsolation({ maxConcurrent: 1 });
      let active = 0;
      let maxActive = 0;

      const handler = async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 20));
        active--;
        return 'done';
      };

      await Promise.all([
        isolation.execute({ taskName: 'a', payload: {} }, handler),
        isolation.execute({ taskName: 'b', payload: {} }, handler),
        isolation.execute({ taskName: 'c', payload: {} }, handler),
      ]);

      expect(maxActive).toBe(1);
      expect(isolation.getActiveCount()).toBe(0);
    });

    it('should track active count', async () => {
      const isolation = new InProcessIsolation();
      const pending = isolation.execute({ taskName: 'a', payload: {} }, async () => {
        await new Promise(r => setTimeout(r, 30));
        return 1;
      });
      expect(isolation.getActiveCount()).toBe(1);
      await pending;
      expect(isolation.getActiveCount()).toBe(0);
    });
  });

  describe('isAvailable', () => {
    it('should always be available', () => {
      const isolation = new InProcessIsolation();
      expect(isolation.isAvailable()).toBe(true);
    });
  });

  describe('name', () => {
    it('should be in-process', () => {
      const isolation = new InProcessIsolation();
      expect(isolation.name).toBe('in-process');
    });
  });
});
