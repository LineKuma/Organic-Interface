/**
 * Security Presets E2E Tests
 *
 * Tests the security preset system: plan, create, work, yolo.
 * Each preset has specific allowed operations and approval requirements.
 *
 * plan   (L1): Read-only. File read, search, analysis. No modifications. Requires approval.
 * create (L2): Read-write. File read/write, search. No command execution. Requires approval.
 * work   (L3): Read-write-execute. Full tool access. Requires approval.
 * yolo   (L4): Full access. No approval required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ToolService,
  FileTool,
  ShellTool,
  SearchTool,
  SecurityGuard,
  ApprovalService,
  getPresetConfig,
  presetAllowsOperation,
  type SecurityPreset,
  type ToolExecutionContext,
} from '@organic/tools';

// ── Test Helpers ──────────────────────────────────────────────────

function createToolContext(): ToolExecutionContext {
  return {
    toolId: 'test-tool',
    executionId: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workingDirectory: process.cwd(),
    environment: {},
    cancelled: false,
    permissionLevel: 'L3',
    metadata: {},
  };
}

function createToolServiceWithGuard(preset: SecurityPreset): {
  toolService: ToolService;
  guard: SecurityGuard;
  approvalService: ApprovalService;
} {
  const approvalService = new ApprovalService({ defaultTimeout: 5000 });
  const guard = new SecurityGuard({ preset, approvalService, allowEscalation: true });
  const toolService = new ToolService({ enableValidation: true });
  toolService.registerTool(new FileTool());
  toolService.registerTool(new ShellTool());
  toolService.registerTool(new SearchTool());
  toolService.setSecurityGuard(guard);
  return { toolService, guard, approvalService };
}

/**
 * Helper: register an auto-approval listener on the approval service.
 * This simulates a human approving all requests.
 */
function autoApprove(approvalService: ApprovalService) {
  approvalService.on('approval:requested', req => {
    approvalService.approve(req.id, 'auto-approved in test');
  });
}

/**
 * Helper: register an auto-deny listener on the approval service.
 */
function autoDeny(approvalService: ApprovalService) {
  approvalService.on('approval:requested', req => {
    approvalService.deny(req.id, 'auto-denied in test');
  });
}

// ── Test Suite: Preset Definitions ───────────────────────────────

describe('Security Preset Definitions', () => {
  it('should have four presets: plan, create, work, yolo', () => {
    const presets = ['plan', 'create', 'work', 'yolo'];
    expect(presets).toHaveLength(4);
    // Verify each preset exists
    for (const p of presets) {
      expect(getPresetConfig(p as SecurityPreset)).toBeDefined();
    }
  });

  it('plan should be L1, read-only, requires approval', () => {
    const config = getPresetConfig('plan');
    expect(config.permissionLevel).toBe('L1');
    expect(config.allowedOperations).toEqual(['read']);
    expect(config.requiresApproval).toBe(true);
  });

  it('create should be L2, read-write, requires approval', () => {
    const config = getPresetConfig('create');
    expect(config.permissionLevel).toBe('L2');
    expect(config.allowedOperations).toContain('read');
    expect(config.allowedOperations).toContain('write');
    expect(config.allowedOperations).toContain('filesystem');
    expect(config.requiresApproval).toBe(true);
  });

  it('work should be L3, read-write-execute, requires approval', () => {
    const config = getPresetConfig('work');
    expect(config.permissionLevel).toBe('L3');
    expect(config.allowedOperations).toContain('read');
    expect(config.allowedOperations).toContain('write');
    expect(config.allowedOperations).toContain('execute');
    expect(config.requiresApproval).toBe(true);
  });

  it('yolo should be L4, all operations, no approval', () => {
    const config = getPresetConfig('yolo');
    expect(config.permissionLevel).toBe('L4');
    expect(config.allowedOperations).toContain('read');
    expect(config.allowedOperations).toContain('write');
    expect(config.allowedOperations).toContain('execute');
    expect(config.allowedOperations).toContain('network');
    expect(config.requiresApproval).toBe(false);
  });

  it('presetAllowsOperation should correctly check operations', () => {
    expect(presetAllowsOperation('plan', 'read')).toBe(true);
    expect(presetAllowsOperation('plan', 'write')).toBe(false);
    expect(presetAllowsOperation('plan', 'execute')).toBe(false);

    expect(presetAllowsOperation('create', 'read')).toBe(true);
    expect(presetAllowsOperation('create', 'write')).toBe(true);
    expect(presetAllowsOperation('create', 'execute')).toBe(false);

    expect(presetAllowsOperation('work', 'execute')).toBe(true);
    expect(presetAllowsOperation('work', 'network')).toBe(true);

    expect(presetAllowsOperation('yolo', 'execute')).toBe(true);
  });
});

