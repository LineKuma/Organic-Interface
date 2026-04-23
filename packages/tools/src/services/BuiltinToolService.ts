/**
 * Builtin Tool Service - Manages built-in tools registration and lifecycle
 */

import {
  type ToolDefinition,
  ToolType,
  ToolCallLevel,
  type ToolParameterDefinition,
} from '@organic/utils';

/**
 * Builtin tool metadata for registration
 */
export interface BuiltinToolMetadata {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool type */
  type: ToolType;
  /** Call level */
  callLevel: ToolCallLevel;
  /** Parameter definitions */
  parameters: ToolParameterDefinition;
  /** Max execution time */
  maxExecutionTime?: number;
}

/**
 * Builtin tools registry
 */
export const BUILTIN_TOOLS: BuiltinToolMetadata[] = [
  // File Operation Tools
  {
    name: 'file_read',
    description: 'Read file contents from the file system',
    type: ToolType.FILE_OPERATION,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        path: {
          name: 'path',
          type: 'string',
          description: 'File path to read',
          required: true,
        },
        encoding: {
          name: 'encoding',
          type: 'string',
          description: 'File encoding (default: utf-8)',
          required: false,
          default: 'utf-8',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    maxExecutionTime: 10000,
  },
  {
    name: 'file_write',
    description: 'Write content to a file',
    type: ToolType.FILE_OPERATION,
    callLevel: ToolCallLevel.RESTRICTED,
    parameters: {
      type: 'object',
      properties: {
        path: {
          name: 'path',
          type: 'string',
          description: 'File path to write',
          required: true,
        },
        content: {
          name: 'content',
          type: 'string',
          description: 'Content to write to file',
          required: true,
        },
        encoding: {
          name: 'encoding',
          type: 'string',
          description: 'File encoding (default: utf-8)',
          required: false,
          default: 'utf-8',
        },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    maxExecutionTime: 15000,
  },
  {
    name: 'file_list',
    description: 'List files in a directory',
    type: ToolType.FILE_OPERATION,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        path: {
          name: 'path',
          type: 'string',
          description: 'Directory path to list',
          required: true,
        },
        recursive: {
          name: 'recursive',
          type: 'boolean',
          description: 'Whether to list recursively',
          required: false,
          default: false,
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    maxExecutionTime: 5000,
  },
  {
    name: 'file_exists',
    description: 'Check if a file or directory exists',
    type: ToolType.FILE_OPERATION,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        path: {
          name: 'path',
          type: 'string',
          description: 'Path to check',
          required: true,
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    maxExecutionTime: 1000,
  },

  // Search Tools
  {
    name: 'file_search',
    description: 'Search file contents using patterns',
    type: ToolType.SEARCH,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          name: 'pattern',
          type: 'string',
          description: 'Search pattern or regex',
          required: true,
        },
        path: {
          name: 'path',
          type: 'string',
          description: 'Directory to search in',
          required: false,
        },
        caseSensitive: {
          name: 'caseSensitive',
          type: 'boolean',
          description: 'Case sensitive search',
          required: false,
          default: false,
        },
        maxResults: {
          name: 'maxResults',
          type: 'number',
          description: 'Maximum number of results',
          required: false,
          default: 100,
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    maxExecutionTime: 30000,
  },
  {
    name: 'code_search',
    description: 'Search code patterns in files',
    type: ToolType.SEARCH,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          name: 'pattern',
          type: 'string',
          description: 'Code pattern to search',
          required: true,
        },
        path: {
          name: 'path',
          type: 'string',
          description: 'Directory to search in',
          required: false,
        },
        fileTypes: {
          name: 'fileTypes',
          type: 'array',
          description: 'File extensions to search (e.g., [".ts", ".js"])',
          required: false,
        },
        maxResults: {
          name: 'maxResults',
          type: 'number',
          description: 'Maximum number of results',
          required: false,
          default: 50,
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    maxExecutionTime: 30000,
  },
  {
    name: 'glob_search',
    description: 'Search files by glob pattern',
    type: ToolType.SEARCH,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          name: 'pattern',
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts")',
          required: true,
        },
        path: {
          name: 'path',
          type: 'string',
          description: 'Base directory for pattern matching',
          required: false,
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    maxExecutionTime: 10000,
  },

  // System Tools
  {
    name: 'path_resolve',
    description: 'Resolve and normalize file paths',
    type: ToolType.SYSTEM,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        path: {
          name: 'path',
          type: 'string',
          description: 'Path to resolve',
          required: true,
        },
        basePath: {
          name: 'basePath',
          type: 'string',
          description: 'Base path for relative resolution',
          required: false,
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    maxExecutionTime: 1000,
  },
  {
    name: 'path_join',
    description: 'Join path segments',
    type: ToolType.SYSTEM,
    callLevel: ToolCallLevel.NORMAL,
    parameters: {
      type: 'object',
      properties: {
        segments: {
          name: 'segments',
          type: 'array',
          description: 'Path segments to join',
          required: true,
        },
      },
      required: ['segments'],
      additionalProperties: false,
    },
    maxExecutionTime: 1000,
  },
];

/**
 * BuiltinToolService - Manages built-in tools
 */
export class BuiltinToolService {
  /**
   * Get all built-in tool definitions
   */
  static getToolDefinitions(): ToolDefinition[] {
    return BUILTIN_TOOLS.map(tool => ({
      name: tool.name,
      version: '1.0.0',
      description: tool.description,
      type: tool.type,
      call_level: tool.callLevel,
      parameters: tool.parameters,
      max_execution_time: tool.maxExecutionTime,
    }));
  }

  /**
   * Get built-in tool by name
   */
  static getToolDefinition(name: string): ToolDefinition | null {
    const tool = BUILTIN_TOOLS.find(t => t.name === name);
    if (!tool) {
      return null;
    }
    return {
      name: tool.name,
      version: '1.0.0',
      description: tool.description,
      type: tool.type,
      call_level: tool.callLevel,
      parameters: tool.parameters,
      max_execution_time: tool.maxExecutionTime,
    };
  }

  /**
   * Get tools by type
   */
  static getToolsByType(type: ToolType): ToolDefinition[] {
    return BUILTIN_TOOLS.filter(tool => tool.type === type).map(tool => ({
      name: tool.name,
      version: '1.0.0',
      description: tool.description,
      type: tool.type,
      call_level: tool.callLevel,
      parameters: tool.parameters,
      max_execution_time: tool.maxExecutionTime,
    }));
  }

  /**
   * Get all tool names
   */
  static getToolNames(): string[] {
    return BUILTIN_TOOLS.map(tool => tool.name);
  }

  /**
   * Check if tool is built-in
   */
  static isBuiltinTool(name: string): boolean {
    return BUILTIN_TOOLS.some(tool => tool.name === name);
  }

  /**
   * Get built-in tool metadata
   */
  static getToolMetadata(name: string): BuiltinToolMetadata | null {
    return BUILTIN_TOOLS.find(tool => tool.name === name) ?? null;
  }
}
