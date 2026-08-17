import { describe, it, expect } from 'vitest';
import { History } from '../History.js';
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('History', () => {
  it('pushes entries and returns them oldest-first', () => {
    const h = new History();
    h.push('alpha');
    h.push('beta');
    expect(h.all()).toEqual(['alpha', 'beta']);
    expect(h.length).toBe(2);
  });

  it('ignores empty input', () => {
    const h = new History();
    h.push('   ');
    h.push('');
    expect(h.length).toBe(0);
  });

  it('de-duplicates consecutive identical entries', () => {
    const h = new History();
    h.push('run');
    h.push('run');
    expect(h.all()).toEqual(['run']);
  });

  it('caps the number of retained entries', () => {
    const h = new History({ max: 3 });
    for (let i = 0; i < 10; i += 1) h.push(`entry-${i}`);
    expect(h.all()).toEqual(['entry-7', 'entry-8', 'entry-9']);
  });

  it('navigates with previous()/next()', () => {
    const h = new History({ max: 10 });
    h.push('a');
    h.push('b');
    h.push('c');

    expect(h.previous('fresh')).toBe('c');
    expect(h.previous('fresh')).toBe('b');
    expect(h.previous('fresh')).toBe('a');
    // At the oldest entry, further previous returns null.
    expect(h.previous('fresh')).toBe(null);

    expect(h.next()).toBe('b');
    expect(h.next()).toBe('c');
    // Passing the newest entry restores the captured draft.
    expect(h.next()).toBe('fresh');
  });

  it('returns null from next() when history is empty', () => {
    const h = new History();
    expect(h.next()).toBe(null);
    expect(h.previous('x')).toBe(null);
  });

  it('search returns most-recent matches first', () => {
    const h = new History();
    h.push('git status');
    h.push('git add .');
    h.push('npm run build');
    expect(h.search('git')).toEqual(['git add .', 'git status']);
  });

  it('find returns the most recent match or null', () => {
    const h = new History();
    h.push('git status');
    h.push('git add .');
    expect(h.find('edin')).toBe(null);
    expect(h.find('add')).toBe('git add .');
  });

  it('clear empties the history', () => {
    const h = new History();
    h.push('x');
    h.push('y');
    h.clear();
    expect(h.length).toBe(0);
  });

  it('persists to and reloads from a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'org-hist-'));
    const file = join(dir, 'history.txt');
    try {
      const h1 = new History({ filePath: file });
      h1.push('one');
      h1.push('two');

      const h2 = new History({ filePath: file });
      expect(h2.all()).toEqual(['one', 'two']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tolerates a missing/invalid history file', () => {
    const missing = join(tmpdir(), `nope-${Date.now()}`, 'history.txt');
    const h = new History({ filePath: missing });
    expect(h.all()).toEqual([]);
    h.push('x');
    expect(existsSync(missing)).toBe(true);
  });

  it('tolerates an unreadable file path', () => {
    const h = new History({ filePath: join(tmpdir(), `not-exists-${Date.now()}`) });
    expect(h.length).toBe(0);
    h.push('y');
    expect(h.length).toBe(1);
  });

  it('can replace in-memory content from a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'org-hist-'));
    const file = join(dir, 'h.txt');
    writeFileSync(file, 'seed-a\nseed-b\n', 'utf8');
    try {
      const h = new History();
      h.replaceFromFile(file);
      expect(h.all()).toEqual(['seed-a', 'seed-b']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