// ── Test Suite: SecurityGuard ────────────────────────────────────

describe('SecurityGuard', () => {
  it('should initialize with default plan preset', () => {
    const guard = new SecurityGuard();
    expect(guard.getPreset()).toBe('plan');
    expect(guard.getPermissionLevel()).toBe('L1');
  });

  it('should initialize with specified preset', () => {
    const guard = new SecurityGuard({ preset: 'work' });
    expect(guard.getPreset()).toBe('work');
    expect(guard.getPermissionLevel()).toBe('L3');
  });

  it('should switch presets (escalation)', () => {
    const guard = new SecurityGuard({ preset: 'plan', allowEscalation: true });
    expect(guard.switchPreset('create')).toBe(true);
    expect(guard.getPreset()).toBe('create');
    expect(guard.switchPreset('work')).toBe(true);
    expect(guard.getPreset()).toBe('work');
    expect(guard.switchPreset('yolo')).toBe(true);
    expect(guard.getPreset()).toBe('yolo');
  });

  it('should block preset escalation when allowEscalation is false', () => {
    const guard = new SecurityGuard({ preset: 'plan', allowEscalation: false });
    expect(guard.switchPreset('create')).toBe(false);
    expect(guard.getPreset()).toBe('plan');
  });

  it('should always allow downgrading (yolo -> work)', () => {
    const guard = new SecurityGuard({ preset: 'yolo', allowEscalation: false });
    expect(guard.switchPreset('work')).toBe(true);
    expect(guard.getPreset()).toBe('work');
  });

  it('isAtLeast should correctly compare presets', () => {
    const guard = new SecurityGuard({ preset: 'create' });
    expect(guard.isAtLeast('plan')).toBe(true);
    expect(guard.isAtLeast('create')).toBe(true);
    expect(guard.isAtLeast('work')).toBe(false);
    expect(guard.isAtLeast('yolo')).toBe(false);
  });

  it('should check operations against preset', () => {
    // Plan preset
    const planGuard = new SecurityGuard({ preset: 'plan' });
    expect(planGuard.checkOperation('tool1', 'read').allowed).toBe(true);
    expect(planGuard.checkOperation('tool1', 'write').allowed).toBe(false);
    expect(planGuard.checkOperation('tool1', 'execute').allowed).toBe(false);

    // Create preset
    const createGuard = new SecurityGuard({ preset: 'create' });
    expect(createGuard.checkOperation('tool1', 'read').allowed).toBe(true);
    expect(createGuard.checkOperation('tool1', 'write').allowed).toBe(true);
    expect(createGuard.checkOperation('tool1', 'execute').allowed).toBe(false);

    // YOLO preset
    const yoloGuard = new SecurityGuard({ preset: 'yolo' });
    expect(yoloGuard.checkOperation('tool1', 'execute').allowed).toBe(true);
  });

  it('should emit preset:changed event on switch', () => {
    const guard = new SecurityGuard({ preset: 'plan' });
    const events: Array<[SecurityPreset, SecurityPreset]> = [];
    guard.on('preset:changed', (newP, oldP) => events.push([newP, oldP]));

    guard.switchPreset('create');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(['create', 'plan']);
  });
});

// ── Test Suite: ApprovalService ──────────────────────────────────

