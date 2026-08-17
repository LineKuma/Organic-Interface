import { describe, it, expect } from 'vitest';
import { SlashCommandRegistry, slashCommand } from '../SlashCommand.js';
import type { SlashCommandContext } from '../SlashCommand.js';

describe('SlashCommandRegistry', () => {
  it('recognizes slash lines and ignores plain text', () => {
    const r = new SlashCommandRegistry();
    expect(r.isSlash('/help')).toBe(true);
    expect(r.isSlash('/a b')).toBe(true);
    expect(r.isSlash('help')).toBe(false);
    expect(r.isSlash('/')).toBe(false);
    expect(r.isSlash('//comment')).toBe(false);
  });

  it('parses a command line into name + args', () => {
    const r = new SlashCommandRegistry();
    const line = r.parse('/model fast big');
    expect(line).toEqual({ kind: 'command', command: 'model', args: 'fast big', raw: '/model fast big' });
  });

  it('parses plain text', () => {
    const r = new SlashCommandRegistry();
    expect(r.parse('hello world')).toEqual({ kind: 'text', text: 'hello world' });
  });

  it('registers, resolves aliases and looks up definitions', () => {
    const r = new SlashCommandRegistry();
    r.register(
      slashCommand('exit', 'Quit', () => ({ exit: true }), { aliases: ['quit', 'q'] })
    );
    expect(r.get('exit')).toBeDefined();
    expect(r.get('quit')?.name).toBe('exit');
    expect(r.get('q')?.name).toBe('exit');
    expect(r.get('nope')).toBeUndefined();
  });

  it('lists visible commands only', () => {
    const r = new SlashCommandRegistry();
    r.register(slashCommand('help', 'Help', () => ({})));
    r.register(slashCommand('internal', 'Hidden', () => ({}), { hidden: true }));
    expect(r.list().map(d => d.name)).toEqual(['help']);
  });

  it('completes command names with a leading slash', () => {
    const r = new SlashCommandRegistry();
    r.register(slashCommand('help', 'Help', () => ({})));
    r.register(slashCommand('history', 'Hist', () => ({})));
    expect(r.complete('/h')).toEqual(['/help', '/history']);
    expect(r.complete('/hi')).toEqual(['/history']);
    expect(r.complete('plain text')).toEqual([]);
  });

  it('runs a handler with parsed context', async () => {
    let seen: SlashCommandContext | null = null;
    const r = new SlashCommandRegistry();
    r.register(
      slashCommand('echo', 'Echo args', (ctx) => {
        seen = ctx;
        return { output: ctx.args || 'none' };
      })
    );
    const result = await r.run('/echo hi there');
    expect(result).toEqual({ output: 'hi there' });
    expect(seen).toEqual({ args: 'hi there', raw: '/echo hi there' });
  });

  it('returns null for non-slash input', async () => {
    const r = new SlashCommandRegistry();
    expect(await r.run('just text')).toBe(null);
  });

  it('throws for unknown commands', async () => {
    const r = new SlashCommandRegistry();
    await expect(r.run('/nope')).rejects.toThrow(/Unknown slash command/);
  });

  it('unregisters commands', () => {
    const r = new SlashCommandRegistry();
    r.register(slashCommand('x', 'X', () => ({}), { aliases: ['xx'] }));
    expect(r.unregister('xx')).toBe(true);
    expect(r.get('x')).toBeUndefined();
    expect(r.unregister('xx')).toBe(false);
  });
});