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
});