/**
 * Box drawing component for terminal UI
 *
 * Renders content in bordered boxes with various styles.
 */

import chalk from 'chalk';
import { type Theme, defaultTheme } from './Theme.js';

/**
 * Box border style
 */
export type BoxStyle = 'single' | 'double' | 'rounded' | 'bold' | 'dashed';

/**
 * Box configuration
 */
export interface BoxConfig {
  /** Box title (shown in top border) */
  title?: string;
  /** Content lines */
  content: string[];
  /** Box style */
  style?: BoxStyle;
  /** Box width (auto-calculated if not set) */
  width?: number;
  /** Padding inside box */
  padding?: number;
  /** Text alignment */
  align?: 'left' | 'center';
  /** Custom theme */
  theme?: Theme;
}

/**
 * Terminal box component
 */
export class Box {
  private theme: Theme;

  constructor(theme?: Theme) {
    this.theme = theme ?? defaultTheme;
  }

  /**
   * Render a box around content
   */
  render(config: BoxConfig): string {
    const { content, style = 'single', title, padding = 1, align = 'left' } = config;
    const border = this.getBorderChars(style);

    // Calculate width
    const maxContentLen = content.reduce((max, line) => Math.max(max, chalk.reset(line).length), 0);
    const titleLen = title ? chalk.reset(title).length + 4 : 0; // [ title ]
    const innerWidth = Math.max(maxContentLen, titleLen);
    const width = config.width ?? innerWidth + padding * 2 + 2;
    const contentWidth = width - 2 - padding * 2;

    const lines: string[] = [];

    // Top border with optional title
    lines.push(this.renderTopBorder(border, width, title));

    // Empty line before content
    if (padding > 0) {
      lines.push(
        `${this.theme.colors.border(border.v)}${' '.repeat(width - 2)}${this.theme.colors.border(border.v)}`
      );
    }

    // Content
    for (const line of content) {
      const wrapped = this.wrapLine(line, contentWidth);
      for (const w of wrapped) {
        const padded = this.padContent(w, contentWidth, align);
        const leftPad = ' '.repeat(padding);
        const rightPad = ' '.repeat(padding);
        lines.push(
          `${this.theme.colors.border(border.v)}${leftPad}${padded}${rightPad}${this.theme.colors.border(border.v)}`
        );
      }
    }

    // Empty line after content
    if (padding > 0) {
      lines.push(
        `${this.theme.colors.border(border.v)}${' '.repeat(width - 2)}${this.theme.colors.border(border.v)}`
      );
    }

    // Bottom border
    lines.push(this.renderBottomBorder(border, width));

    return lines.join('\n');
  }

  /**
   * Print a box to stdout
   */
  print(config: BoxConfig): void {
    console.log(this.render(config));
  }

  /**
   * Render a simple key-value box
   */
  renderKeyValue(
    items: [string, string][],
    options: { title?: string; style?: BoxStyle } = {}
  ): string {
    const content = items.map(([key, value]) => {
      const keyStr = this.theme.colors.secondary(key.padEnd(20));
      return `${keyStr} ${value}`;
    });

    return this.render({
      title: options.title,
      content,
      style: options.style ?? 'single',
      align: 'left',
    });
  }

  /**
   * Render top border with optional title
   */
  private renderTopBorder(
    border: ReturnType<typeof Box.prototype.getBorderChars>,
    width: number,
    title?: string
  ): string {
    if (!title) {
      return this.theme.colors.border(`${border.tl}${border.h.repeat(width - 2)}${border.tr}`);
    }

    const titleText = ` ${title} `;
    const barLen = width - 2 - titleText.length;
    const leftLen = Math.floor(barLen / 2);
    const rightLen = barLen - leftLen;

    return this.theme.colors.border(
      `${border.tl}${border.h.repeat(leftLen)}${this.theme.colors.title(titleText)}${border.h.repeat(rightLen)}${border.tr}`
    );
  }

  /**
   * Render bottom border
   */
  private renderBottomBorder(
    border: ReturnType<typeof Box.prototype.getBorderChars>,
    width: number
  ): string {
    return this.theme.colors.border(`${border.bl}${border.h.repeat(width - 2)}${border.br}`);
  }

  /**
   * Get border characters for style
   */
  private getBorderChars(style: BoxStyle): {
    tl: string;
    tr: string;
    bl: string;
    br: string;
    h: string;
    v: string;
  } {
    switch (style) {
      case 'double':
        return { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' };
      case 'rounded':
        return { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };
      case 'bold':
        return { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' };
      case 'dashed':
        return { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '┄', v: '┆' };
      case 'single':
      default:
        return { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
    }
  }

  /**
   * Pad content within width
   */
  private padContent(text: string, width: number, align: 'left' | 'center'): string {
    const plainLen = chalk.reset(text).length;
    if (plainLen >= width) {
      return text;
    }

    const padding = width - plainLen;
    switch (align) {
      case 'center':
        return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(Math.ceil(padding / 2));
      case 'left':
      default:
        return text + ' '.repeat(padding);
    }
  }

  /**
   * Wrap a line to fit width (preserving ANSI codes)
   */
  private wrapLine(text: string, width: number): string[] {
    const plainLen = chalk.reset(text).length;
    if (plainLen <= width) {
      return [text];
    }

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (chalk.reset(currentLine + (currentLine ? ' ' : '') + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }
}

/**
 * Default box instance
 */
export const defaultBox = new Box();

/**
 * Create a box instance
 */
export function createBox(theme?: Theme): Box {
  return new Box(theme);
}
