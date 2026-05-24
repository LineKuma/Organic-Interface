import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import {
  ToolService,
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolValidationError,
} from '@organic/tools';
import { ToolExecutor, type ToolExecutionOptions } from '@organic/tools';

class TestTool implements Tool {
  private definition: ToolDefinition;

  constructor(id: string, name: string, category: string = 'custom', timeout: number = 5000) {
    this.definition = {
      id,
      name,
      description: `Test tool: ${name}`,
      category: category as any,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      enabled: true,
      timeout,
    };
  }

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    if (!input || typeof input !== 'object') {
      return [{ path: '', message: 'Input must be an object' }];
    }
    return [];
  }

  async execute(input: unknown, _context: ToolExecutionContext): Promise<ToolResult> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      success: true,
      data: { result: 'executed', input },
      executionTime: 10,
    };
  }
}

class SlowTool implements Tool {
  private definition: ToolDefinition;

  constructor(id: string, name: string, delayMs: number = 100) {
    this.definition = {
      id,
      name,
      description: `Slow test tool: ${name}`,
      category: 'slow' as any,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      enabled: true,
      timeout: 5000,
    };
    this.delayMs = delayMs;
  }

  private delayMs: number;

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    return [];
  }

  async execute(input: unknown, _context: ToolExecutionContext): Promise<ToolResult> {
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    return {
      success: true,
      data: { result: 'slow-executed', input },
      executionTime: this.delayMs,
    };
  }
}

class ValidatingTool implements Tool {
  private definition: ToolDefinition;

  constructor(id: string, name: string, validateFn: (input: unknown) => ToolValidationError[] = () => []) {
    this.definition = {
      id,
      name,
      description: `Validating tool: ${name}`,
      category: 'validating' as any,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      enabled: true,
      timeout: 5000,
    };
    this.validateFn = validateFn;
  }

  private validateFn: (input: unknown) => ToolValidationError[];

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    return this.validateFn(input);
  }

  async execute(input: unknown, _context: ToolExecutionContext): Promise<ToolResult> {
    return {
      success: true,
      data: { result: 'executed', input },
      executionTime: 5,
    };
  }
}

describe('Tool Service', () => {
  let kernel: Kernel;
  let toolService: ToolService;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();

    toolService = new ToolService({
      enableMetrics: false,
    });
  });

  afterEach(async () => {
    toolService.clear();
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  it('should register tools', async () => {
    const tool = new TestTool('test-tool-1', 'Test Tool 1');

    toolService.registerTool(tool);

    expect(toolService.hasTool('test-tool-1')).toBe(true);
    const def = toolService.getToolDefinition('test-tool-1');
    expect(def).toBeDefined();
    expect(def?.name).toBe('Test Tool 1');
  });

  it('should unregister tools', async () => {
    const tool = new TestTool('unreg-tool', 'Unregister Tool');
    toolService.registerTool(tool);

    expect(toolService.hasTool('unreg-tool')).toBe(true);

    const result = toolService.unregisterTool('unreg-tool');
    expect(result).toBe(true);
    expect(toolService.hasTool('unreg-tool')).toBe(false);
  });

  it('should execute tools', async () => {
    const tool = new TestTool('exec-tool', 'Execute Tool');
    toolService.registerTool(tool);

    const result = await toolService.execute('exec-tool', { test: 'data' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should handle tool execution errors', async () => {
    const tool = new TestTool('error-tool', 'Error Tool');
    toolService.registerTool(tool);

    const result = await toolService.execute('non-existent-tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should get all registered tools', async () => {
    toolService.registerTool(new TestTool('list-tool-1', 'List Tool 1'));
    toolService.registerTool(new TestTool('list-tool-2', 'List Tool 2'));

    const tools = toolService.getAllTools();
    expect(tools.length).toBeGreaterThanOrEqual(2);
  });

  it('should enable and disable tools', async () => {
    const tool = new TestTool('toggle-tool', 'Toggle Tool');
    toolService.registerTool(tool);

    expect(toolService.isToolEnabled('toggle-tool')).toBe(true);

    toolService.disableTool('toggle-tool');
    expect(toolService.isToolEnabled('toggle-tool')).toBe(false);

    toolService.enableTool('toggle-tool');
    expect(toolService.isToolEnabled('toggle-tool')).toBe(true);
  });

  it('should validate tool input', async () => {
    const tool = new TestTool('valid-tool', 'Valid Tool');
    toolService.registerTool(tool);

    const errors = toolService.validate('valid-tool', { test: 'data' });
    expect(errors.length).toBe(0);
  });

  it('should get service statistics', async () => {
    const tool = new TestTool('stat-tool', 'Stat Tool');
    toolService.registerTool(tool);

    const stats = toolService.getServiceStats();
    expect(stats.totalTools).toBe(1);
    expect(stats.enabledTools).toBe(1);
  });

  describe('ToolExecutor', () => {
    let executor: ToolExecutor;

    beforeEach(() => {
      executor = new ToolExecutor({
        maxConcurrent: 3,
        defaultTimeout: 5000,
        enableCancellation: true,
      });
      executor.start();
    });

    afterEach(async () => {
      await executor.stop();
    });

    it('should execute tool directly', async () => {
      const tool = new TestTool('direct-tool', 'Direct Tool');
      const context: ToolExecutionContext = {
        executionId: 'exec-1',
        metadata: {},
      };

      const result = await executor.execute(tool, { data: 'test' }, context, {});

      expect(result.success).toBe(true);
    });

    it('should handle tool timeout', async () => {
      const slowTool = new SlowTool('slow-tool', 'Slow Tool', 2000);
      const context: ToolExecutionContext = {
        executionId: 'exec-timeout',
        metadata: {},
      };
      const options: ToolExecutionOptions = {
        timeout: 100,
      };

      const result = await executor.execute(slowTool, {}, context, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should execute multiple tools in sequence', async () => {
      const tool1 = new TestTool('batch-tool-1', 'Batch Tool 1');
      const tool2 = new TestTool('batch-tool-2', 'Batch Tool 2');
      const context1: ToolExecutionContext = { executionId: 'batch-1', metadata: {} };
      const context2: ToolExecutionContext = { executionId: 'batch-2', metadata: {} };

      const result1 = await executor.execute(tool1, { order: 1 }, context1, {});
      const result2 = await executor.execute(tool2, { order: 2 }, context2, {});

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data).toBeDefined();
      expect(result2.data).toBeDefined();
    });

    it('should validate tool input before execution', async () => {
      const validatingTool = new ValidatingTool('validate-tool', 'Validate Tool', (input) => {
        if (!input || typeof input !== 'object') {
          return [{ path: '', message: 'Input must be an object' }];
        }
        if (!(input as any).requiredField) {
          return [{ path: 'requiredField', message: 'requiredField is missing' }];
        }
        return [];
      });

      toolService.registerTool(validatingTool);

      const errors = toolService.validate('validate-tool', {});
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('requiredField');
    });

    it('should handle execution errors gracefully', async () => {
      const errorTool = new ValidatingTool('error-tool', 'Error Tool', () => []);

      executor.on('execution:failed', (data) => {
        expect(data.toolId).toBe('error-tool');
      });

      const context: ToolExecutionContext = {
        executionId: 'exec-error',
        metadata: {},
      };

      const result = await executor.execute(errorTool, {}, context, {});
      expect(result).toBeDefined();
    });
  });
});