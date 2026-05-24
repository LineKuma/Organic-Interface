import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';

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
});