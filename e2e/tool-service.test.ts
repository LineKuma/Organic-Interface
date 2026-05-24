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

class TestTool implements Tool {
  private definition: ToolDefinition;

  constructor(id: string, name: string, category: string = 'custom') {
    this.definition = {
      id,
      name,
      description: `Test tool: ${name}`,
      category: category as any,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      enabled: true,
      timeout: 5000,
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
});