/**
 * FileTool - Built-in tool for file operations
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  type Tool,
  type ToolDefinition,
  type ToolResult,
  type ToolExecutionContext,
  type ToolValidationError,
} from '../types/index.js';

/**
 * FileTool input schema
 */
interface FileToolInput {
  /** Operation to perform */
  operation: 'read' | 'write' | 'delete' | 'exists' | 'list' | 'stat' | 'mkdir' | 'copy' | 'move';

  /** File path */
  path?: string;

  /** Source path (for copy/move) */
  source?: string;

  /** Destination path (for copy/move) */
  destination?: string;

  /** Content to write (for write operation) */
  content?: string;

  /** Whether to create directories (for write operation) */
  createDirectories?: boolean;

  /** Recursive flag (for list/delete operations) */
  recursive?: boolean;

  /** Pattern for filtering (for list operation) */
  pattern?: string;
}

/**
 * FileTool - Built-in file operation tool
 */
export class FileTool implements Tool {
  private definition: ToolDefinition;

  constructor() {
    this.definition = {
      id: 'builtin:file',
      name: 'FileTool',
      description: 'Built-in tool for file system operations including read, write, delete, and list',
      category: 'file',
      inputSchema: {
        type: 'object',
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['read', 'write', 'delete', 'exists', 'list', 'stat', 'mkdir', 'copy', 'move'],
            description: 'File operation to perform',
          },
          path: {
            type: 'string',
            description: 'File or directory path',
          },
          source: {
            type: 'string',
            description: 'Source path for copy/move operations',
          },
          destination: {
            type: 'string',
            description: 'Destination path for copy/move operations',
          },
          content: {
            type: 'string',
            description: 'Content to write (for write operation)',
          },
          createDirectories: {
            type: 'boolean',
            description: 'Create parent directories if they do not exist',
          },
          recursive: {
            type: 'boolean',
            description: 'Perform operation recursively',
          },
          pattern: {
            type: 'string',
            description: 'Pattern for filtering files (glob pattern)',
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'any' },
          error: { type: 'string' },
        },
      },
      enabled: true,
      timeout: 10000,
      permissions: [
        { type: 'filesystem', scope: 'read', granted: true },
        { type: 'filesystem', scope: 'write', granted: true },
      ],
    };
  }

  getDefinition(): ToolDefinition {
    return this.definition;
  }

  validate(input: unknown): ToolValidationError[] {
    const errors: ToolValidationError[] = [];
    const data = input as Partial<FileToolInput>;

    if (!data.operation) {
      errors.push({
        path: 'operation',
        message: 'Operation is required',
        expected: 'string',
        actual: data.operation,
      });
    } else if (!['read', 'write', 'delete', 'exists', 'list', 'stat', 'mkdir', 'copy', 'move'].includes(data.operation)) {
      errors.push({
        path: 'operation',
        message: 'Invalid operation',
        expected: 'read|write|delete|exists|list|stat|mkdir|copy|move',
        actual: data.operation,
      });
    }

    const operation = data.operation;

    // Validate operation-specific requirements
    if (['read', 'write', 'delete', 'exists', 'stat', 'mkdir'].includes(operation as string) && !(data as FileToolInput).path) {
      errors.push({
        path: 'path',
        message: 'Path is required for this operation',
        expected: 'string',
        actual: (data as FileToolInput).path,
      });
    }

    if (['copy', 'move'].includes(operation as string)) {
      if (!(data as FileToolInput).source) {
        errors.push({
          path: 'source',
          message: 'Source path is required for copy/move operations',
          expected: 'string',
          actual: (data as FileToolInput).source,
        });
      }
      if (!(data as FileToolInput).destination) {
        errors.push({
          path: 'destination',
          message: 'Destination path is required for copy/move operations',
          expected: 'string',
          actual: (data as FileToolInput).destination,
        });
      }
    }

    if (data.operation === 'write' && data.content === undefined) {
      errors.push({
        path: 'content',
        message: 'Content is required for write operation',
        expected: 'string',
        actual: data.content,
      });
    }

    return errors;
  }

  async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const data = input as FileToolInput;
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (data.operation) {
        case 'read':
          result = await this.readFile(data.path!);
          break;

        case 'write':
          result = await this.writeFile(data.path!, data.content!, data.createDirectories);
          break;

        case 'delete':
          result = await this.deleteFile(data.path!, data.recursive);
          break;

        case 'exists':
          result = await this.exists(data.path!);
          break;

        case 'list':
          result = await this.listDirectory(data.path!, data.recursive, data.pattern);
          break;

        case 'stat':
          result = await this.getStat(data.path!);
          break;

        case 'mkdir':
          result = await this.makeDirectory(data.path!, data.createDirectories);
          break;

        case 'copy':
          result = await this.copyFile(data.source!, data.destination!);
          break;

        case 'move':
          result = await this.moveFile(data.source!, data.destination!);
          break;

        default:
          throw new Error(`Unknown operation: ${data.operation}`);
      }

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  private async writeFile(filePath: string, content: string, createDirs?: boolean): Promise<{ path: string; bytes: number }> {
    if (createDirs) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }
    await fs.writeFile(filePath, content, 'utf-8');
    return { path: filePath, bytes: Buffer.byteLength(content, 'utf-8') };
  }

  private async deleteFile(filePath: string, recursive?: boolean): Promise<{ deleted: boolean; path: string }> {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fs.rm(filePath, { recursive: recursive ?? false });
    } else {
      await fs.unlink(filePath);
    }
    return { deleted: true, path: filePath };
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async listDirectory(dirPath: string, recursive?: boolean, pattern?: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        const subResults = await this.listDirectory(fullPath, true, pattern);
        results.push(...subResults);
      } else if (entry.isFile()) {
        if (pattern) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          if (regex.test(entry.name)) {
            results.push(fullPath);
          }
        } else {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  private async getStat(filePath: string): Promise<{
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    created: string;
    modified: string;
    accessed: string;
  }> {
    const stat = await fs.stat(filePath);
    return {
      size: stat.size,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      accessed: stat.atime.toISOString(),
    };
  }

  private async makeDirectory(dirPath: string, createParents?: boolean): Promise<{ path: string; created: boolean }> {
    await fs.mkdir(dirPath, { recursive: createParents ?? true });
    return { path: dirPath, created: true };
  }

  private async copyFile(source: string, destination: string): Promise<{ source: string; destination: string }> {
    const destDir = path.dirname(destination);
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(source, destination);
    return { source, destination };
  }

  private async moveFile(source: string, destination: string): Promise<{ source: string; destination: string }> {
    const destDir = path.dirname(destination);
    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(source, destination);
    return { source, destination };
  }
}

/**
 * Create a FileTool instance
 */
export function createFileTool(): FileTool {
  return new FileTool();
}
