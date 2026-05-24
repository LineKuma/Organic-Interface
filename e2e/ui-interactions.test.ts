import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { Progress, createProgress, type ProgressStyle } from '@organic/ui';

describe('UI Components', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  describe('Progress Component', () => {
    it('should create progress with default config', async () => {
      const progress = createProgress({ total: 100 });

      expect(progress).toBeDefined();
      expect(progress.getState().total).toBe(100);
    });

    it('should update progress state', async () => {
      const progress = createProgress({ total: 100, current: 0 });

      progress.start();
      const state = progress.update(50);

      expect(state.current).toBe(50);
      expect(state.percentage).toBe(50);
    });

    it('should complete progress at 100%', async () => {
      const progress = createProgress({ total: 100 });

      progress.start();
      progress.update(100);

      const state = progress.getState();
      expect(state.completed).toBe(true);
      expect(state.percentage).toBe(100);
    });

    it('should increment progress', async () => {
      const progress = createProgress({ total: 100, current: 0 });

      progress.start();
      progress.increment(25);

      expect(progress.getState().current).toBe(25);
    });

    it('should show elapsed time', async () => {
      const progress = createProgress({ total: 100, showElapsed: true });

      progress.start();
      progress.update(50);

      const state = progress.getState();
      expect(state.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle different styles', async () => {
      const styles: ProgressStyle[] = ['bar', 'spinner', 'dots', 'percentage'];

      for (const style of styles) {
        const progress = createProgress({ total: 100, style });
        progress.start();
        progress.update(50);
        progress.stop();

        const state = progress.getState();
        expect(state.current).toBe(50);
      }
    });

    it('should track remaining time estimate', async () => {
      const progress = createProgress({ total: 100 });

      progress.start();
      progress.update(25);

      const state = progress.getState();
      expect(state.remaining).toBeDefined();
    });

    it('should stop progress', async () => {
      const progress = createProgress({ total: 100 });

      progress.start();
      progress.update(50);
      progress.stop();

      const state = progress.getState();
      expect(state.current).toBe(50);
    });
  });
});