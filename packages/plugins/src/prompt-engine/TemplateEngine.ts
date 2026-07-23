/**
 * TemplateEngine - Compiles, parses, and validates prompt templates
 *
 * Supports:
 * - {{variable}} for interpolation
 * - {{default value}} for defaults
 * - {{#if condition}}...{{/if}} for conditionals
 * - {{#each items}}...{{/each}} for loops
 * - {{> templateName}} for includes
 * - Filters: {{variable | uppercase}}, {{variable | lowercase}}, {{variable | truncate:20}}
 * - Nested access: {{user.name}}, {{items.0.title}}
 */

import { createLogger, type Logger } from '@organic/utils';
import type {
  TemplateBlock,
  TemplateVariable,
  TemplateValidationResult,
  TemplateValidationError,
  TemplateValidationWarning,
} from './types/template.js';

/**
 * Filter function type
 */
type FilterFn = (value: unknown, ...args: string[]) => string;

/**
 * TemplateEngine class
 */
export class TemplateEngine {
  private logger: Logger;
  private filters: Map<string, FilterFn>;

  constructor() {
    this.logger = createLogger({ prefix: 'TemplateEngine' });
    this.filters = new Map();
    this.registerBuiltinFilters();
  }

  // ==================== Public API ====================

  /**
   * Compile a template string with variable substitution
   * @param template - Template content
   * @param variables - Variable values
   * @returns Compiled string
   */
  compile(template: string, variables: Record<string, unknown>): string {
    const blocks = this.parse(template);
    return this.renderBlocks(blocks, variables);
  }

