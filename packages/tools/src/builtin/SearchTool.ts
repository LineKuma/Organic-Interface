/**
 * SearchTool - Built-in search tools
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolType,
  ToolCallLevel,
} from '@organic/utils';
import { ToolErrorCode as ErrorCode } from '@organic/utils';

/**
 * Search result entry
 */
interface SearchResult {
  file: string;
  line: number;
  content: string;
  match: string;
}

/**
 * Glob match result
 */
interface GlobResult {
  path: string;
  name: string;
  isDirectory: boolean;
}

/**
 * Search tool handler functions
 */
export const searchToolHandlers = {
  /**
   * file_search - Search file contents using patterns
   */
  async file_search(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const pattern = String(params.pattern);
    const searchPath = params.path ? String(params.path) : process.cwd();
    const caseSensitive = Boolean(params.caseSensitive ?? false);
    const maxResults = Number(params.maxResults ?? 100);

    try {
      context.logger.debug(`Searching pattern: ${pattern}`, { searchPath, caseSensitive });

      const results = await searchFiles(searchPath, pattern, {
        caseSensitive,
        maxResults,
        fileExtensions: null, // Search all files
      });

      return {
        success: true,
        data: {
          pattern,
          searchPath,
          caseSensitive,
          results,
          totalMatches: results.length,
        },
        metadata: {
          tool_name: 'file_search',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Search failed: ${pattern}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'file_search',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * code_search - Search code patterns in files
   */
  async code_search(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const pattern = String(params.pattern);
    const searchPath = params.path ? String(params.path) : process.cwd();
    const fileTypes = params.fileTypes as string[] | undefined;
    const maxResults = Number(params.maxResults ?? 50);

    try {
      context.logger.debug(`Searching code: ${pattern}`, { searchPath, fileTypes });

      const results = await searchFiles(searchPath, pattern, {
        caseSensitive: true,
        maxResults,
        fileExtensions: fileTypes?.map(ext => ext.startsWith('.') ? ext : `.${ext}`) ?? null,
      });

      return {
        success: true,
        data: {
          pattern,
          searchPath,
          fileTypes,
          results,
          totalMatches: results.length,
        },
        metadata: {
          tool_name: 'code_search',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Code search failed: ${pattern}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Code search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'code_search',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * glob_search - Search files by glob pattern
   */
  async glob_search(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const pattern = String(params.pattern);
    const basePath = params.path ? String(params.path) : process.cwd();

    try {
      context.logger.debug(`Glob pattern: ${pattern}`, { basePath });

      const results = await globMatch(basePath, pattern);

      return {
        success: true,
        data: {
          pattern,
          basePath,
          results,
          totalMatches: results.length,
        },
        metadata: {
          tool_name: 'glob_search',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Glob search failed: ${pattern}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Glob search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'glob_search',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * path_resolve - Resolve and normalize file paths
   */
  async path_resolve(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const targetPath = String(params.path);
    const basePath = params.basePath ? String(params.basePath) : process.cwd();

    try {
      const resolved = path.resolve(basePath, targetPath);
      const normalized = path.normalize(resolved);
      const relative = path.relative(basePath, resolved);

      return {
        success: true,
        data: {
          original: targetPath,
          base: basePath,
          resolved,
          normalized,
          relative,
          isAbsolute: path.isAbsolute(targetPath),
          ext: path.extname(targetPath),
          basename: path.basename(targetPath),
          dirname: path.dirname(targetPath),
        },
        metadata: {
          tool_name: 'path_resolve',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Path resolve failed: ${targetPath}`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Path resolve failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'path_resolve',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }
  },

  /**
   * path_join - Join path segments
   */
  async path_join(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const segments = params.segments as string[];

    if (!Array.isArray(segments) || segments.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCode.INVALID_ARGUMENTS,
          message: 'segments must be a non-empty array of strings',
        },
        metadata: {
          tool_name: 'path_join',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    }

    try {
      const joined = path.join(...segments);
      const normalized = path.normalize(joined);
      const resolved = path.resolve(joined);

      return {
        success: true,
        data: {
          segments,
          joined,
          normalized,
          resolved,
        },
        metadata: {
          tool_name: 'path_join',
          start_time: startTime,
          end_time: Date.now(),
          execution_time: Date.now() - startTime,
          request_id: context.request_id,
        },
      };
    } catch (error) {
      context.logger.error(`Path join failed`, error);
      return {
        success: false,
        error: {
          code: ErrorCode.EXECUTION_ERROR,
          message: `Path join failed: ${error instanceof Error ? error.message : String(error)}`,
        },
        metadata: {
          tool_name: 'path_join',
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
 * Search files for pattern
 */
async function searchFiles(
  searchPath: string,
  pattern: string,
  options: {
    caseSensitive: boolean;
    maxResults: number;
    fileExtensions: string[] | null;
  }
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const regex = new RegExp(
    pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    options.caseSensitive ? 'g' : 'gi'
  );

  const searchDir = async (dir: string, depth: number = 0): Promise<void> => {
    if (depth > 10 || results.length >= options.maxResults) return; // Prevent infinite recursion

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= options.maxResults) break;

        const fullPath = path.join(dir, entry.name);

        // Skip node_modules and hidden directories
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          await searchDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // Filter by extension if specified
          if (options.fileExtensions) {
            const ext = path.extname(entry.name);
            if (!options.fileExtensions.includes(ext)) continue;
          }

          // Skip binary files
          if (isBinaryFile(entry.name)) continue;

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({
                  file: fullPath,
                  line: i + 1,
                  content: lines[i].trim(),
                  match: lines[i].match(regex)?.[0] ?? '',
                });

                if (results.length >= options.maxResults) break;
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  };

  await searchDir(searchPath);
  return results;
}

/**
 * Match glob pattern
 */
async function globMatch(basePath: string, pattern: string): Promise<GlobResult[]> {
  const results: GlobResult[] = [];
  
  // Parse glob pattern
  const parts = pattern.split('/');
  let currentPattern = parts[0];
  let currentPath = basePath;
  let isRecursive = false;

  // Handle ** pattern
  if (pattern.startsWith('**/')) {
    isRecursive = true;
    currentPattern = parts.slice(1).join('/');
  } else if (pattern.includes('**')) {
    isRecursive = true;
  }

  const matchGlob = async (dir: string, globPattern: string, recursive: boolean, depth: number = 0): Promise<void> => {
    if (depth > 20) return; // Prevent infinite recursion

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Match pattern
        if (matchPattern(entry.name, globPattern)) {
          results.push({
            path: fullPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
          });
        }

        // Recurse into directories
        if (recursive && entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await matchGlob(fullPath, globPattern, recursive, depth + 1);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  };

  await matchGlob(currentPath, currentPattern, isRecursive);
  return results;
}

/**
 * Match a name against a glob pattern
 */
function matchPattern(name: string, pattern: string): boolean {
  if (pattern === '*') return !name.includes('/') && !name.includes('\\');
  if (pattern === '**') return true;
  
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regexPattern}$`).test(name);
}

/**
 * Check if file is likely binary
 */
function isBinaryFile(filename: string): boolean {
  const binaryExtensions = [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.wmv',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
  ];
  
  const ext = path.extname(filename).toLowerCase();
  return binaryExtensions.includes(ext);
}

/**
 * Get search tool definitions
 */
export function getSearchToolDefinitions(): Array<{
  definition: ToolDefinition;
  handler: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}> {
  return [
    {
      definition: {
        name: 'file_search',
        version: '1.0.0',
        description: 'Search file contents using patterns',
        type: ToolType.SEARCH,
        call_level: ToolCallLevel.NORMAL,
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
              maximum: 1000,
            },
          },
          required: ['pattern'],
          additionalProperties: false,
        },
        max_execution_time: 30000,
      },
      handler: searchToolHandlers.file_search,
    },
    {
      definition: {
        name: 'code_search',
        version: '1.0.0',
        description: 'Search code patterns in files',
        type: ToolType.SEARCH,
        call_level: ToolCallLevel.NORMAL,
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
              maximum: 500,
            },
          },
          required: ['pattern'],
          additionalProperties: false,
        },
        max_execution_time: 30000,
      },
      handler: searchToolHandlers.code_search,
    },
    {
      definition: {
        name: 'glob_search',
        version: '1.0.0',
        description: 'Search files by glob pattern',
        type: ToolType.SEARCH,
        call_level: ToolCallLevel.NORMAL,
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
        max_execution_time: 10000,
      },
      handler: searchToolHandlers.glob_search,
    },
    {
      definition: {
        name: 'path_resolve',
        version: '1.0.0',
        description: 'Resolve and normalize file paths',
        type: ToolType.SYSTEM,
        call_level: ToolCallLevel.NORMAL,
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
        max_execution_time: 1000,
      },
      handler: searchToolHandlers.path_resolve,
    },
    {
      definition: {
        name: 'path_join',
        version: '1.0.0',
        description: 'Join path segments',
        type: ToolType.SYSTEM,
        call_level: ToolCallLevel.NORMAL,
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
        max_execution_time: 1000,
      },
      handler: searchToolHandlers.path_join,
    },
  ];
}
