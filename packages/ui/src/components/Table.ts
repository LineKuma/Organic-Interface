/**
 * Table display component
 */

import { createLogger, type Logger } from '@organic/utils';

/**
 * Column definition
 */
export interface TableColumn<T = unknown> {
  /** Column key */
  key: keyof T | string;
  /** Column header */
  header: string;
  /** Column width (auto if not specified) */
  width?: number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom formatter */
  format?: (value: unknown, row: T) => string;
  /** Truncate value if longer than width */
  truncate?: boolean;
}

/**
 * Table configuration
 */
export interface TableConfig {
  /** Table title */
  title?: string;
  /** Show header row */
  showHeader?: boolean;
  /** Show border */
  border?: boolean;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'markdown' | 'none';
  /** Compact mode (reduce spacing) */
  compact?: boolean;
  /** Maximum column width */
  maxWidth?: number;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Sort configuration
 */
export interface TableSortConfig<T = unknown> {
  /** Column to sort by */
  column: keyof T | string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Table display component
 */
export class Table<T extends Record<string, unknown> = Record<string, unknown>> {
  private logger: Logger;
  private columns: TableColumn<T>[];
  private config: TableConfig;
  private rows: T[] = [];
  private sortConfig?: TableSortConfig<T>;

  constructor(columns: TableColumn<T>[], config: TableConfig = {}, logger?: Logger) {
    this.logger = logger ?? createLogger({ prefix: 'table' });
    this.columns = columns as TableColumn<T>[];
    this.config = {
      title: config.title ?? '',
      showHeader: config.showHeader ?? true,
      border: config.border ?? true,
      borderStyle: config.borderStyle ?? 'single',
      compact: config.compact ?? false,
      maxWidth: config.maxWidth ?? 100,
    };
  }

  /**
   * Add a row to the table
   */
  addRow(row: T): this {
    this.rows.push(row);
    return this;
  }

  /**
   * Add multiple rows
   */
  addRows(rows: T[]): this {
    this.rows.push(...rows);
    return this;
  }

  /**
   * Set rows (replace existing)
   */
  setRows(rows: T[]): this {
    this.rows = [...rows];
    return this;
  }

