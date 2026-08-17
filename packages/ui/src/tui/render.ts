/**
 * @organic/ui - tui render
 *
 * Pure string-rendering helpers for the TUI's formatted output. Everything here
 * returns a string (no I/O) so it is trivially testable and shared by both the
 * terminal and future WebUI renderers.
 */

import { defaultTheme, type Theme } from '../terminal/Theme.js';
import type { ChatMessage, ChatRole, CompletionSuggestion, StatusLine } from './types.js';
import type { SlashCommandDefinition } from './SlashCommand.js';

/**
 * Human-facing label and color accent for a message role.
 */
const ROLE_META: Record<ChatRole, { label: string; color: keyof Theme['colors'] }> = {
  system: { label: 'System', color: 'muted' },
  user: { label: 'You', color: 'primary' },
  assistant: { label: 'AI', color: 'success' },
  tool: { label: 'Tool', color: 'highlight' },
};

/** Return a styled role badge like `[You]`. */
export function roleBadge(role: ChatRole, theme: Theme = defaultTheme): string {
  const meta = ROLE_META[role];
  return theme.colors[meta.color](`${meta.label}`);
}

/** Render a styled code block with an optional language header. */
export function renderCodeBlock(
  code: string,
  theme: Theme = defaultTheme,
  language?: string
): string {
  const lines = code.replace(/\n$/, '').split('\n');
  const width = Math.max(...lines.map(l => l.length), language?.length ?? 0, 10);
  const border = theme.colors.border('═'.repeat(width + 4));

  const out: string[] = [];
  if (language) {
    out.push(`${theme.colors.subtitle(`┌─ ${language} ${'─'.repeat(Math.max(0, width - language.length + 1))}┐`)}`);
  } else {
    out.push(border);
  }
  for (const line of lines) {
    out.push(`${theme.colors.border('│')} ${line.padEnd(width)} ${theme.colors.border('│')}`);
  }
  out.push(border);
  return out.join('\n');
}

/**
 * Render a Markdown-ish body with lightweight formatting:
 * fenced ``` code blocks, ATX #/##/### headings, `---` dividers, `-` bullets,
 * `1.` numbered items, and inline `code` / **bold** spans.
 */
export function renderRichText(text: string, theme: Theme = defaultTheme): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const source = trimmed.replace(/\n$/, '').split('\n');
  const out: string[] = [];

  let fence = '';
  let fenceBuffer: string[] = [];

  const flushFence = (): void => {
    if (fenceBuffer.length === 0) return;
    out.push(renderCodeBlock(fenceBuffer.join('\n'), theme, fence || undefined));
    out.push('');
    fenceBuffer = [];
  };

  for (const raw of source) {
    const line = raw;
    const fenceMatch = /^`{3}(\S*)\s*$/.exec(line);
    if (fenceMatch) {
      if (fence) {
        flushFence();
        fence = '';
      } else {
        flushFence();
        const [, lang] = fenceMatch;
        fence = lang;
      }
      continue;
    }
    if (fence) {
      fenceBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      out.push('');
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = theme.colors.title(heading[2]);
      out.push(level === 1 ? title : `${' '.repeat((level - 1) * 2)}${theme.colors.subtitle(heading[2])}`);
      continue;
    }
    if (/^\s*(---+|\*\*\*)\s*$/.test(line) && out.length > 0) {
      out.push(theme.colors.border('─'.repeat(Math.max(10, raw.length))));
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      out.push(`${theme.colors.accent('•')} ${renderInline(line.replace(/^\s*[-*+]\s+/, ''), theme)}`);
      continue;
    }
    const numbered = /^\s*(\d+)\.\s+/.exec(line);
    if (numbered) {
      out.push(`${theme.colors.accent(`${numbered[1]}.`)} ${renderInline(line.slice(numbered[0].length), theme)}`);
      continue;
    }
    out.push(renderInline(line, theme));
  }
  flushFence();

  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n/, '');
}

/** Render inline `code` and **bold** markers on a single line. */
function renderInline(line: string, theme: Theme): string {
  // Escape nothing; apply inline markers only.
  return line
    .replace(/`([^`]+)`/g, (_, code: string) => theme.colors.highlight(code))
    .replace(/\*\*([^*]+)\*\*/g, (_, text: string) => theme.colors.title(text));
}

/** Render a full chat message: role badge + rich content. */
export function renderMessage(message: ChatMessage, theme: Theme = defaultTheme): string {
  const badge = roleBadge(message.role, theme);
  const body = renderRichText(message.content, theme);
  const lines = body.split('\n').filter(Boolean);
  const head = `${theme.colors.border('┌')} ${badge}`;
  const boxed: string[] = [head];
  for (const line of lines) {
    boxed.push(`${theme.colors.border('│')} ${line}`);
  }
  boxed.push(theme.colors.border('└'));
  if (message.error) {
    return boxed.map(l => theme.colors.error(l)).join('\n');
  }
  return boxed.join('\n');
}

/** Render a completion/help menu from a list of items. */
function renderMenu(
  items: Array<{ key: string; label: string; detail?: string }>,
  theme: Theme
): string {
  if (items.length === 0) return '';
  const width = Math.max(...items.map(i => i.label.length));
  const rows = items.map(item => {
    const padded = item.label.padEnd(width);
    const detail = item.detail ? theme.colors.muted(`  ${item.detail}`) : '';
    return `${theme.colors.accent(item.key)} ${padded}${detail}`;
  });
  return rows.join('\n');
}

/** Render a slash-command completion menu. */
export function renderCommandMenu(
  defs: SlashCommandDefinition[],
  theme: Theme = defaultTheme
): string {
  return renderMenu(
    defs.map(d => ({ key: `/${d.name}`, label: d.name, detail: d.description })),
    theme
  );
}

/** Render a completion-suggestion menu (for Tab completion). */
export function renderCompletionMenu(
  suggestions: CompletionSuggestion[],
  theme: Theme = defaultTheme
): string {
  return renderMenu(
    suggestions.map(s => ({
      key: ' ',
      label: s.label ?? s.value,
      detail: s.detail,
    })),
    theme
  );
}

/**
 * Render a one-line status bar from three segments. `middle` is center-aligned
 * when there is spare width; `right` is right-aligned.
 */
export function renderStatusLine(status: StatusLine, theme: Theme = defaultTheme, width = 80): string {
  const left = theme.colors.border(status.left);
  const right = theme.colors.muted(status.right);
  const middle = theme.colors.info(status.middle);

  const visible = width - left.length - right.length;
  if (visible <= 0) return `${left} ${right}`.slice(0, Math.max(1, width));

  const leftPad = ' '.repeat(Math.floor(visible / 2) - Math.floor(middle.length / 2));
  return `${left}${leftPad}${middle} ${right}`;
}