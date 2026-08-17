/**
 * Built-in tools
 */

export { FileTool, createFileTool } from './FileTool.js';
export { ShellTool, createShellTool } from './ShellTool.js';
export { SearchTool, createSearchTool } from './SearchTool.js';

/**
 * Register all built-in tools
 */
import { type ToolService } from '../services/ToolService.js';
import { FileTool, ShellTool, SearchTool } from './index.js';

export function registerBuiltinTools(service: ToolService): void {
  service.registerTool(new FileTool());
  service.registerTool(new ShellTool());
  service.registerTool(new SearchTool());
}
