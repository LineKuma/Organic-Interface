import { describe, it, expect } from 'vitest';
import { noneTheme } from '../../terminal/Theme.js';
import type { ChatMessage } from '../types.js';
import {
  roleBadge,
  renderCodeBlock,
  renderRichText,
  renderMessage,
  renderCommandMenu,
  renderCompletionMenu,
  renderStatusLine,
} from '../render.js';
import { slashCommand } from '../SlashCommand.js';

// Use the plain-text theme so assertions are about structure, not ANSI codes.
const theme = noneTheme;

describe('render (formatted output)', () => {
  it('renders a role badge like [You]', () => {
    expect(roleBadge('user', theme)).toBe('You');
    expect(roleBadge('assistant', theme)).toBe('AI');
  });

  it('renders a bordered code block with language header', () => {
    const out = renderCodeBlock('console.log(1)', theme, 'js');
    const lines = out.split('\n');
    expect(lines[0]).toContain('┌─ js');
    expect(lines[0]).toMatch(/┐$/);
    expect(lines[1]).toContain('console.log(1)');
    expect(lines[lines.length - 1]).toContain('═');
  });

  it('extracts fenced code blocks from rich text', () => {
    const out = renderRichText('hello\n```ts\nlet x = 1\n```\nworld', theme);
    expect(out).toContain('┌─ ts');
    expect(out).toContain('let x = 1');
    expect(out).toContain('hello');
  });

  it('keeps inline code and bold markers styled', () => {
    const out = renderRichText('run `npm i` and **restart**', theme);
    // Inline markers are replaced with the highlighted content.
    expect(out).not.toContain('`npm i`');
    expect(out).not.toContain('**restart**');
    expect(out).toContain('npm i');
    expect(out).toContain('restart');
  });

  it('box-frames a full message with a role badge', () => {
    const msg: ChatMessage = { role: 'assistant', content: 'line one\nline two' };
    const out = renderMessage(msg, theme).split('\n');
    expect(out[0]).toContain('AI'); // badge
    expect(out[0]).toContain('┌');
    expect(out[1]).toMatch(/│/);
    expect(out[out.length - 1]).toContain('└');
  });

  it('renders an error message through the error styling', () => {
    const out = renderMessage({ role: 'system', content: 'boom', error: true }, theme);
    expect(out).toContain('boom');
  });

  it('renders a command menu and a completion menu', () => {
    const defs = [slashCommand('help', 'Show help', () => ({})), slashCommand('exit', 'Quit', () => ({}))];
    const menu = renderCommandMenu(defs, theme);
    expect(menu).toContain('/help');
    expect(menu).toContain('Show help');

    const comp = renderCompletionMenu([{ value: '/help', detail: 'Show help' }], theme);
    expect(comp).toContain('/help');
    expect(comp).toContain('Show help');
  });

  it('aligns and fills the status line', () => {
    const status = { left: 'app v1', middle: 'type /help', right: '3 msgs' };
    const out = renderStatusLine(status, theme, 40);
    expect(out).toContain('app v1');
    expect(out).toContain('3 msgs');
    expect(out.length).toBeLessThanOrEqual(40);
  });
});