import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig, EventBus } from '@organic/kernel';

describe('Event Bus', () => {
  let kernel: Kernel;
  let eventBus: EventBus;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();
    eventBus = (kernel as any).eventBus;
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should register and trigger event listeners', async () => {
    let callCount = 0;
    const testPayload = { message: 'hello' };

    const subscription = eventBus.on('test-event', (event) => {
      callCount++;
      expect(event.type).toBe('test-event');
      expect(event.data).toEqual(testPayload);
    });

    eventBus.emit('test-event', testPayload);

    await new Promise(resolve => setImmediate(resolve));

    expect(callCount).toBe(1);
    subscription.unsubscribe();
  });

  it('should trigger once event only once', async () => {
    let callCount = 0;
    const testPayload = { message: 'once-data' };

    const subscription = eventBus.once('once-event', (event) => {
      callCount++;
      expect(event.data).toEqual(testPayload);
    });

    eventBus.emit('once-event', testPayload);
    eventBus.emit('once-event', testPayload);

    await new Promise(resolve => setImmediate(resolve));

    expect(callCount).toBe(1);
  });

  it('should unsubscribe from events', async () => {
    let callCount = 0;

    const listener = () => {
      callCount++;
    };

    eventBus.on('off-event', listener);
    eventBus.emit('off-event', { data: 'test' });

    await new Promise(resolve => setImmediate(resolve));

    expect(callCount).toBe(1);

    eventBus.off('off-event', listener);
    eventBus.emit('off-event', { data: 'test2' });

    await new Promise(resolve => setImmediate(resolve));

    expect(callCount).toBe(1);
  });

  it('should handle multiple listeners for same event', async () => {
    const results: number[] = [];

    eventBus.on('multi-event', () => results.push(1));
    eventBus.on('multi-event', () => results.push(2));
    eventBus.on('multi-event', () => results.push(3));

    eventBus.emit('multi-event', { data: 'multi' });

    await new Promise(resolve => setImmediate(resolve));

    expect(results).toEqual([1, 2, 3]);
  });

  it('should track listener count', async () => {
    expect(eventBus.listenerCount('count-event')).toBe(0);

    eventBus.on('count-event', () => {});
    eventBus.on('count-event', () => {});

    expect(eventBus.listenerCount('count-event')).toBe(2);

    eventBus.removeAllListeners('count-event');

    expect(eventBus.listenerCount('count-event')).toBe(0);
  });

  it('should handle error level events', async () => {
    let errorReceived = false;
    const errorPayload = { code: 'TEST_ERROR', message: 'Test error occurred' };

    eventBus.on('error', (event) => {
      errorReceived = true;
      expect(event.data).toEqual(errorPayload);
    });

    eventBus.emit('error', errorPayload);

    await new Promise(resolve => setImmediate(resolve));
    expect(errorReceived).toBe(true);
  });

  it('should support wildcard event subscription', async () => {
    const events: string[] = [];

    eventBus.on('user:*', (event) => {
      events.push(event.type);
    });

    eventBus.emit('user:created', { id: '1' });
    eventBus.emit('user:updated', { id: '1' });
    eventBus.emit('user:deleted', { id: '1' });

    await new Promise(resolve => setImmediate(resolve));

    expect(events.length).toBe(3);
    expect(events).toContain('user:created');
    expect(events).toContain('user:updated');
    expect(events).toContain('user:deleted');
  });

  it('should not trigger listener after unsubscribe', async () => {
    let callCount = 0;
    const listener = () => {
      callCount++;
    };

    eventBus.on('remove-test', listener);
    eventBus.emit('remove-test', { data: 'test' });

    await new Promise(resolve => setImmediate(resolve));
    expect(callCount).toBe(1);

    eventBus.off('remove-test', listener);
    eventBus.emit('remove-test', { data: 'test2' });

    await new Promise(resolve => setImmediate(resolve));
    expect(callCount).toBe(1);
  });

  it('should emit events with timestamp and source', async () => {
    let receivedEvent: any = null;

    eventBus.on('timestamp-test', (event) => {
      receivedEvent = event;
    });

    eventBus.emit('timestamp-test', { value: 'test' }, 'test-source');

    await new Promise(resolve => setImmediate(resolve));

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.timestamp).toBeDefined();
    expect(receivedEvent.source).toBe('test-source');
    expect(receivedEvent.data.value).toBe('test');
  });

  it('should handle event with metadata', async () => {
    let receivedData: any = null;

    eventBus.on('metadata-test', (event) => {
      receivedData = event.data;
    });

    eventBus.emit('metadata-test', { key: 'value' }, undefined, { traceId: '123' });

    await new Promise(resolve => setImmediate(resolve));
    expect(receivedData.key).toBe('value');
  });

  it('should remove all listeners for specific event', async () => {
    let callCount = 0;

    eventBus.on('clear-event', () => callCount++);
    eventBus.on('clear-event', () => callCount++);
    eventBus.on('clear-event', () => callCount++);

    expect(eventBus.listenerCount('clear-event')).toBe(3);

    eventBus.removeAllListeners('clear-event');

    expect(eventBus.listenerCount('clear-event')).toBe(0);
  });
});