/**
 * FileTool - Built-in file operation tools
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolType,
  ToolCallLevel,
  ToolParameterDefinition,
} from '@organic/utils';
import { ToolErrorCode as ErrorCode } from '@organic/utils';

/**
 * File tool handler functions
 */
export const fileToolHandlers = {
  /**
   * file_read - Read file contents
   */
  async file_read(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const filePath = String(params.path);
    const encoding = String(params.encoding ?? 'utf-8');

    try {
      context.logger.debug(`Reading file: ${filePath}`);
      
      const content = await fs.readFile(filePath, { encoding });
      
      return {
        success: true,
        data: {
          path: filePath,
          content,
          size: content.length,
          encoding,
        },
        metadata: {
          tool_name: 'file_read',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Failed to read file: ${filePath}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'file_read',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * file_write - Write content to file
   */
  async file_write(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const filePath = String(params.path);
    const content = String(params.content);
    const encoding = String(params.encoding ?? 'utf-8');

    try {
      context.logger.debug(`Writing file: ${filePath}`);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, content, { encoding });
      
      return {
        success: true,
        data: {
          path: filePath,
          bytesWritten: content.length,
          encoding,
        },
        metadata: {
          tool_name: 'file_write',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Failed to write file: ${filePath}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'file_write',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * file_list - List directory contents
   */
  async file_list(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const dirPath = String(params.path);
    const recursive = Boolean(params.recursive ?? false);

    try {
      context.logger.debug(`Listing directory: ${dirPath}`);
      
      const entries = await listDirectory(dirPath, recursive);
      
      return {
        success: true,
        data: {
          path: dirPath,
          entries,
          count: entries.length,
          recursive,
        },
        metadata: {
          tool_name: 'file_list',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Failed to list directory: ${dirPath}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'file_list',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * file_exists - Check if file or directory exists
   */
  async file_exists(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const targetPath = String(params.path);

    try {
      context.logger.debug(`Checking existence: ${targetPath}`);
      
      await fs.access(targetPath);
      
      const stats = await fs.stat(targetPath);
      
      return {
        success: true,
        data: {
          path: targetPath,
          exists: true,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
        },
        metadata: {
          tool_name: 'file_exists',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch {
      return {
        success: true,
        data: {
          path: targetPath,
          exists: false,
          isFile: false,
          isDirectory: false,
        },
        metadata: {
          tool_name: 'file_exists',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },
};

/**
 * List directory contents
 */
async function listDirectory(
  dirPath: string,
  recursive: boolean
): Promise<Array<{
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}>> {
  const entries: Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
  }> = [];

  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const entry: {
      name: string;
      path: string;
      type: 'file' | 'directory';
      size?: number;
    } = {
      name: item.name,
      path: fullPath,
      type: item.isDirectory() ? 'directory' : 'file',
    };

    if (item.isFile()) {
      const stats = await fs.stat(fullPath);
      entry.size = stats.size;
    }

    entries.push(entry);

    if (recursive && item.isDirectory()) {
      try {
        const subEntries = await listDirectory(fullPath, true);
        entries.push(...subEntries);
      } catch {
        // Skip inaccessible directories
      }
    }
  }

  return entries;
}

/**
 * Get file tool definitions
 */
export function getFileToolDefinitions(): Array<{
  definition: ToolDefinition;
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}> {
  return [
    {
      definition: {
        name: 'file_read',
        version: '1.0.0',
        description: 'Read file contents from the file system',
        type: ToolType.FILE_OPERATION,
        call_level: ToolCallLevel.NORMAL,
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
        max_execution_time: 10000,
      },
      handler: fileToolHandlers.file_read,
    },
    {
      definition: {
        name: 'file_write',
        version: '1.0.0',
        description: 'Write content to a file',
        type: ToolType.FILE_OPERATION,
        call_level: ToolCallLevel.RESTRICTED,
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
        max_execution_time: 15000,
      },
      handler: fileToolHandlers.file_write,
    },
    {
      definition: {
        name: 'file_list',
        version: '1.0.0',
        description: 'List files in a directory',
        type: ToolType.FILE_OPERATION,
        call_level: ToolCallLevel.NORMAL,
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
        max_execution_time: 5000,
      },
      handler: fileToolHandlers.file_list,
    },
    {
      definition: {
        name: 'file_exists',
        version: '1.0.0',
        description: 'Check if a file or directory exists',
        type: ToolType.FILE_OPERATION,
        call_level: ToolCallLevel.NORMAL,
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
        max_execution_time: 1000,
      },
      handler: fileToolHandlers.file_exists,
    },
  ];
}
