/**
 * ChildProcessIsolation - OS-level process isolation tests
 */

import { describe, it, expect, vi } from 'vitest';
import { ChildProcessIsolation } from '../ChildProcessIsolation.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ChildProcessIsolation', () => {
  describe('execute', () => {
    it('should execute a self-contained handler in a child process', async () => {
      const isolation = new ChildProcessIsolation();
      const result = await isolation.execute(
        { taskName: 'multiply', payload: { a: 6, b: 7 } },
        payload => payload.a * payload.b
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should support async handlers', async () => {
      const isolation = new ChildProcessIsolation();
      const result = await isolation.execute(
        { taskName: 'async-task', payload: { n: 21 } },
        async payload => {
          // Note: the handler runs in a vm sandbox where only standard
          // ECMAScript built-ins (Promise, etc.) are available
          const doubled = await Promise.resolve(payload.n * 2);
          return doubled;
        }
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should capture handler errors', async () => {
      const isolation = new ChildProcessIsolation();
      const result = await isolation.execute({ taskName: 'fail', payload: {} }, () => {
        throw new Error('child boom');
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HANDLER_ERROR');
      expect(result.error?.message).toContain('child boom');
    });

    it('should capture rejected promises', async () => {
      const isolation = new ChildProcessIsolation();
      const result = await isolation.execute({ taskName: 'reject', payload: {} }, async () => {
        throw new Error('child rejected');
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HANDLER_ERROR');
      expect(result.error?.message).toContain('child rejected');
    });
  });

  describe('timeout', () => {
    it('should enforce the process-level timeout', async () => {
      const isolation = new ChildProcessIsolation({ defaultTimeout: 200 });
      const result = await isolation.execute(
        { taskName: 'slow', payload: {} },
        // A promise that never settles -> worker never returns a result,
        // so the parent must kill the child via the process-level timeout
        () => new Promise(() => {})
      );
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    }, 10000);
  });

  describe('concurrency', () => {
    it('should limit concurrent child processes', async () => {
      const isolation = new ChildProcessIsolation({ maxConcurrent: 1 });

      // CPU-bound handler that uses no sandbox-unavailable globals
      const handler = () => {
        let i = 0;
        while (i < 5e7) {
          i++;
        }
        return i;
      };

      let maxObserved = 0;
      const p1 = isolation.execute({ taskName: 'a', payload: {} }, handler);
      const p2 = isolation.execute({ taskName: 'b', payload: {} }, handler);

      // The semaphore must never hand out more than maxConcurrent slots
      const pollTimer = setInterval(() => {
        maxObserved = Math.max(maxObserved, isolation.getActiveCount());
      }, 1);

      await Promise.all([p1, p2]);
      clearInterval(pollTimer);

      expect(maxObserved).toBeLessThanOrEqual(1);
      expect(isolation.getActiveCount()).toBe(0);
    }, 30000);

    it('should track active count', async () => {
      const isolation = new ChildProcessIsolation();
      const pending = isolation.execute({ taskName: 'a', payload: {} }, () => {
        let i = 0;
        while (i < 2e7) {
          i++;
        }
        return i;
      });
      expect(isolation.getActiveCount()).toBe(1);
      await pending;
      expect(isolation.getActiveCount()).toBe(0);
    });
  });

  describe('isAvailable', () => {
    it('should report availability', () => {
      const isolation = new ChildProcessIsolation();
      expect(isolation.isAvailable()).toBe(true);
    });
  });

  describe('name', () => {
    it('should be child-process', () => {
      const isolation = new ChildProcessIsolation();
      expect(isolation.name).toBe('child-process');
    });
  });
});
