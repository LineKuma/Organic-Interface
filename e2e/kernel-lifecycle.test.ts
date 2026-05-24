import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { KernelEvents } from '@organic/kernel';

describe('Kernel Lifecycle', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should initialize kernel successfully', async () => {
    expect(kernel).toBeDefined();
    expect(kernel.getStatus().state).toBe(LifecycleState.CREATED);

    await kernel.initialize();

    expect(kernel.getStatus().state).toBe(LifecycleState.INITIALIZED);
  });

  it('should handle kernel shutdown gracefully', async () => {
    await kernel.initialize();
    expect(kernel.getStatus().state).toBe(LifecycleState.INITIALIZED);

    await kernel.stop();
    expect(kernel.getStatus().state).toBe(LifecycleState.STOPPED);
  });

  it('should restart kernel without data loss', async () => {
    await kernel.initialize();
    const initializedState = kernel.getStatus().state;
    expect(initializedState).toBe(LifecycleState.INITIALIZED);

    await kernel.stop();
    expect(kernel.getStatus().state).toBe(LifecycleState.STOPPED);

    await kernel.initialize();
    expect(kernel.getStatus().state).toBe(LifecycleState.INITIALIZED);
  });

  it('should handle stop in non-initialized state', async () => {
    const brandNewKernel = new Kernel({
      config: { name: 'brand-new', version: '1.0.0' },
    });
    expect(brandNewKernel.getStatus().state).toBe(LifecycleState.CREATED);

    await brandNewKernel.stop();
    expect(brandNewKernel.getStatus().state).toBe(LifecycleState.STOPPED);
  });

  it('should integrate with EventBus during lifecycle', async () => {
    const events: string[] = [];
    const eventBus = (kernel as any).eventBus;

    eventBus.on(KernelEvents.KERNEL_INIT, () => events.push('init'));
    eventBus.on(KernelEvents.KERNEL_START, () => events.push('start'));
    eventBus.on(KernelEvents.KERNEL_STOP, () => events.push('stop'));

    await kernel.initialize();
    await kernel.start();
    await kernel.stop();

    await new Promise(resolve => setImmediate(resolve));

    expect(events).toContain('init');
    expect(events).toContain('start');
    expect(events).toContain('stop');
  });

  it('should manage multiple kernel instances independently', async () => {
    const kernel1 = new Kernel({ config: { name: 'kernel-1', version: '1.0.0' } });
    const kernel2 = new Kernel({ config: { name: 'kernel-2', version: '1.0.0' } });

    await kernel1.initialize();
    await kernel2.initialize();

    expect(kernel1.getStatus().state).toBe(LifecycleState.INITIALIZED);
    expect(kernel2.getStatus().state).toBe(LifecycleState.INITIALIZED);

    await kernel1.stop();
    expect(kernel1.getStatus().state).toBe(LifecycleState.STOPPED);
    expect(kernel2.getStatus().state).toBe(LifecycleState.INITIALIZED);

    await kernel2.stop();
  });

  it('should transition through correct lifecycle states', async () => {
    const states: LifecycleState[] = [];

    kernel.onEvent(LifecycleState.INITIALIZING, () => states.push(LifecycleState.INITIALIZING));
    kernel.onEvent(LifecycleState.INITIALIZED, () => states.push(LifecycleState.INITIALIZED));

    await kernel.initialize();

    expect(kernel.getStatus().state).toBe(LifecycleState.INITIALIZED);
  });
});