describe('ApprovalService', () => {
  it('should request approval and wait for response', async () => {
    const approvalService = new ApprovalService();

    // Register a listener that auto-approves
    approvalService.on('approval:requested', req => {
      approvalService.approve(req.id, 'test approval');
    });

    const response = await approvalService.requestApproval(
      'test-tool',
      { data: 'test' },
      'work',
      'execute'
    );

    expect(response.approved).toBe(true);
    expect(response.reason).toBe('test approval');
  });

  it('should deny when no listeners are registered', async () => {
    const approvalService = new ApprovalService();
    const response = await approvalService.requestApproval('test-tool', {}, 'work', 'execute');
    expect(response.approved).toBe(false);
    expect(response.reason).toContain('No approval handler');
  });

  it('should auto-approve when autoApproveOnNoListeners is true', async () => {
    const approvalService = new ApprovalService({ autoApproveOnNoListeners: true });
    const response = await approvalService.requestApproval('test-tool', {}, 'work', 'execute');
    expect(response.approved).toBe(true);
  });

  it('should handle denial', async () => {
    const approvalService = new ApprovalService();
    approvalService.on('approval:requested', req => {
      approvalService.deny(req.id, 'not allowed');
    });

    const response = await approvalService.requestApproval('test-tool', {}, 'work', 'execute');
    expect(response.approved).toBe(false);
    expect(response.reason).toBe('not allowed');
  });

  it('should track pending requests', async () => {
    // Create a fresh approval service with a listener that doesn't auto-approve
    const approveLater = new ApprovalService();

    approveLater.on('approval:requested', _req => {
      // Don't approve yet - keep it pending
    });

    const promise = approveLater.requestApproval('tool1', {}, 'work', 'execute');

    // Wait a tick for the event to be processed
    await new Promise(r => setTimeout(r, 10));
    expect(approveLater.getPendingCount()).toBe(1);

    // Now approve all
    approveLater.approveAll();
    await promise;
    expect(approveLater.getPendingCount()).toBe(0);
  });
});

// ── Test Suite: ToolService + SecurityGuard Integration ──────────

describe('ToolService + SecurityGuard', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-security-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  describe('Plan Preset (L1: Read-only)', () => {
    it('should allow file read operations', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('plan');
      autoApprove(approvalService);

      const filePath = path.join(tempDir, 'readme.txt');
      await fs.writeFile(filePath, 'hello', 'utf-8');

      const result = await toolService.execute(
        'builtin:file',
        { operation: 'read', path: filePath },
        createToolContext()
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('hello');
    });

    it('should block file write operations', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('plan');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:file',
        { operation: 'write', path: path.join(tempDir, 'blocked.txt'), content: 'test' },
        createToolContext()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authorization denied');
    });

    it('should block shell command execution', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('plan');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:shell',
        { command: 'echo', args: ['hello'], captureStdout: true },
        createToolContext()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authorization denied');
    });

    it('should allow search operations', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('plan');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:search',
        { operation: 'grep', pattern: 'test', paths: [tempDir], options: {} },
        createToolContext()
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Create Preset (L2: Read-write)', () => {
    it('should allow file write operations', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('create');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:file',
        { operation: 'write', path: path.join(tempDir, 'created.txt'), content: 'created' },
        createToolContext()
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(tempDir, 'created.txt'), 'utf-8');
      expect(content).toBe('created');
    });

    it('should allow file read operations', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('create');
      autoApprove(approvalService);

      const filePath = path.join(tempDir, 'read.txt');
      await fs.writeFile(filePath, 'readable', 'utf-8');

      const result = await toolService.execute(
        'builtin:file',
        { operation: 'read', path: filePath },
        createToolContext()
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('readable');
    });

    it('should block shell command execution', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('create');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:shell',
        { command: 'echo', args: ['hello'], captureStdout: true },
        createToolContext()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authorization denied');
    });
  });

  describe('Work Preset (L3: Read-write-execute)', () => {
    it('should allow shell command execution (with approval)', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('work');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:shell',
        { command: 'echo', args: ['hello_from_work'], captureStdout: true },
        createToolContext()
      );

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.stdout).toContain('hello_from_work');
    });

    it('should block execution when approval is denied', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('work');
      autoDeny(approvalService);

      const result = await toolService.execute(
        'builtin:shell',
        { command: 'echo', args: ['test'], captureStdout: true },
        createToolContext()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authorization denied');
    });

    it('should allow file write operations', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('work');
      autoApprove(approvalService);

      const result = await toolService.execute(
        'builtin:file',
        { operation: 'write', path: path.join(tempDir, 'work.txt'), content: 'work content' },
        createToolContext()
      );

      expect(result.success).toBe(true);
    });
  });

  describe('YOLO Preset (L4: Full access, no approval)', () => {
    it('should allow file operations without approval', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('yolo');

      // No approval listener registered - should still work
      let approvalRequested = false;
      approvalService.on('approval:requested', () => {
        approvalRequested = true;
      });

      const result = await toolService.execute(
        'builtin:file',
        { operation: 'write', path: path.join(tempDir, 'yolo.txt'), content: 'yolo' },
        createToolContext()
      );

      expect(result.success).toBe(true);
      expect(approvalRequested).toBe(false); // YOLO doesn't need approval
    });

    it('should allow shell commands without approval', async () => {
      const { toolService, approvalService } = createToolServiceWithGuard('yolo');

      let approvalRequested = false;
      approvalService.on('approval:requested', () => {
        approvalRequested = true;
      });

      const result = await toolService.execute(
        'builtin:shell',
        { command: 'echo', args: ['yolo_mode'], captureStdout: true },
        createToolContext()
      );

      expect(result.success).toBe(true);
      expect(approvalRequested).toBe(false);
      const data = result.data as any;
      expect(data.stdout).toContain('yolo_mode');
    });

    it('should allow all search operations without approval', async () => {
      const { toolService } = createToolServiceWithGuard('yolo');

      const result = await toolService.execute(
        'builtin:search',
        { operation: 'grep', pattern: 'test', paths: [tempDir], options: {} },
        createToolContext()
      );

      expect(result.success).toBe(true);
    });
  });
});