  /**
   * Sort the table
   */
  sort(column: keyof T | string, direction: 'asc' | 'desc' = 'asc'): this {
    this.sortConfig = { column, direction };

    this.rows.sort((a, b) => {
      const aVal = a[this.columnKeyToString(column)];
      const bVal = b[this.columnKeyToString(column)];

      let comparison = 0;
      if (aVal === bVal) {
        comparison = 0;
      } else if (aVal === null || aVal === undefined) {
        comparison = 1;
      } else if (bVal === null || bVal === undefined) {
        comparison = -1;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal < bVal ? -1 : 1;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return this;
  }

  /**
   * Filter rows
   */
  filter(predicate: (row: T) => boolean): this {
    this.rows = this.rows.filter(predicate);
    return this;
  }

  /**
   * Render the table to string
   */
  render(): string {
    if (this.rows.length === 0) {
      return this.renderEmpty();
    }

    const lines: string[] = [];

    // Title
    if (this.config.title) {
      lines.push(this.config.title);
      lines.push('');
    }

    // Calculate column widths
    const widths = this.calculateColumnWidths();

    // Border top
    if (this.config.border) {
      lines.push(this.renderBorderTop(widths));
    }

    // Header
    if (this.config.showHeader) {
      lines.push(this.renderHeader(widths));
      if (this.config.border) {
        lines.push(this.renderBorderMid(widths));
      }
    }

    // Rows
    for (const row of this.rows) {
      lines.push(this.renderRow(row, widths));
    }

    // Border bottom
    if (this.config.border) {
      lines.push(this.renderBorderBottom(widths));
    }

    return lines.join('\n');
  }

  /**
   * Print the table
   */
  print(): void {
    this.logger.info(this.render());
  }

  /**
   * Get row count
   */
  get rowCount(): number {
    return this.rows.length;
  }

  /**
   * Get column count
   */
  get columnCount(): number {
    return this.columns.length;
  }

  /**
   * Get current sort configuration
   */
  getSortConfig(): TableSortConfig<T> | undefined {
    return this.sortConfig;
  }

  /**
   * Clear all rows
   */
  clear(): this {
    this.rows = [];
    return this;
  }

  /**
   * Calculate column widths based on content
   */
  private calculateColumnWidths(): number[] {
    const widths = this.columns.map(col => {
      // Start with header width
      let width = col.header.length;

      // Check data width
      for (const row of this.rows) {
        const value = this.getCellValue(row, col);
        width = Math.max(width, value.length);
      }

      // Apply column width limit
      if (col.width) {
        width = Math.min(width, col.width);
      }

      // Apply global max width
      width = Math.min(width, this.config.maxWidth ?? 100);

      return width;
    });

    return widths;
  }

  /**
   * Get cell value as string
   */
  private getCellValue(row: T, column: TableColumn<T>): string {
    const key = this.columnKeyToString(column.key);
    const value = row[key];

    // Use custom formatter if provided
    if (column.format) {
      return column.format(value, row);
    }

    // Format value
    if (value === null || value === undefined) {
      return '-';
    }

    let str = String(value);

    // Truncate if needed
    if (column.truncate && column.width) {
      str = this.truncate(str, column.width);
    }

    return str;
  }

  /**
   * Render header row
   */
  private renderHeader(widths: number[]): string {
    const cells = this.columns.map((col, i) => {
      const width = widths[i];
      const header = this.truncate(col.header, width);
      return this.alignCell(header, width, col.align ?? 'left');
    });

    return this.config.border ? `| ${cells.join(' | ')} |` : cells.join(' | ');
  }

  /**
   * Render a data row
   */
  private renderRow(row: T, widths: number[]): string {
    const cells = this.columns.map((col, i) => {
      const value = this.getCellValue(row, col);
      return this.alignCell(value, widths[i], col.align ?? 'left');
    });

    return this.config.border ? `| ${cells.join(' | ')} |` : cells.join(' | ');
  }

  /**
   * Align cell content
   */
  private alignCell(content: string, width: number, align: 'left' | 'center' | 'right'): string {
    const padding = width - content.length;

    if (padding <= 0) {
      return content;
    }

    switch (align) {
      case 'right':
        return ' '.repeat(padding) + content;
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + content + ' '.repeat(rightPad);
      case 'left':
      default:
        return content + ' '.repeat(padding);
    }
  }

  /**
   * Render border (top)
   */
  private renderBorderTop(widths: number[]): string {
    return this.renderBorder(widths, '+');
  }

  /**
   * Render border (middle)
   */
  private renderBorderMid(widths: number[]): string {
    return this.renderBorder(widths, '+', '-', ':', ':');
  }

  /**
   * Render border (bottom)
   */
  private renderBorderBottom(widths: number[]): string {
    return this.renderBorder(widths, '+');
  }

  /**
   * Render border with style
   */
  private renderBorder(
    widths: number[],
    corner: string,
    horizontal: string = '-',
    leftConnector: string = '-',
    rightConnector: string = '-'
  ): string {
    const parts = widths.map(w => horizontal.repeat(w));
    return `${corner}${leftConnector}${parts.join(`${rightConnector}${corner}${leftConnector}`)}${rightConnector}${corner}`;
  }

  /**
   * Render empty state
   */
  private renderEmpty(): string {
    if (this.config.title) {
      return `${this.config.title}\n\n(No data)`;
    }
    return '(No data)';
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 1) + '..';
  }

  /**
   * Convert column key to string
   */
  private columnKeyToString(key: keyof T | string): string {
    return String(key);
  }
}

/**
 * Create a table instance
 */
export function createTable<T extends Record<string, unknown>>(
  columns: TableColumn<T>[],
  config?: TableConfig,
  logger?: Logger
): Table<T> {
  return new Table(columns, config, logger);
}

/**
 * Simple table helper for quick rendering
 */
export function renderTable<T extends Record<string, unknown>>(
  data: T[],
  columns: string[]
): string {
  const tableColumns: TableColumn<T>[] = columns.map(key => ({
    key,
    header: key.charAt(0).toUpperCase() + key.slice(1),
  }));

  const table = new Table<T>(tableColumns, { border: false });
  table.addRows(data);

  return table.render();
}
