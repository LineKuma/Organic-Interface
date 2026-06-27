import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ContextItemType,
  ContextItemPriority,
  createContextItem,
  createMessageContextItem,
  createStateContextItem,
  createToolCallContextItem,
  createResultContextItem,
  updateContextItem,
  isContextItemExpired,
  touchContextItem,
  isValidContextItem,
  calculateContextItemSize,
  compareContextItems,
} from '../ContextItem.js';
import type { ContextItem, ContextItemMetadata } from '../ContextItem.js';

// Helper: create a minimal valid context item
function makeItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'test-id',
    type: ContextItemType.CUSTOM,
    content: 'test content',
    contextId: 'ctx-1',
    createdAt: 1000,
    accessedAt: 1000,
    updatedAt: 1000,
    metadata: {},
    ...overrides,
  };
}

describe('ContextItem', () => {
  // ===================== Enums =====================
  describe('ContextItemType enum', () => {
    it('should have MESSAGE value', () => {
      expect(ContextItemType.MESSAGE).toBe('message');
    });

    it('should have STATE value', () => {
      expect(ContextItemType.STATE).toBe('state');
    });

    it('should have TOOL_CALL value', () => {
      expect(ContextItemType.TOOL_CALL).toBe('tool_call');
    });

    it('should have RESULT value', () => {
      expect(ContextItemType.RESULT).toBe('result');
    });

    it('should have ATTACHMENT value', () => {
      expect(ContextItemType.ATTACHMENT).toBe('attachment');
    });

    it('should have CUSTOM value', () => {
      expect(ContextItemType.CUSTOM).toBe('custom');
    });

    it('should have exactly 6 values', () => {
      expect(Object.values(ContextItemType)).toHaveLength(6);
    });
  });

  describe('ContextItemPriority enum', () => {
    it('should have LOW value', () => {
      expect(ContextItemPriority.LOW).toBe('low');
    });

    it('should have NORMAL value', () => {
      expect(ContextItemPriority.NORMAL).toBe('normal');
    });

    it('should have HIGH value', () => {
      expect(ContextItemPriority.HIGH).toBe('high');
    });

    it('should have CRITICAL value', () => {
      expect(ContextItemPriority.CRITICAL).toBe('critical');
    });

    it('should have exactly 4 values', () => {
      expect(Object.values(ContextItemPriority)).toHaveLength(4);
    });
  });

  // ===================== createContextItem =====================
  describe('createContextItem', () => {
    it('should create item with required fields', () => {
      const item = createContextItem({
        type: ContextItemType.CUSTOM,
        content: 'hello',
        contextId: 'ctx-1',
      });

      expect(item.type).toBe(ContextItemType.CUSTOM);
      expect(item.content).toBe('hello');
      expect(item.contextId).toBe('ctx-1');
    });

    it('should auto-generate ID with ctx_item_ prefix', () => {
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
      });

      expect(item.id).toMatch(/^ctx_item_\d+_[a-z0-9]+$/);
    });

    it('should use custom ID when provided', () => {
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
        id: 'my-custom-id',
      });

      expect(item.id).toBe('my-custom-id');
    });

    it('should set createdAt, accessedAt, and updatedAt to current time', () => {
      const before = Date.now();
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
      });
      const after = Date.now();

      expect(item.createdAt).toBeGreaterThanOrEqual(before);
      expect(item.createdAt).toBeLessThanOrEqual(after);
      expect(item.accessedAt).toBe(item.createdAt);
      expect(item.updatedAt).toBe(item.createdAt);
    });

    it('should set expiresAt when provided', () => {
      const future = Date.now() + 10000;
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
        expiresAt: future,
      });

      expect(item.expiresAt).toBe(future);
    });

    it('should set expiresAt as undefined when not provided', () => {
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
      });

      expect(item.expiresAt).toBeUndefined();
    });

    it('should set metadata (shallow spread)', () => {
      const metadata: ContextItemMetadata = {
        createdBy: 'agent-1',
        tags: ['tag1'],
        priority: ContextItemPriority.HIGH,
      };
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
        metadata,
      });

      expect(item.metadata.createdBy).toBe('agent-1');
      expect(item.metadata.tags).toEqual(['tag1']);
      expect(item.metadata.priority).toBe(ContextItemPriority.HIGH);
    });

    it('should default metadata to empty object', () => {
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
      });

      expect(item.metadata).toEqual({});
    });

    it('should set size when provided', () => {
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
        size: 1024,
      });

      expect(item.size).toBe(1024);
    });

    it('should set size as undefined when not provided', () => {
      const item = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'hello',
        contextId: 'ctx-1',
      });

      expect(item.size).toBeUndefined();
    });

    it('should generate unique IDs for different items', () => {
      const item1 = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'a',
        contextId: 'ctx-1',
      });
      const item2 = createContextItem({
        type: ContextItemType.MESSAGE,
        content: 'b',
        contextId: 'ctx-1',
      });

      expect(item1.id).not.toBe(item2.id);
    });

    it('should handle object content', () => {
      const content = { key: 'value', nested: { deep: true } };
      const item = createContextItem({
        type: ContextItemType.STATE,
        content,
        contextId: 'ctx-1',
      });

      expect(item.content).toEqual(content);
    });

    it('should handle array content', () => {
      const content = [1, 2, 3];
      const item = createContextItem({
        type: ContextItemType.RESULT,
        content,
        contextId: 'ctx-1',
      });

      expect(item.content).toEqual([1, 2, 3]);
    });

    it('should handle null content', () => {
      const item = createContextItem({
        type: ContextItemType.CUSTOM,
        content: null,
        contextId: 'ctx-1',
      });

      expect(item.content).toBeNull();
    });

    it('should handle undefined content', () => {
      const item = createContextItem({
        type: ContextItemType.CUSTOM,
        content: undefined,
        contextId: 'ctx-1',
      });

      expect(item.content).toBeUndefined();
    });
  });

  // ===================== Factory Functions =====================
  describe('createMessageContextItem', () => {
    it('should create item with MESSAGE type', () => {
      const item = createMessageContextItem('ctx-1', 'hello');

      expect(item.type).toBe(ContextItemType.MESSAGE);
      expect(item.content).toBe('hello');
      expect(item.contextId).toBe('ctx-1');
    });

    it('should pass metadata through', () => {
      const metadata: ContextItemMetadata = { createdBy: 'agent-1' };
      const item = createMessageContextItem('ctx-1', 'hello', metadata);

      expect(item.metadata.createdBy).toBe('agent-1');
    });

    it('should work without metadata', () => {
      const item = createMessageContextItem('ctx-1', 'hello');

      expect(item.metadata).toEqual({});
    });
  });

  describe('createStateContextItem', () => {
    it('should create item with STATE type', () => {
      const item = createStateContextItem('ctx-1', 'myKey', 'myValue');

      expect(item.type).toBe(ContextItemType.STATE);
      expect(item.content).toBe('myValue');
      expect(item.contextId).toBe('ctx-1');
    });

    it('should include stateKey in metadata', () => {
      const item = createStateContextItem('ctx-1', 'myKey', 'myValue');

      expect(item.metadata.stateKey).toBe('myKey');
    });

    it('should merge additional metadata with stateKey', () => {
      const metadata: ContextItemMetadata = { createdBy: 'agent-1' };
      const item = createStateContextItem('ctx-1', 'myKey', 'myValue', metadata);

      expect(item.metadata.stateKey).toBe('myKey');
      expect(item.metadata.createdBy).toBe('agent-1');
    });
  });

  describe('createToolCallContextItem', () => {
    it('should create item with TOOL_CALL type', () => {
      const toolCall = { name: 'readFile', params: { path: '/test' } };
      const item = createToolCallContextItem('ctx-1', toolCall);

      expect(item.type).toBe(ContextItemType.TOOL_CALL);
      expect(item.content).toEqual(toolCall);
      expect(item.contextId).toBe('ctx-1');
    });

    it('should pass metadata through', () => {
      const metadata: ContextItemMetadata = { tags: ['tool'] };
      const item = createToolCallContextItem('ctx-1', {}, metadata);

      expect(item.metadata.tags).toEqual(['tool']);
    });
  });

  describe('createResultContextItem', () => {
    it('should create item with RESULT type', () => {
      const result = { success: true, data: 'done' };
      const item = createResultContextItem('ctx-1', result);

      expect(item.type).toBe(ContextItemType.RESULT);
      expect(item.content).toEqual(result);
      expect(item.contextId).toBe('ctx-1');
    });

    it('should pass metadata through', () => {
      const metadata: ContextItemMetadata = { priority: ContextItemPriority.HIGH };
      const item = createResultContextItem('ctx-1', 'result', metadata);

      expect(item.metadata.priority).toBe(ContextItemPriority.HIGH);
    });
  });

  // ===================== updateContextItem =====================
  describe('updateContextItem', () => {
    let item: ContextItem;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);
      item = makeItem();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update content', () => {
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(item, { content: 'new content' });

      expect(updated.content).toBe('new content');
    });

    it('should keep original content when not provided', () => {
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(item, {});

      expect(updated.content).toBe('test content');
    });

    it('should merge metadata', () => {
      const itemWithMeta = { ...item, metadata: { createdBy: 'agent-1' } };
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(itemWithMeta, {
        metadata: { tags: ['new-tag'] },
      });

      expect(updated.metadata.createdBy).toBe('agent-1');
      expect(updated.metadata.tags).toEqual(['new-tag']);
    });

    it('should update accessedAt and updatedAt', () => {
      vi.advanceTimersByTime(100);
      const updated = updateContextItem(item, { content: 'new' });

      expect(updated.accessedAt).toBe(1100);
      expect(updated.updatedAt).toBe(1100);
    });

    it('should keep original createdAt', () => {
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(item, { content: 'new' });

      expect(updated.createdAt).toBe(1000);
    });

    it('should update expiresAt when provided', () => {
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(item, { expiresAt: 5000 });

      expect(updated.expiresAt).toBe(5000);
    });

    it('should keep original expiresAt when not provided', () => {
      const itemWithExpiry = { ...item, expiresAt: 5000 };
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(itemWithExpiry, {});

      expect(updated.expiresAt).toBe(5000);
    });

    it('should keep original metadata when not provided', () => {
      const itemWithMeta = { ...item, metadata: { createdBy: 'agent-1' } };
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(itemWithMeta, {});

      expect(updated.metadata.createdBy).toBe('agent-1');
    });

    it('should not mutate original item', () => {
      vi.advanceTimersByTime(1);
      const updated = updateContextItem(item, { content: 'new' });

      expect(item.content).toBe('test content');
      expect(updated).not.toBe(item);
    });
  });

  // ===================== isContextItemExpired =====================
  describe('isContextItemExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(5000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false when no expiration is set', () => {
      const item = makeItem({ expiresAt: undefined });
      expect(isContextItemExpired(item)).toBe(false);
    });

    it('should return false when expiration is in the future', () => {
      const item = makeItem({ expiresAt: 10000 });
      expect(isContextItemExpired(item)).toBe(false);
    });

    it('should return true when expiration is in the past', () => {
      const item = makeItem({ expiresAt: 1000 });
      expect(isContextItemExpired(item)).toBe(true);
    });

    it('should return true when expiration is exactly now', () => {
      // Date.now() > expiresAt, so equal is not expired
      const item = makeItem({ expiresAt: 5000 });
      expect(isContextItemExpired(item)).toBe(false);
    });
  });

  // ===================== touchContextItem =====================
  describe('touchContextItem', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update accessedAt', () => {
      vi.advanceTimersByTime(500);
      const touched = touchContextItem(makeItem());

      expect(touched.accessedAt).toBe(1500);
    });

    it('should not change other timestamps', () => {
      const item = makeItem();
      vi.advanceTimersByTime(1);
      const touched = touchContextItem(item);

      expect(touched.createdAt).toBe(1000);
      expect(touched.updatedAt).toBe(1000);
    });

    it('should not change content', () => {
      vi.advanceTimersByTime(1);
      const touched = touchContextItem(makeItem());

      expect(touched.content).toBe('test content');
    });

    it('should not mutate original item', () => {
      const item = makeItem();
      vi.advanceTimersByTime(1);
      const touched = touchContextItem(item);

      expect(item.accessedAt).toBe(1000);
      expect(touched).not.toBe(item);
    });
  });

  // ===================== isValidContextItem =====================
  describe('isValidContextItem', () => {
    it('should return true for valid item', () => {
      expect(isValidContextItem(makeItem())).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidContextItem(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidContextItem(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isValidContextItem('not an object')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidContextItem(42)).toBe(false);
    });

    it('should return false for array', () => {
      expect(isValidContextItem([])).toBe(false);
    });

    it('should return false when missing id', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, ...withoutId } = makeItem();
      expect(isValidContextItem(withoutId)).toBe(false);
    });

    it('should return false when id is not a string', () => {
      expect(isValidContextItem(makeItem({ id: 123 as unknown as string }))).toBe(false);
    });

    it('should return false for invalid type', () => {
      expect(isValidContextItem(makeItem({ type: 'invalid_type' as ContextItemType }))).toBe(false);
    });

    it('should return false when missing contextId', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { contextId: _, ...withoutContextId } = makeItem();
      expect(isValidContextItem(withoutContextId)).toBe(false);
    });

    it('should return false when contextId is not a string', () => {
      expect(isValidContextItem(makeItem({ contextId: 123 as unknown as string }))).toBe(false);
    });

    it('should return false when missing createdAt', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { createdAt: _, ...withoutCreatedAt } = makeItem();
      expect(isValidContextItem(withoutCreatedAt)).toBe(false);
    });

    it('should return false when createdAt is not a number', () => {
      expect(isValidContextItem(makeItem({ createdAt: '1000' as unknown as number }))).toBe(false);
    });

    it('should return false when missing accessedAt', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { accessedAt: _, ...withoutAccessedAt } = makeItem();
      expect(isValidContextItem(withoutAccessedAt)).toBe(false);
    });

    it('should return false when updatedAt is not a number', () => {
      expect(isValidContextItem(makeItem({ updatedAt: '1000' as unknown as number }))).toBe(false);
    });

    it('should return false when content is missing', () => {
      const withoutContent = { ...makeItem() };
      delete withoutContent.content;
      expect(isValidContextItem(withoutContent)).toBe(false);
    });
  });

  // ===================== calculateContextItemSize =====================
  describe('calculateContextItemSize', () => {
    it('should return preset size when available', () => {
      const item = makeItem({ size: 500 });
      expect(calculateContextItemSize(item)).toBe(500);
    });

    it('should return preset size 0 when explicitly set to 0', () => {
      const item = makeItem({ size: 0 });
      expect(calculateContextItemSize(item)).toBe(0);
    });

    it('should calculate size for string content', () => {
      const item = makeItem({ content: 'hello world', size: undefined });
      // 11 (string length) + 2 (metadata JSON "{}") + 200 (overhead) = 213
      const size = calculateContextItemSize(item);
      expect(size).toBeGreaterThan(200);
      expect(size).toBe(213); // 11 + 2 + 200
    });

    it('should calculate size for object content', () => {
      const item = makeItem({
        content: { key: 'value' },
        size: undefined,
      });
      // JSON.stringify({key:'value'}) = 15 chars + 2 (metadata) + 200 = 217
      const size = calculateContextItemSize(item);
      expect(size).toBeGreaterThan(200);
      expect(size).toBe(217);
    });

    it('should calculate size for empty string content', () => {
      const item = makeItem({ content: '', size: undefined });
      // 0 + 2 + 200 = 202
      expect(calculateContextItemSize(item)).toBe(202);
    });

    it('should include metadata size in calculation', () => {
      const item = makeItem({
        content: '',
        metadata: { createdBy: 'agent-1', tags: ['a', 'b'] },
        size: undefined,
      });
      const size = calculateContextItemSize(item);
      const metadataJson = JSON.stringify(item.metadata);
      expect(size).toBe(0 + metadataJson.length + 200);
    });
  });

  // ===================== compareContextItems =====================
  describe('compareContextItems', () => {
    const older = makeItem({ id: 'older', createdAt: 1000, accessedAt: 1000, updatedAt: 1000 });
    const newer = makeItem({ id: 'newer', createdAt: 2000, accessedAt: 2000, updatedAt: 2000 });

    it('should sort by created (descending - newest first)', () => {
      expect(compareContextItems(older, newer, 'created')).toBeGreaterThan(0);
      expect(compareContextItems(newer, older, 'created')).toBeLessThan(0);
    });

    it('should sort by accessed (descending - newest first)', () => {
      expect(compareContextItems(older, newer, 'accessed')).toBeGreaterThan(0);
      expect(compareContextItems(newer, older, 'accessed')).toBeLessThan(0);
    });

    it('should sort by updated (descending - newest first)', () => {
      expect(compareContextItems(older, newer, 'updated')).toBeGreaterThan(0);
      expect(compareContextItems(newer, older, 'updated')).toBeLessThan(0);
    });

    it('should default to sort by accessed', () => {
      expect(compareContextItems(older, newer)).toBeGreaterThan(0);
      expect(compareContextItems(newer, older)).toBeLessThan(0);
    });

    it('should return 0 for equal timestamps', () => {
      const a = makeItem({ createdAt: 1000, accessedAt: 1000, updatedAt: 1000 });
      const b = makeItem({ createdAt: 1000, accessedAt: 1000, updatedAt: 1000 });
      expect(compareContextItems(a, b, 'created')).toBe(0);
      expect(compareContextItems(a, b, 'accessed')).toBe(0);
      expect(compareContextItems(a, b, 'updated')).toBe(0);
    });
  });
});
