/**
 * LifecycleManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager, LifecycleState } from '@organic/kernel/kernel/LifecycleManager';

describe('LifecycleManager', () => {
  let lifecycle: LifecycleManager;

  beforeEach(() => {
    lifecycle = new LifecycleManager();
  });

  describe('getState() - Get current state', () => {
    it('should return CREATED as initial state', () => {
      expect(lifecycle.getState()).toBe(LifecycleState.CREATED);
    });
  });

  describe('getPreviousState() - Get previous state', () => {
    it('should return null as initial previous state', () => {
      expect(lifecycle.getPreviousState()).toBeNull();
    });

    it('should return the state before last transition', async () => {
      await lifecycle.transition(LifecycleState.INITIALIZING);
      expect(lifecycle.getPreviousState()).toBe(LifecycleState.CREATED);

      await lifecycle.transition(LifecycleState.INITIALIZED);
      expect(lifecycle.getPreviousState()).toBe(LifecycleState.INITIALIZING);
    });
  });

  describe('isState() - Check specific state', () => {
    it('should return true for current state', () => {
      expect(lifecycle.isState(LifecycleState.CREATED)).toBe(true);
      expect(lifecycle.isState(LifecycleState.INITIALIZING)).toBe(false);
    });
  });

  describe('isAnyState() - Check multiple states', () => {
    it('should return true if in any of the specified states', () => {
      expect(lifecycle.isAnyState(LifecycleState.CREATED, LifecycleState.INITIALIZING)).toBe(true);
      expect(lifecycle.isAnyState(LifecycleState.INITIALIZING, LifecycleState.INITIALIZED)).toBe(false);
    });
  });

  describe('isRunning() - Check running state', () => {
    it('should return true only when in RUNNING state', async () => {
      expect(lifecycle.isRunning()).toBe(false);

      await lifecycle.transition(LifecycleState.INITIALIZING);
      expect(lifecycle.isRunning()).toBe(false);

      await lifecycle.transition(LifecycleState.INITIALIZED);
      expect(lifecycle.isRunning()).toBe(false);

      await lifecycle.transition(LifecycleState.STARTING);
      expect(lifecycle.isRunning()).toBe(false);

      await lifecycle.transition(LifecycleState.RUNNING);
      expect(lifecycle.isRunning()).toBe(true);
    });
  });

  describe('isActive() - Check active states', () => {
    it('should return true for INITIALIZED, RUNNING, or STARTING states', async () => {
      expect(lifecycle.isActive()).toBe(false);

      await lifecycle.transition(LifecycleState.INITIALIZED);
      expect(lifecycle.isActive()).toBe(true);

      await lifecycle.transition(LifecycleState.RUNNING);
      expect(lifecycle.isActive()).toBe(true);

      await lifecycle.transition(LifecycleState.STOPPING);
      expect(lifecycle.isActive()).toBe(false);
    });
  });

  describe('transition() - State transitions', () => {
    it('should transition to new state', async () => {
      await lifecycle.transition(LifecycleState.INITIALIZING);

      expect(lifecycle.getState()).toBe(LifecycleState.INITIALIZING);
      expect(lifecycle.getPreviousState()).toBe(LifecycleState.CREATED);
    });

    it('should include metadata in transition', async () => {
      const metadata = { plugins: ['plugin1', 'plugin2'] };

      await lifecycle.transition(LifecycleState.INITIALIZING, metadata);

      expect(lifecycle.getState()).toBe(LifecycleState.INITIALIZING);
    });

    it('should support async before transition hooks', async () => {
      const beforeHook = vi.fn();
      const lifecycleWithHook = new LifecycleManager({
        onBeforeTransition: beforeHook,
      });

      await lifecycleWithHook.transition(LifecycleState.INITIALIZING);

      expect(beforeHook).toHaveBeenCalledTimes(1);
      expect(beforeHook).toHaveBeenCalledWith(
        LifecycleState.CREATED,
        expect.objectContaining({
          from: LifecycleState.CREATED,
          to: LifecycleState.INITIALIZING,
        })
      );
    });

    it('should support async after transition hooks', async () => {
      const afterHook = vi.fn();
      const lifecycleWithHook = new LifecycleManager({
        onAfterTransition: afterHook,
      });

      await lifecycleWithHook.transition(LifecycleState.INITIALIZING);

      expect(afterHook).toHaveBeenCalledTimes(1);
      expect(afterHook).toHaveBeenCalledWith(
        LifecycleState.INITIALIZING,
        expect.objectContaining({
          from: LifecycleState.CREATED,
          to: LifecycleState.INITIALIZING,
        })
      );
    });

    it('should continue transitioning even if hooks fail', async () => {
      const failingHook = vi.fn(() => {
        throw new Error('Hook failed');
      });

      const lifecycleWithHook = new LifecycleManager({
        onBeforeTransition: failingHook,
      });

      // Should not throw
      await expect(
        lifecycleWithHook.transition(LifecycleState.INITIALIZING)
      ).resolves.not.toThrow();

      // State should still change
      expect(lifecycleWithHook.getState()).toBe(LifecycleState.INITIALIZING);
    });
  });

  describe('onBeforeTransition() - Register before hooks', () => {
    it('should register a before transition hook', async () => {
      const hook = vi.fn();
      lifecycle.onBeforeTransition(hook);

      await lifecycle.transition(LifecycleState.INITIALIZING);

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should support multiple before hooks', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      lifecycle.onBeforeTransition(hook1);
      lifecycle.onBeforeTransition(hook2);

      await lifecycle.transition(LifecycleState.INITIALIZING);

      expect(hook1).toHaveBeenCalledTimes(1);
      expect(hook2).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAfterTransition() - Register after hooks', () => {
    it('should register an after transition hook', async () => {
      const hook = vi.fn();
      lifecycle.onAfterTransition(hook);

      await lifecycle.transition(LifecycleState.INITIALIZING);

      expect(hook).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearHooks() - Clear all hooks', () => {
    it('should clear all registered hooks', async () => {
      const beforeHook = vi.fn();
      const afterHook = vi.fn();

      lifecycle.onBeforeTransition(beforeHook);
      lifecycle.onAfterTransition(afterHook);
      lifecycle.clearHooks();

      await lifecycle.transition(LifecycleState.INITIALIZING);

      expect(beforeHook).not.toHaveBeenCalled();
      expect(afterHook).not.toHaveBeenCalled();
    });
  });

  describe('reset() - Reset to initial state', () => {
    it('should reset to CREATED state', async () => {
      await lifecycle.transition(LifecycleState.INITIALIZING);
      await lifecycle.transition(LifecycleState.INITIALIZED);

      lifecycle.reset();

      expect(lifecycle.getState()).toBe(LifecycleState.CREATED);
      expect(lifecycle.getPreviousState()).toBe(LifecycleState.INITIALIZED);
    });
  });

  describe('getStatus() - Get status summary', () => {
    it('should return correct status summary', async () => {
      const status = lifecycle.getStatus();

      expect(status).toEqual({
        state: LifecycleState.CREATED,
        previousState: null,
        isRunning: false,
        isActive: false,
      });

      await lifecycle.transition(LifecycleState.INITIALIZED);

      const newStatus = lifecycle.getStatus();
      expect(newStatus.state).toBe(LifecycleState.INITIALIZED);
      expect(newStatus.isActive).toBe(true);
    });
  });

  describe('LifecycleState enum', () => {
    it('should have all expected states', () => {
      expect(LifecycleState.CREATED).toBe('created');
      expect(LifecycleState.INITIALIZING).toBe('initializing');
      expect(LifecycleState.INITIALIZED).toBe('initialized');
      expect(LifecycleState.STARTING).toBe('starting');
      expect(LifecycleState.RUNNING).toBe('running');
      expect(LifecycleState.STOPPING).toBe('stopping');
      expect(LifecycleState.STOPPED).toBe('stopped');
      expect(LifecycleState.ERROR).toBe('error');
    });
  });
});