// ── Test Suite: Preset Switching in ToolService ──────────────────

describe('Preset Switching in ToolService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-switch-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('should switch from plan to yolo and gain full access', async () => {
    const { toolService, guard, approvalService } = createToolServiceWithGuard('plan');
    autoApprove(approvalService);

    // Plan: cannot write
    const planResult = await toolService.execute(
      'builtin:file',
      { operation: 'write', path: path.join(tempDir, 'test.txt'), content: 'test' },
      createToolContext()
    );
    expect(planResult.success).toBe(false);

    // Switch to YOLO
    guard.switchPreset('yolo');

    // YOLO: can write
    const yoloResult = await toolService.execute(
      'builtin:file',
      { operation: 'write', path: path.join(tempDir, 'test.txt'), content: 'test' },
      createToolContext()
    );
    expect(yoloResult.success).toBe(true);
  });

  it('should switch from work to create and lose execution ability', async () => {
    const { toolService, guard, approvalService } = createToolServiceWithGuard('work');
    autoApprove(approvalService);

    // Work: can execute
    const workResult = await toolService.execute(
      'builtin:shell',
      { command: 'echo', args: ['test'], captureStdout: true },
      createToolContext()
    );
    expect(workResult.success).toBe(true);

    // Switch to create
    guard.switchPreset('create');

    // Create: cannot execute
    const createResult = await toolService.execute(
      'builtin:shell',
      { command: 'echo', args: ['test'], captureStdout: true },
      createToolContext()
    );
    expect(createResult.success).toBe(false);
    expect(createResult.error).toContain('Authorization denied');
  });
});

// ── Test Suite: ToolService without SecurityGuard ────────────────

describe('ToolService without SecurityGuard', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-noguard-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('should allow all operations when no guard is set (backward compatible)', async () => {
    const toolService = new ToolService({ enableValidation: true });
    toolService.registerTool(new FileTool());
    toolService.registerTool(new ShellTool());

    // File read
    const filePath = path.join(tempDir, 'noguard.txt');
    await fs.writeFile(filePath, 'noguard', 'utf-8');
    const readResult = await toolService.execute(
      'builtin:file',
      { operation: 'read', path: filePath },
      createToolContext()
    );
    expect(readResult.success).toBe(true);

    // File write
    const writeResult = await toolService.execute(
      'builtin:file',
      { operation: 'write', path: path.join(tempDir, 'new.txt'), content: 'test' },
      createToolContext()
    );
    expect(writeResult.success).toBe(true);

    // Shell command
    const shellResult = await toolService.execute(
      'builtin:shell',
      { command: 'echo', args: ['test'], captureStdout: true },
      createToolContext()
    );
    expect(shellResult.success).toBe(true);
  });
});
