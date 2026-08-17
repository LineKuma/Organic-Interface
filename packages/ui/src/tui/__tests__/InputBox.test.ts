import { describe, it, expect } from 'vitest';
import { InputBox } from '../InputBox.js';
import { History } from '../History.js';
import type { KeyEvent } from '../types.js';

// Helper to build printable-character key events.
const key = (name: string, extra: Partial<KeyEvent> = {}): KeyEvent => ({
  name,
  ctrl: false,
  meta: false,
  shift: false,
  ...extra,
});
const char = (c: string): KeyEvent => ({ char: c });

describe('InputBox', () => {
  it('inserts printable characters and moves the caret', () => {
    const box = new InputBox();
    box.handleKey(char('h'));
    box.handleKey(char('i'));
    expect(box.value).toBe('hi');
    expect(box.cursor).toBe(2);
  });

  it('inserts text at an arbitrary caret position', () => {
    const box = new InputBox();
    box.setValue('abcd', 2);
    box.insert('XY');
    expect(box.value).toBe('abXYcd');
    expect(box.cursor).toBe(4);
  });

  it('submits the current value on Enter', () => {
    const box = new InputBox();
    box.setValue('hello');
    const ev = box.handleKey(key('return'));
    expect(ev).toEqual({ type: 'submit', value: 'hello' });
  });

  it('backspace removes the character before the caret', () => {
    const box = new InputBox();
    box.setValue('abc');
    box.moveCursor(-1);
    box.handleKey(key('backspace'));
    expect(box.value).toBe('ac');
    expect(box.cursor).toBe(1);
  });

  it('Ctrl-W deletes the previous word', () => {
    const box = new InputBox();
    box.setValue('rm -rf /tmp/x', 14);
    box.handleKey(key('w', { ctrl: true }));
    expect(box.value).toBe('rm -rf /tmp/');
  });

  it('Ctrl-K deletes to end of line', () => {
    const box = new InputBox();
    box.setValue('abcdef');
    box.moveCursor(-3);
    box.handleKey(key('k', { ctrl: true }));
    expect(box.value).toBe('abc');
  });

  it('Home/End move to line start/end', () => {
    const box = new InputBox();
    box.setValue('hello world');
    box.handleKey(key('home'));
    expect(box.cursor).toBe(0);
    box.handleKey(key('end'));
    expect(box.cursor).toBe('hello world'.length);
  });

  it('Ctrl-A / Ctrl-E also move to line start/end', () => {
    const box = new InputBox();
    box.setValue('abc');
    box.handleKey(key('a', { ctrl: true }));
    expect(box.cursor).toBe(0);
    box.handleKey(key('e', { ctrl: true }));
    expect(box.cursor).toBe(3);
  });

  it('navigates history with Up and Down', () => {
    const history = new History();
    history.push('first');
    history.push('second');
    const box = new InputBox({ history });

    box.handleKey(key('up'));
    expect(box.value).toBe('second');
    box.handleKey(key('up'));
    expect(box.value).toBe('first');
    box.handleKey(key('down'));
    expect(box.value).toBe('second');
    box.handleKey(key('down'));
    // Reached the end of history: restores the original draft.
    expect(box.value).toBe('');
  });

  it('does nothing on Up when there is no history', () => {
    const box = new InputBox({ history: new History() });
    expect(box.handleKey(key('up')).type).toBe('none');
  });

  it('accepts a single Tab suggestion inline', () => {
    const box = new InputBox({ complete: () => ['/help'] });
    box.setValue('/he');
    const ev = box.handleKey(key('tab'));
    expect(ev.type).toBe('change');
    expect(box.value).toBe('/help');
  });

  it('surfaces multiple Tab suggestions as a complete event', () => {
    const box = new InputBox({ complete: () => [{ value: '/help' }, { value: '/history' }] });
    box.setValue('/h');
    const ev = box.handleKey(key('tab'));
    expect(ev.type).toBe('complete');
    if (ev.type === 'complete') {
      expect(ev.suggestions.map(s => (typeof s === 'string' ? s : s.value))).toEqual([
        '/help',
        '/history',
      ]);
    }
  });

  it('ignores non-printing keys such as F5', () => {
    const box = new InputBox();
    box.setValue('abc');
    const ev = box.handleKey(key('f5'));
    expect(ev.type).toBe('none');
    expect(box.value).toBe('abc');
  });

  it('respects line boundaries for multiline editing', () => {
    const box = new InputBox();
    // '\n' is at index 5; place the caret on line 2 at index 6.
    box.setValue('line1\nline2', 6);
    expect(box.cursor).toBe(6);
    // Left at the line boundary should not cross onto line 1.
    box.handleKey(key('left'));
    expect(box.cursor).toBe(6);
    box.handleKey(key('left'));
    expect(box.cursor).toBe(6);
  });
});
