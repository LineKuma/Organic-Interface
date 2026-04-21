/**
 * @organic/tools - Tools service module
 */

export {
  type ToolDefinition,
  type ToolParameter,
  type ToolResult,
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/shared';

/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool ${name} not found` };
    }
    return tool.execute(params);
  }
}

// Built-in tools
export const builtinTools: ToolDefinition[] = [
  {
    name: 'file.read',
    description: 'Read file contents',
    parameters: [
      { name: 'path', type: 'string', description: 'File path', required: true },
    ],
    execute: async (params) => ({ success: true, data: null }),
  },
  {
    name: 'file.write',
    description: 'Write content to file',
    parameters: [
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true },
    ],
    execute: async (params) => ({ success: true, data: null }),
  },
];
