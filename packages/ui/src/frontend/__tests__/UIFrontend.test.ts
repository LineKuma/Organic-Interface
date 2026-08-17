import { describe, it, expect } from 'vitest';
import { UIFrontend } from '../UIFrontend.js';
import { FRONTEND_CAPABILITIES } from '../capabilities.js';
import { NotImplementedError } from '../errors.js';
import type { FrontendInfo, MessageResult } from '../types.js';

/**
 * A frontend that implements nothing on top of the base class (only a documented stub).
 * It must still conform structurally (all methods present) but fails conformance because
 * Tier A (required) methods are left as throwing stubs.
 */
class MinimalFrontend extends UIFrontend {
  constructor() {
    super({ kind: 'tui', name: 'minimal-tui', version: '0.0.1' });
  }
}

/** A frontend that overrides every Tier A (required) method with real implementations. */
class ConformantTuiFrontend extends UIFrontend {
  constructor() {
    super({ kind: 'tui', name: 'conformant-tui', version: '1.0.0' });
    // Override every required method with a working implementation.
    for (const group of FRONTEND_CAPABILITIES) {
      for (const method of group.methods) {
        if (method.required) {
          (this as unknown as Record<string, unknown>)[method.name] = async (): Promise<unknown> =>
            'implemented';
        }
      }
    }
  }

  override async getInfo(): Promise<FrontendInfo> {
    return { name: this.name, version: this.version, kind: this.kind, metadata: {} };
  }
}

const allMethodNames = (): string[] =>
  FRONTEND_CAPABILITIES.flatMap(group => group.methods.map(m => m.name));

describe('UIFrontend standard interface', () => {
  const { prototype } = UIFrontend;

  it('declares every capability method on the base class prototype', () => {
    for (const name of allMethodNames()) {
      expect(typeof (prototype as unknown as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('provides real implementations for getInfo and healthCheck at the base level', async () => {
    const f = new MinimalFrontend();
    const info = await f.getInfo();
    expect(info).toEqual({ name: 'minimal-tui', version: '0.0.1', kind: 'tui', metadata: {} });
    const health = await f.healthCheck();
    expect(health.ok).toBe(true);
  });

  it('reports a minimal frontend as not conformant and flags required stubs', () => {
    const f = new MinimalFrontend();
    const coverage = f.getCoverage();

    expect(coverage.total).toBe(allMethodNames().length);
    // getInfo + healthCheck are base-real implementations.
    expect(coverage.implemented).toBeGreaterThanOrEqual(2);
    expect(coverage.stubbed).toBeGreaterThan(0);
    expect(coverage.conformat).toBe(false);
    expect(coverage.violations.length).toBeGreaterThan(0);
    // Required Tier A methods left as stub must be flagged.
    expect(coverage.violations).toContain('conversation.sendMessage');
  });

  it('calling a stub method rejects with a NotImplementedError carrying the method key', async () => {
    const f = new MinimalFrontend();
    await expect(f.sendMessage({ sessionId: 's', content: 'hi' })).rejects.toBeInstanceOf(
      NotImplementedError
    );
    await expect(f.listWorkflows()).rejects.toThrow('workflow.listWorkflows');
    await expect(f.getLogs()).rejects.toBeInstanceOf(NotImplementedError);
    await expect(f.getLogs()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('a frontend that implements all Tier A methods is conformant', () => {
    const f = new ConformantTuiFrontend();
    const coverage = f.getCoverage();

    expect(coverage.conformat).toBe(true);
    expect(coverage.violations).toEqual([]);
    // Every required method is implemented.
    for (const group of FRONTEND_CAPABILITIES) {
      for (const method of group.methods) {
        if (method.required) {
          expect(
            coverage.capabilities
              .find(c => c.group === group.id)!
              .methods.find(m => m.method === method.name)!.status
          ).toBe('implemented');
        }
      }
    }
  });

  it('optional (Tier B) methods remain stubs without breaking conformance', () => {
    const f = new ConformantTuiFrontend();
    const coverage = f.getCoverage();

    for (const group of FRONTEND_CAPABILITIES) {
      for (const method of group.methods) {
        if (!method.required) {
          expect(
            coverage.capabilities
              .find(c => c.group === group.id)!
              .methods.find(m => m.method === method.name)!.status
          ).toBe('stub');
        }
      }
    }
  });

  it('declareStub records an acceptable-stub reason into the coverage report', () => {
    const f = new MinimalFrontend();
    f.declareStub('prompt.rollbackPrompt', 'deferred to v2');

    const entry = f
      .getCoverage()
      .capabilities.find(c => c.group === 'prompt')!
      .methods.find(m => m.method === 'rollbackPrompt')!;
    expect(entry.status).toBe('stub');
    expect(entry.reason).toBe('deferred to v2');

    // Rendering a declared stub surfaces a hint in the error.
    const f2 = new MinimalFrontend();
    f2.declareStub('prompt.rollbackPrompt', 'deferred to v2');
    return expect(f2.rollbackPrompt('p', '1.0.0')).rejects.toThrow('deferred to v2');
  });

  it('declareStub rejects unknown features', () => {
    const f = new MinimalFrontend();
    expect(() => f.declareStub('nope.notARealMethod')).toThrow('unknown feature');
    expect(() => f.declareStub('missingGroup')).toThrow("expects '<group>.<method>'");
  });

  it('constructor rejects stubs options that are not known methods', () => {
    expect(
      () =>
        new (class extends UIFrontend {
          constructor() {
            super({ kind: 'web', name: 'web', version: '1', stubs: { bogus: 'x' } });
          }
        })()
    ).toThrow('is not a known interface method');
  });

  it('listCapabilities exposes every method flattened', () => {
    const f = new MinimalFrontend();
    const names = f
      .listCapabilities()
      .map(c => c.method)
      .sort();
    expect(names).toEqual(allMethodNames().sort());
  });

  it('MessageResult typed method signature exists alongside the stub', async () => {
    const f = new MinimalFrontend();
    const sender: (input: {
      sessionId: string;
      content: string;
    }) => Promise<MessageResult> = input => f.sendMessage(input);
    await expect(sender({ sessionId: 's', content: 'hi' })).rejects.toThrow(
      'conversation.sendMessage'
    );
  });
});