  /**
   * Parse a template string into AST blocks
   * @param template - Template content
   * @returns Array of template blocks
   */
  parse(template: string): TemplateBlock[] {
    const blocks: TemplateBlock[] = [];
    let pos = 0;

    while (pos < template.length) {
      const openIdx = template.indexOf('{{', pos);

      if (openIdx === -1) {
        // No more tags, remaining is text
        if (pos < template.length) {
          blocks.push({
            type: 'text',
            content: template.substring(pos),
          });
        }
        break;
      }

      // Text before the tag
      if (openIdx > pos) {
        blocks.push({
          type: 'text',
          content: template.substring(pos, openIdx),
        });
      }

      const closeIdx = template.indexOf('}}', openIdx);
      if (closeIdx === -1) {
        // Unclosed tag, treat rest as text
        blocks.push({
          type: 'text',
          content: template.substring(openIdx),
        });
        break;
      }

      const tagContent = template.substring(openIdx + 2, closeIdx).trim();
      pos = closeIdx + 2;

      // Parse the tag
      if (tagContent.startsWith('#if ')) {
        // Conditional block - find matching end tag with nesting support
        const condition = tagContent.substring(4).trim();
        const endIdx = this.findMatchingEndTag(template, pos, 'if');

        if (endIdx === -1) {
          blocks.push({
            type: 'text',
            content: template.substring(openIdx),
          });
          break;
        }

        const innerContent = template.substring(pos, endIdx);
        const children = this.parse(innerContent);

        blocks.push({
          type: 'condition',
          condition,
          children,
        });

        pos = endIdx + 7; // length of '{{/if}}'
      } else if (tagContent.startsWith('#each ')) {
        // Loop block - find matching end tag with nesting support
        const loopExpr = tagContent.substring(6).trim();
        const parts = loopExpr.split(/\s+(?:in|as)\s+/);
        let collection: string;
        let itemName: string;

        if (parts.length === 2) {
          // "items as item" or "item in items"
          if (loopExpr.includes(' as ')) {
            itemName = parts[1].trim();
            collection = parts[0].trim();
          } else {
            itemName = parts[0].trim();
            collection = parts[1].trim();
          }
        } else {
          // "items" only
          collection = loopExpr;
          itemName = 'item';
        }

        const endIdx = this.findMatchingEndTag(template, pos, 'each');

        if (endIdx === -1) {
          blocks.push({
            type: 'text',
            content: template.substring(openIdx),
          });
          break;
        }

        const innerContent = template.substring(pos, endIdx);
        const children = this.parse(innerContent);

        blocks.push({
          type: 'loop',
          collection,
          itemName,
          children,
        });

        pos = endIdx + 9; // length of '{{/each}}'
      } else if (tagContent.startsWith('> ')) {
        // Include block
        const templateName = tagContent.substring(2).trim();
        blocks.push({
          type: 'include',
          templateName,
        });
      } else if (tagContent.startsWith('/')) {
        // Closing tag (should be handled by parent blocks)
        this.logger.warn(`Unexpected closing tag: ${tagContent}`);
        blocks.push({
          type: 'text',
          content: `{{${tagContent}}}`,
        });
      } else {
        // Variable block
        const block = this.parseVariableTag(tagContent);
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * Validate a template's syntax and variable declarations
   * @param template - Template content
   * @param variables - Expected variable definitions
   * @returns Validation result
   */
  validate(template: string, variables: TemplateVariable[]): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: TemplateValidationWarning[] = [];

    // Check for unclosed tags
    let openCount = 0;
    let lineNum = 1;
    let colNum = 1;

    for (let i = 0; i < template.length; i++) {
      if (template[i] === '\n') {
        lineNum++;
        colNum = 1;
      } else {
        colNum++;
      }

      if (template[i] === '{' && template[i + 1] === '{') {
        openCount++;
        i++;
        colNum++;
      } else if (template[i] === '}' && template[i + 1] === '}') {
        openCount--;
        i++;
        colNum++;
      }

      if (openCount < 0) {
        errors.push({
          message: 'Unexpected closing tag',
          line: lineNum,
          column: colNum,
        });
        openCount = 0;
      }
    }

    if (openCount > 0) {
      errors.push({
        message: `Unclosed tag (${openCount} tag(s) still open)`,
        line: lineNum,
        column: colNum,
      });
    }

    // Check if/end and each/end mismatch
    let ifStack = 0;
    let eachStack = 0;
    const tagRegex = /\{\{(#if\s[^}]*|\/if|#each\s[^}]*|\/each)\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(template)) !== null) {
      const tag = match[1].trim();
      if (tag.startsWith('#if')) {
        ifStack++;
      } else if (tag === '/if') {
        ifStack--;
        if (ifStack < 0) {
          const line = template.substring(0, match.index).split('\n').length;
          errors.push({
            message: 'Unexpected {{/if}} without matching {{#if}}',
            line,
          });
          ifStack = 0;
        }
      } else if (tag.startsWith('#each')) {
        eachStack++;
      } else if (tag === '/each') {
        eachStack--;
        if (eachStack < 0) {
          const line = template.substring(0, match.index).split('\n').length;
          errors.push({
            message: 'Unexpected {{/each}} without matching {{#each}}',
            line,
          });
          eachStack = 0;
        }
      }
    }

    if (ifStack > 0) {
      errors.push({
        message: `Unclosed {{#if}} (${ifStack} block(s) still open)`,
      });
    }
    if (eachStack > 0) {
      errors.push({
        message: `Unclosed {{#each}} (${eachStack} block(s) still open)`,
      });
    }

    // Check that all declared variables are used (warning)
    const extractedVars = this.extractVariables(template);
    const varNames = variables.map(v => v.name);

    for (const v of variables) {
      if (v.required && !extractedVars.includes(v.name)) {
        warnings.push({
          message: `Required variable "${v.name}" is not used in the template`,
          token: v.name,
        });
      }
    }

    for (const v of extractedVars) {
      if (!varNames.includes(v)) {
        warnings.push({
          message: `Variable "${v}" is used in template but not declared`,
          token: v,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract variable names from a template string
   * @param template - Template content
   * @returns Array of unique variable names
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>();
    const varRegex =
      /\{\{(?!\s*#if\s|\s*#each\s|\s*\/if|\s*\/each|\s*>|\s*\/)([^|}]+?)(?:\s*\|\s*[^}]+)?\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = varRegex.exec(template)) !== null) {
      let varExpr = match[1].trim();

      // Handle default value syntax: {{variable default value}}
      const defaultMatch = varExpr.match(/^(.+?)\s+default\s+(.+)$/);
      if (defaultMatch) {
        varExpr = defaultMatch[1].trim();
      }

      // Extract base variable name (before any filter)
      const baseVar = varExpr.trim();
      if (
        baseVar &&
        !baseVar.startsWith('#') &&
        !baseVar.startsWith('/') &&
        !baseVar.startsWith('>')
      ) {
        variables.add(baseVar);
      }
    }

    return Array.from(variables);
  }

  /**
   * Register a custom filter
   * @param name - Filter name
   * @param fn - Filter function
   */
  registerFilter(name: string, fn: FilterFn): void {
    this.filters.set(name, fn);
    this.logger.debug(`Filter registered: ${name}`);
  }

  /**
   * Get all registered filter names
   */
  getFilterNames(): string[] {
    return Array.from(this.filters.keys());
  }

  // ==================== Private Methods ====================

  /**
   * Register built-in filters
   */
  private registerBuiltinFilters(): void {
    this.filters.set('uppercase', (value: unknown) => String(value).toUpperCase());
    this.filters.set('lowercase', (value: unknown) => String(value).toLowerCase());
    this.filters.set('capitalize', (value: unknown) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    this.filters.set('trim', (value: unknown) => String(value).trim());
    this.filters.set('truncate', (value: unknown, length: string) => {
      const str = String(value);
      const len = parseInt(length, 10);
      if (isNaN(len) || len <= 0) return str;
      if (str.length <= len) return str;
      return `${str.substring(0, len)  }...`;
    });
    this.filters.set('default', (value: unknown, defaultVal: string) => {
      return value === undefined || value === null || value === '' ? defaultVal : String(value);
    });
  }

  /**
   * Parse a variable tag into a TemplateBlock
   */
  private parseVariableTag(tagContent: string): TemplateBlock {
    const block: TemplateBlock = {
      type: 'variable',
      variable: tagContent,
    };

    // Check for defaults: {{variable default value}}
    const defaultMatch = tagContent.match(/^(.+?)\s+default\s+(.+)$/);
    if (defaultMatch) {
      block.variable = defaultMatch[1].trim();
      let defaultValue = defaultMatch[2].trim();
      // Strip surrounding quotes if present
      if (
        (defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
        (defaultValue.startsWith("'") && defaultValue.endsWith("'"))
      ) {
        defaultValue = defaultValue.slice(1, -1);
      }
      block.defaultValue = defaultValue;
      return block;
    }

    // Check for filters: {{variable | filterName}} or {{variable | filterName:arg}}
    const pipeIdx = tagContent.indexOf('|');
    if (pipeIdx !== -1) {
      block.variable = tagContent.substring(0, pipeIdx).trim();
      block.filter = tagContent.substring(pipeIdx + 1).trim();
    }

    return block;
  }

  /**
   * Render parsed blocks into a string
   */
  private renderBlocks(blocks: TemplateBlock[], variables: Record<string, unknown>): string {
    let result = '';

    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          result += block.content || '';
          break;

        case 'variable':
          result += this.renderVariable(block, variables);
          break;

        case 'condition':
          if (this.evaluateCondition(block.condition || '', variables)) {
            result += this.renderBlocks(block.children || [], variables);
          }
          break;

        case 'loop':
          result += this.renderLoop(block, variables);
          break;

        case 'include':
          // Include is handled by the caller (PromptEnginePlugin)
          result += `{{> ${block.templateName || ''}}}`;
          break;

        default:
          result += block.content || '';
          break;
      }
    }

    return result;
  }

  /**
   * Render a single variable block
   */
  private renderVariable(block: TemplateBlock, variables: Record<string, unknown>): string {
    const varName = block.variable || '';
    let value = this.resolveNested(varName, variables);

    // Apply default value
    if (
      (value === undefined || value === null || value === '') &&
      block.defaultValue !== undefined
    ) {
      value = block.defaultValue;
    }

    // Apply filter
    if (block.filter && value !== undefined && value !== null) {
      value = this.applyFilter(block.filter, value);
    }

    return value !== undefined && value !== null ? String(value) : '';
  }

  /**
   * Render a loop block
   */
  private renderLoop(block: TemplateBlock, variables: Record<string, unknown>): string {
    const collection = this.resolveNested(block.collection || '', variables);
    const itemName = block.itemName || 'item';

    if (!Array.isArray(collection)) {
      return '';
    }

    let result = '';

    for (let i = 0; i < collection.length; i++) {
      const item = collection[i];
      const loopVars: Record<string, unknown> = {
        ...variables,
        [itemName]: item,
        [`${itemName}_index`]: i,
        [`${itemName}_first`]: i === 0,
        [`${itemName}_last`]: i === collection.length - 1,
      };

      result += this.renderBlocks(block.children || [], loopVars);
    }

    return result;
  }

  /**
   * Resolve nested variable access like "user.name" or "items.0.title"
   */
  private resolveNested(path: string, variables: Record<string, unknown>): unknown {
    if (!path) return undefined;

    const parts = path.split('.');
    let current: unknown = variables;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current === 'object') {
        const index = Number.isNaN(Number(part)) ? part : Number(part);
        current = (current as Record<string | number, unknown>)[index];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Apply a filter to a value
   */
  private applyFilter(filterExpr: string, value: unknown): unknown {
    const parts = filterExpr.split(':');
    const filterName = parts[0].trim();
    const args = parts.slice(1);

    const filterFn = this.filters.get(filterName);
    if (!filterFn) {
      this.logger.warn(`Unknown filter: ${filterName}`);
      return value;
    }

    return filterFn(String(value), ...args);
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    const trimmed = condition.trim();

    // Handle negation
    if (trimmed.startsWith('!')) {
      return !this.evaluateCondition(trimmed.substring(1).trim(), variables);
    }

    // Handle comparison operators
    const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];
    for (const op of operators) {
      const idx = trimmed.indexOf(op);
      if (idx !== -1) {
        const left = trimmed.substring(0, idx).trim();
        const right = trimmed.substring(idx + op.length).trim();

        const leftVal = this.resolveConditionValue(left, variables);
        const rightVal = this.resolveConditionValue(right, variables);

        switch (op) {
          case '===':
            return leftVal === rightVal;
          case '!==':
            return leftVal !== rightVal;
          case '==':
            // eslint-disable-next-line eqeqeq
            return leftVal == rightVal;
          case '!=':
            // eslint-disable-next-line eqeqeq
            return leftVal != rightVal;
          case '>=':
            return Number(leftVal) >= Number(rightVal);
          case '<=':
            return Number(leftVal) <= Number(rightVal);
          case '>':
            return Number(leftVal) > Number(rightVal);
          case '<':
            return Number(leftVal) < Number(rightVal);
        }
      }
    }

    // Handle logical operators
    if (trimmed.includes(' && ')) {
      const parts = trimmed.split(' && ');
      return parts.every(p => this.evaluateCondition(p.trim(), variables));
    }

    if (trimmed.includes(' || ')) {
      const parts = trimmed.split(' || ');
      return parts.some(p => this.evaluateCondition(p.trim(), variables));
    }

    // Handle function-like checks
    if (trimmed.startsWith('has(') && trimmed.endsWith(')')) {
      const varName = trimmed.substring(4, trimmed.length - 1).trim();
      const val = this.resolveNested(varName, variables);
      return val !== undefined && val !== null;
    }

    // Truthy check
    const val = this.resolveNested(trimmed, variables);
    return Boolean(val);
  }

  /**
   * Find the matching end tag index, handling nesting of the same block type
   * @param template - Full template string
   * @param startPos - Position to start searching from
   * @param blockType - The block type ('if' or 'each')
   * @returns Index of the matching end tag, or -1 if not found
   */
  private findMatchingEndTag(template: string, startPos: number, blockType: string): number {
    const startTag = `{{#${blockType}`;
    const endTag = `{{/${blockType}}}`;
    let depth = 1;
    let pos = startPos;

    while (pos < template.length) {
      const nextStart = template.indexOf(startTag, pos);
      const nextEnd = template.indexOf(endTag, pos);

      if (nextEnd === -1) {
        return -1;
      }

      if (nextStart !== -1 && nextStart < nextEnd) {
        depth++;
        pos = nextStart + startTag.length;
      } else {
        depth--;
        if (depth === 0) {
          return nextEnd;
        }
        pos = nextEnd + endTag.length;
      }
    }

    return -1;
  }

  /**
   * Resolve a value in a condition expression
   */
  private resolveConditionValue(expr: string, variables: Record<string, unknown>): unknown {
    const trimmed = expr.trim();

    // String literal
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return trimmed.slice(1, -1);
    }

    // Boolean literal
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    // Variable reference
    return this.resolveNested(trimmed, variables);
  }
}
