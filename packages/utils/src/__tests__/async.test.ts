import { describe, it, expect, vi } from 'vitest';
import { sleep, withRetry, withTimeout, withConcurrencyLimit, AsyncQueue } from '../utils/async.js';

describe('async utilities', () => {
  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should resolve with undefined', async () => {
      const result = await sleep(10);
      expect(result).toBeUndefined();
    });
  });

  describe('withRetry', () => {
    it('should return result on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxAttempts: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use custom retry options', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(
        withRetry(fn, {
          maxAttempts: 5,
          initialDelay: 10,
          maxDelay: 100,
          multiplier: 2,
        })
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail 1')).mockResolvedValue('success');

      const onRetry = vi.fn();

      await withRetry(fn, { maxAttempts: 3, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
    });

    it('should work without jitter', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail 1')).mockResolvedValue('success');

      const result = await withRetry(fn, { jitter: false });
      expect(result).toBe('success');
    });

    it('should handle non-Error rejections', async () => {
      const fn = vi.fn().mockRejectedValue('string error');

      await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow('string error');
    });
  });

  describe('withTimeout', () => {
    it('should return result if resolved within timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, { timeout: 1000 });
      expect(result).toBe('success');
    });

    it('should reject if timeout exceeded', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('delayed'), 100));
      await expect(withTimeout(promise, { timeout: 10 })).rejects.toThrow('Operation timed out');
    });

    it('should use custom error message', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('delayed'), 100));
      await expect(
        withTimeout(promise, { timeout: 10, message: 'Custom timeout' })
      ).rejects.toThrow('Custom timeout');
    });

    it('should work with rejected promise', async () => {
      const promise = Promise.reject(new Error('original error'));
      await expect(withTimeout(promise, { timeout: 100 })).rejects.toThrow('original error');
    });
  });

  describe('withConcurrencyLimit', () => {
    it('should execute single promise', async () => {
      const tasks = [
        async () => {
          await sleep(10);
          return 1;
        },
      ];
      const result = await withConcurrencyLimit(tasks, 2);
      expect(result).toEqual([1]);
    });

    it('should handle empty array', async () => {
      const result = await withConcurrencyLimit([], 2);
      expect(result).toEqual([]);
    });

    it('should handle limit of 1', async () => {
      const results: number[] = [];
      const createTask = (id: number) => async () => {
        await sleep(5);
        results.push(id);
        return id;
      };

      const tasks = [createTask(1), createTask(2), createTask(3)];
      await withConcurrencyLimit(tasks, 1);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle promise rejections', async () => {
      const tasks = [
        async () => {
          await sleep(10);
          return 1;
        },
        async () => {
          throw new Error('task failed');
        },
      ];

      await expect(withConcurrencyLimit(tasks, 2)).rejects.toThrow('task failed');
    });
  });

  describe('AsyncQueue', () => {
    it('should process tasks in order', async () => {
      const queue = new AsyncQueue();
      const results: number[] = [];

      queue.enqueue(async () => {
        await sleep(10);
        results.push(1);
        return 1;
      });

      queue.enqueue(async () => {
        await sleep(5);
        results.push(2);
        return 2;
      });

      queue.enqueue(async () => {
        results.push(3);
        return 3;
      });

      await sleep(50);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle errors without blocking subsequent tasks', async () => {
      const queue = new AsyncQueue();
      const results: number[] = [];

      const errorPromise = queue.enqueue(async () => {
        await sleep(10);
        throw new Error('task error');
      });

      errorPromise.catch(() => {});

      const successPromise = queue.enqueue(async () => {
        results.push(1);
        return 1;
      });

      await expect(successPromise).resolves.toBe(1);
    });

    it('should process empty queue', async () => {
      const queue = new AsyncQueue();
      const result = await queue.enqueue(async () => {
        await sleep(10);
        return 'done';
      });
      expect(result).toBe('done');
    });
  });
});
