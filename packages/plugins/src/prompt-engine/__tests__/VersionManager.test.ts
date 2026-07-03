/**
 * VersionManager Tests
 *
 * Tests for version creation, history, diff, rollback, and current version retrieval.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionManager } from '../VersionManager.js';

describe('VersionManager', () => {
  let vm: VersionManager;

  beforeEach(() => {
    vm = new VersionManager();
  });

  // ==================== createVersion() ====================

  describe('createVersion()', () => {
    it('should create the first version as 1.0.0', () => {
      const version = vm.createVersion('template-1', 'content v1', 'Initial version');
      expect(version.version).toBe('1.0.0');
      expect(version.content).toBe('content v1');
      expect(version.message).toBe('Initial version');
      expect(version.createdAt).toBeGreaterThan(0);
    });

    it('should auto-increment patch version', () => {
      vm.createVersion('template-1', 'content v1', 'Initial');
      const v2 = vm.createVersion('template-1', 'content v2', 'Update');
      expect(v2.version).toBe('1.0.1');
    });

    it('should increment patch multiple times', () => {
      vm.createVersion('template-1', 'v1', 'msg1');
      vm.createVersion('template-1', 'v2', 'msg2');
      const v3 = vm.createVersion('template-1', 'v3', 'msg3');
      expect(v3.version).toBe('1.0.2');
    });

    it('should store author if provided', () => {
      const version = vm.createVersion('template-1', 'content', 'message', 'Alice');
      expect(version.author).toBe('Alice');
    });

    it('should handle author as undefined', () => {
      const version = vm.createVersion('template-1', 'content', 'message');
      expect(version.author).toBeUndefined();
    });

    it('should create separate version histories for different templates', () => {
      const v1 = vm.createVersion('t1', 'c1', 'm1');
      const v2 = vm.createVersion('t2', 'c2', 'm2');
      expect(v1.version).toBe('1.0.0');
      expect(v2.version).toBe('1.0.0');
    });
  });

  // ==================== getVersion() ====================

  describe('getVersion()', () => {
    it('should return a specific version', () => {
      vm.createVersion('template-1', 'v1', 'first');
      vm.createVersion('template-1', 'v2', 'second');

      const v1 = vm.getVersion('template-1', '1.0.0');
      expect(v1).not.toBeNull();
      expect(v1!.content).toBe('v1');
      expect(v1!.version).toBe('1.0.0');
    });

    it('should return null for non-existent version', () => {
      vm.createVersion('template-1', 'v1', 'first');
      const v = vm.getVersion('template-1', '9.9.9');
      expect(v).toBeNull();
    });

    it('should return null for non-existent template', () => {
      const v = vm.getVersion('non-existent', '1.0.0');
      expect(v).toBeNull();
    });
  });

  // ==================== getHistory() ====================

  describe('getHistory()', () => {
    it('should return version history newest first', () => {
      vm.createVersion('template-1', 'v1', 'first');
      vm.createVersion('template-1', 'v2', 'second');
      vm.createVersion('template-1', 'v3', 'third');

      const history = vm.getHistory('template-1');
      expect(history).toHaveLength(3);
      expect(history[0].version).toBe('1.0.2');
      expect(history[1].version).toBe('1.0.1');
      expect(history[2].version).toBe('1.0.0');
    });

    it('should return empty array for non-existent template', () => {
      const history = vm.getHistory('non-existent');
      expect(history).toEqual([]);
    });

    it('should return single version for new template', () => {
      vm.createVersion('template-1', 'v1', 'first');
      const history = vm.getHistory('template-1');
      expect(history).toHaveLength(1);
    });
  });

  // ==================== diff() ====================

  describe('diff()', () => {
    it('should show diff between two versions', () => {
      vm.createVersion('template-1', 'line1\nline2\nline3', 'first');
      vm.createVersion('template-1', 'line1\nline2 modified\nline3', 'second');

      const diff = vm.diff('template-1', '1.0.0', '1.0.1');
      expect(diff).toContain('--- template-1@1.0.0');
      expect(diff).toContain('+++ template-1@1.0.1');
      expect(diff).toContain('- line2');
      expect(diff).toContain('+ line2 modified');
    });

    it('should show additions', () => {
      vm.createVersion('template-1', 'line1', 'first');
      vm.createVersion('template-1', 'line1\nline2', 'second');

      const diff = vm.diff('template-1', '1.0.0', '1.0.1');
      expect(diff).toContain('+ line2');
    });

    it('should show deletions', () => {
      vm.createVersion('template-1', 'line1\nline2', 'first');
      vm.createVersion('template-1', 'line1', 'second');

      const diff = vm.diff('template-1', '1.0.0', '1.0.1');
      expect(diff).toContain('- line2');
    });

    it('should return error for non-existent version', () => {
      vm.createVersion('template-1', 'content', 'first');
      const diff = vm.diff('template-1', '1.0.0', '9.9.9');
      expect(diff).toContain('Error');
    });

    it('should return error for non-existent template', () => {
      const diff = vm.diff('non-existent', '1.0.0', '1.0.1');
      expect(diff).toContain('Error');
    });

    it('should show identical content with no markers', () => {
      vm.createVersion('template-1', 'same content', 'first');
      vm.createVersion('template-1', 'same content', 'second');

      const diff = vm.diff('template-1', '1.0.0', '1.0.1');
      expect(diff).toContain('  same content');
      expect(diff).not.toContain('+ same content');
      expect(diff).not.toContain('- same content');
    });
  });

  // ==================== rollback() ====================

  describe('rollback()', () => {
    it('should create a new version with rolled-back content', () => {
      vm.createVersion('template-1', 'original content', 'initial');
      vm.createVersion('template-1', 'modified content', 'modified');
      vm.createVersion('template-1', 'further modified', 'further');

      const rollbackVersion = vm.rollback('template-1', '1.0.0');

      expect(rollbackVersion.version).toBe('1.0.3');
      expect(rollbackVersion.content).toBe('original content');
      expect(rollbackVersion.message).toContain('Rollback');
      expect(rollbackVersion.author).toBe('system');
    });

    it('should throw for non-existent version', () => {
      vm.createVersion('template-1', 'content', 'first');
      expect(() => vm.rollback('template-1', '9.9.9')).toThrow('not found');
    });

    it('should throw for non-existent template', () => {
      expect(() => vm.rollback('non-existent', '1.0.0')).toThrow('not found');
    });

    it('should preserve history after rollback', () => {
      vm.createVersion('template-1', 'v1', 'first');
      vm.createVersion('template-1', 'v2', 'second');
      vm.rollback('template-1', '1.0.0');

      const history = vm.getHistory('template-1');
      expect(history).toHaveLength(3);
    });
  });

  // ==================== getCurrentVersion() ====================

  describe('getCurrentVersion()', () => {
    it('should return 0.0.0 for non-existent template', () => {
      expect(vm.getCurrentVersion('non-existent')).toBe('0.0.0');
    });

    it('should return the latest version', () => {
      vm.createVersion('template-1', 'v1', 'first');
      vm.createVersion('template-1', 'v2', 'second');
      expect(vm.getCurrentVersion('template-1')).toBe('1.0.1');
    });

    it('should return 1.0.0 for single version', () => {
      vm.createVersion('template-1', 'v1', 'first');
      expect(vm.getCurrentVersion('template-1')).toBe('1.0.0');
    });
  });

  // ==================== removeTemplate() ====================

  describe('removeTemplate()', () => {
    it('should remove all versions for a template', () => {
      vm.createVersion('template-1', 'v1', 'first');
      vm.createVersion('template-1', 'v2', 'second');
      vm.removeTemplate('template-1');

      expect(vm.getHistory('template-1')).toEqual([]);
      expect(vm.getCurrentVersion('template-1')).toBe('0.0.0');
    });

    it('should not affect other templates', () => {
      vm.createVersion('t1', 'c1', 'm1');
      vm.createVersion('t2', 'c2', 'm2');
      vm.removeTemplate('t1');

      expect(vm.getCurrentVersion('t2')).toBe('1.0.0');
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle large number of versions', () => {
      for (let i = 0; i < 100; i++) {
        vm.createVersion('template-1', `content ${i}`, `version ${i}`);
      }
      const history = vm.getHistory('template-1');
      expect(history).toHaveLength(100);
      expect(history[0].version).toBe('1.0.99');
    });

    it('should handle empty content', () => {
      const version = vm.createVersion('template-1', '', 'empty');
      expect(version.content).toBe('');
    });

    it('should handle long messages', () => {
      const longMsg = 'a'.repeat(1000);
      const version = vm.createVersion('template-1', 'content', longMsg);
      expect(version.message).toBe(longMsg);
    });

    it('should handle diff with empty content', () => {
      vm.createVersion('template-1', '', 'empty');
      vm.createVersion('template-1', 'new content', 'added');
      const diff = vm.diff('template-1', '1.0.0', '1.0.1');
      expect(diff).toContain('+ new content');
    });
  });
});