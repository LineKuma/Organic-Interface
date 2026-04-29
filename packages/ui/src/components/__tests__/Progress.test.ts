import { describe, it, expect } from 'vitest';
import { Progress } from '../../components/Progress.js';

describe('Progress', () => {
  describe('constructor', () => {
    it('should create a progress instance', () => {
      const progress = new Progress({ total: 100 });
      expect(progress).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update progress', () => {
      const progress = new Progress({ total: 100 });
      const state = progress.update(50);
      expect(state.current).toBe(50);
    });

    it('should not exceed total', () => {
      const progress = new Progress({ total: 100 });
      const state = progress.update(150);
      expect(state.current).toBeLessThanOrEqual(state.total);
    });
  });

  describe('increment', () => {
    it('should increment progress', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      const state = progress.increment(10);
      expect(state.current).toBe(60);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      const state = progress.getState();
      expect(state.current).toBe(50);
      expect(state.completed).toBe(false);
    });

    it('should return completed true when progress reaches total', () => {
      const progress = new Progress({ total: 100 });
      progress.update(100);
      const state = progress.getState();
      expect(state.completed).toBe(true);
    });
  });

  describe('complete', () => {
    it('should mark progress as complete', () => {
      const progress = new Progress({ total: 100 });
      progress.update(50);
      progress.complete();
      const state = progress.getState();
      expect(state.completed).toBe(true);
      expect(state.percentage).toBe(100);
    });
  });
});
