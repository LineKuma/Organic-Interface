/**
 * Banner component for terminal UI
 *
 * Renders styled banners, headers, and ascii art boxes.
 */

import chalk, { type ChalkInstance } from 'chalk';
import { type Theme, defaultTheme } from './Theme.js';

/**
 * Banner style
 */
export type BannerStyle = 'simple' | 'box' | 'double' | 'rounded';

/**
 * Banner configuration
 */
export interface BannerConfig {
  /** Banner title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Banner style */
  style?: BannerStyle;
  /** Optional version string */
  version?: string;
  /** Optional description */
  description?: string;
  /** Text alignment */
  align?: 'left' | 'center';
  /** Maximum width */
  width?: number;
  /** Custom theme */
  theme?: Theme;
}

/**
 * Terminal banner component
 */
export class Banner {
  private theme: Theme;

  constructor(theme?: Theme) {
    this.theme = theme ?? defaultTheme;
  }

  /**
   * Render a banner
   */
  render(config: BannerConfig): string {
    const {
      title,
      subtitle,
      style = 'simple',
      version,
      description,
      align = 'center',
      width = 60,
    } = config;
    const lines: string[] = [];

    const border = this.getBorderChars(style);

    // Top border
    if (style !== 'simple') {
      lines.push(this.theme.colors.border(`${border.tl}${border.h.repeat(width - 2)}${border.tr}`));
    }

    // Title
    const titleLine = this.padText(title, width, align, this.theme.colors.title);
    if (style !== 'simple') {
      lines.push(
        `${this.theme.colors.border(border.v)} ${titleLine} ${this.theme.colors.border(border.v)}`
      );
    } else {
      lines.push(titleLine);
    }

    // Version
    if (version) {
      const versionText = `v${version}`;
      const versionLine = this.padText(versionText, width, align, this.theme.colors.muted);
      if (style !== 'simple') {
        lines.push(
          `${this.theme.colors.border(border.v)} ${versionLine} ${this.theme.colors.border(border.v)}`
        );
      } else {
        lines.push(versionLine);
      }
    }

    // Subtitle
    if (subtitle) {
      if (style !== 'simple') {
        lines.push(
          `${this.theme.colors.border(border.v)}${' '.repeat(width)}${this.theme.colors.border(border.v)}`
        );
      }
      const subtitleLine = this.padText(subtitle, width, align, this.theme.colors.subtitle);
      if (style !== 'simple') {
        lines.push(
          `${this.theme.colors.border(border.v)} ${subtitleLine} ${this.theme.colors.border(border.v)}`
        );
      } else {
        lines.push('');
        lines.push(subtitleLine);
      }
    }

    // Description
    if (description) {
      if (style !== 'simple') {
        lines.push(
          `${this.theme.colors.border(border.v)}${' '.repeat(width)}${this.theme.colors.border(border.v)}`
        );
      }
      const wrapped = this.wrapText(description, width - 4);
      for (const descLine of wrapped) {
        const descLinePadded = this.padText(descLine, width, 'left', this.theme.colors.muted);
        if (style !== 'simple') {
          lines.push(
            `${this.theme.colors.border(border.v)} ${descLinePadded} ${this.theme.colors.border(border.v)}`
          );
        } else {
          lines.push(descLinePadded);
        }
      }
    }

    // Bottom border
    if (style !== 'simple') {
      lines.push(this.theme.colors.border(`${border.bl}${border.h.repeat(width - 2)}${border.br}`));
    }

    return lines.join('\n');
  }

  /**
   * Print a banner to stdout
   */
  print(config: BannerConfig): void {
    console.log(this.render(config));
  }

  /**
   * Render a simple heading
   */
  heading(text: string): string {
    const line = this.theme.colors.title(text);
    const underline = this.theme.colors.muted('─'.repeat(Math.min(text.length, 60)));
    return `${line}\n${underline}`;
  }

  /**
   * Get border characters for style
   */
  private getBorderChars(style: BannerStyle): {
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
      case 'box':
      default:
        return { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
    }
  }

  /**
   * Pad text within width with alignment
   */
  private padText(
    text: string,
    width: number,
    align: 'left' | 'center',
    colorFn: ChalkInstance = chalk
  ): string {
    const plainText = chalk.reset(text);
    const textLen = plainText.length;
    const innerWidth = width - 2; // account for border padding

    if (textLen >= innerWidth) {
      return colorFn(text.slice(0, innerWidth));
    }

    const padding = innerWidth - textLen;
    switch (align) {
      case 'center':
        return (
          ' '.repeat(Math.floor(padding / 2)) +
          colorFn(plainText) +
          ' '.repeat(Math.ceil(padding / 2))
        );
      case 'left':
      default:
        return colorFn(plainText) + ' '.repeat(padding);
    }
  }

  /**
   * Wrap text to fit within width
   */
  private wrapText(text: string, width: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
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
 * Default banner instance
 */
export const defaultBanner = new Banner();

/**
 * Create a banner instance
 */
export function createBanner(theme?: Theme): Banner {
  return new Banner(theme);
}
