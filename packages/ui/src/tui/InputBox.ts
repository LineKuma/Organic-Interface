/**
 * @organic/ui - tui InputBox
 *
 * A key-driven line editor used as the main input box of the TUI, modelled after
 * modern agent CLIs. It supports:
 *  - single/multi-line editing with a movable cursor,
 *  - classic readline bindings (Home/End, Ctrl-A/E/U/K/W),
 *  - Up/Down history browsing (delegated to a `History` instance),
 *  - Tab completion (single suggestion accepted inline, multiple surfaced via a
 *    `complete` event for a menu).
 *
 * The component is a pure state machine: feed it `KeyEvent`s via `handleKey()`
 * and observe `InputBoxEvent`s. It performs no I/O itself, making it trivially
 * unit-testable and reusable by a WebUI.
 */

import type { History } from './History.js';
import type { CompletionSuggestion, InputBoxEvent, KeyEvent } from './types.js';

/**
 * Completion provider: returns suggestions for the token starting at the given
 * offset of the current buffer, or an empty array when nothing applies.
 */
export type CompletionProvider = (
  buffer: string,
  cursor: number
) => CompletionSuggestion[] | string[];

/**
 * InputBox options.
 */
export interface InputBoxOptions {
  /** Prompt prefix rendered in front of the value. */
  prompt?: string;
  /** Optional history store used by Up/Down. */
  history?: History;
  /** Optional completion provider used by Tab. */
  complete?: CompletionProvider;
}

/** Wrap a `string[]` provider result into a suggestion list. */
function normalize(suggestions: CompletionSuggestion[] | string[]): CompletionSuggestion[] {
  return suggestions.map(s => (typeof s === 'string' ? { value: s } : s));
}

/**
 * Key-driven line editor.
 */
export class InputBox {
  private readonly history?: History;
  private readonly complete?: CompletionProvider;

  private _value = '';
  private _cursor = 0;
  private readonly prompt: string;

  constructor(options: InputBoxOptions = {}) {
    this.prompt = options.prompt ?? '';
    this.history = options.history;
    this.complete = options.complete;
  }

  /** Current buffered text. */
  get value(): string {
    return this._value;
  }

  /** Current caret position (character offset into `value`). */
  get cursor(): number {
    return this._cursor;
  }

  /** The prompt prefix. */
  get prefix(): string {
    return this.prompt;
  }

  /**
   * Replace the whole buffer and place the caret at `position` (default: end).
   */
  setValue(value: string, position?: number): void {
    this._value = value;
    this._cursor = Math.max(0, Math.min(position ?? value.length, value.length));
  }

  /** Insert text at the caret and advance the caret past it. */
  insert(text: string): void {
    if (!text) return;
    // Treat literal newlines/spaces from paste as plain insertion.
    this._value = this._value.slice(0, this._cursor) + text + this._value.slice(this._cursor);
    this._cursor += text.length;
  }

  /** Move the caret by a signed delta, clamped to the buffer bounds. */
  moveCursor(delta: number): void {
    this._cursor = Math.max(0, Math.min(this._cursor + delta, this._value.length));
  }

  /**
   * Feed one key event into the editor. Mutates the buffer/caret and returns the
   * resulting action for the caller to react to.
   */
  handleKey(key: KeyEvent): InputBoxEvent {
    // Character input.
    if (key.char && !key.ctrl && !key.meta) {
      this.insert(key.char);
      return { type: 'change', value: this._value, cursor: this._cursor };
    }

    const {name} = key;
    const ctrl = key.ctrl === true;

    switch (name) {
      case 'enter':
      case 'return':
      case 'linefeed':
        return { type: 'submit', value: this._value };

      case 'backspace':
        if (ctrl) {
          // Ctrl-W / Ctrl-H: delete back to previous word boundary.
          this.deleteWordBefore();
        } else if (this._cursor > 0) {
          this._value =
            this._value.slice(0, this._cursor - 1) + this._value.slice(this._cursor);
          this._cursor -= 1;
        }
        return { type: 'change', value: this._value, cursor: this._cursor };

      case 'delete':
        if (this._cursor < this._value.length) {
          this._value =
            this._value.slice(0, this._cursor) + this._value.slice(this._cursor + 1);
        }
        return { type: 'change', value: this._value, cursor: this._cursor };

      case 'left':
        this.moveWithinLine(-1);
        return { type: 'change', value: this._value, cursor: this._cursor };

      case 'right':
        this.moveWithinLine(1);
        return { type: 'change', value: this._value, cursor: this._cursor };

      case 'home':
      case 'a':
        // Home or Ctrl-A moves to the line start.
        if (name === 'a' && !ctrl) break;
        this._cursor = this.lineStart(this._cursor);
        return { type: 'change', value: this._value, cursor: this._cursor };

      case 'end':
      case 'e':
        // End or Ctrl-E moves to the line end.
        if (name === 'e' && !ctrl) break;
        this._cursor = this.lineEnd(this._cursor);
        return { type: 'change', value: this._value, cursor: this._cursor };

      case 'u':
        // Ctrl-U kills from the caret back to the line start.
        if (ctrl) {
          const start = this.lineStart(this._cursor);
          this._value = this._value.slice(this._cursor);
          this._cursor = start;
          return { type: 'change', value: this._value, cursor: this._cursor };
        }
        break;

      case 'up':
        return this.handleHistory(current => this.history?.previous(current) ?? null);

      case 'down':
        return this.handleHistory(() => this.history?.next() ?? null);

      case 'tab':
        return this.completeAtCursor();

      case 'w':
        // Ctrl-W deletes the word before the caret.
        if (ctrl) return this.handleKillWord();

      case 'k':
        // Ctrl-K deletes from the caret to the end of the line.
        if (ctrl) return this.handleKillLine();

      default:
        break;
    }

    return { type: 'none' };
  }

  // ── Editing helpers ─────────────────────────────────────────

  /** Caret is moved left/right but stops at line boundaries (does not cross `\n`). */
  private moveWithinLine(delta: -1 | 1): void {
    if (delta < 0 && this._cursor > 0) {
      const within = this._value[this._cursor - 1] !== '\n';
      if (within) this._cursor -= 1;
    } else if (delta > 0 && this._cursor < this._value.length) {
      const within = this._value[this._cursor] !== '\n';
      if (within) this._cursor += 1;
    }
  }

  private lineStart(cursor: number): number {
    const lastNewline = this._value.lastIndexOf('\n', Math.max(0, cursor - 1));
    return lastNewline + 1;
  }

  private lineEnd(cursor: number): number {
    const nextNewline = this._value.indexOf('\n', cursor);
    return nextNewline === -1 ? this._value.length : nextNewline;
  }

  /** Delete the word before the caret, using alphanumeric/underscore word
   *  boundaries (zsh/emacs-style) so path separators and punctuation delimiters
   *  are preserved. */
  private deleteWordBefore(): void {
    if (this._cursor === 0) return;
    const isWord = (c: string): boolean => /[A-Za-z0-9_]/.test(c);
    const isSpace = (c: string): boolean => /\s/.test(c);
    let start = this._cursor;
    // Skip trailing whitespace.
    while (start > 0 && isSpace(this._value[start - 1])) start -= 1;
    if (start > 0 && isWord(this._value[start - 1])) {
      // Back over the word.
      while (start > 0 && isWord(this._value[start - 1])) start -= 1;
    } else {
      // Back over a punctuation/delimiter run, then any adjacent word.
      while (start > 0 && !isWord(this._value[start - 1]) && !isSpace(this._value[start - 1])) {
        start -= 1;
      }
      while (start > 0 && isWord(this._value[start - 1])) start -= 1;
    }
    this._value = this._value.slice(0, start) + this._value.slice(this._cursor);
    this._cursor = start;
  }

  private handleKillWord(): InputBoxEvent {
    this.deleteWordBefore();
    return { type: 'change', value: this._value, cursor: this._cursor };
  }

  private handleKillLine(): InputBoxEvent {
    const end = this.lineEnd(this._cursor);
    this._value = this._value.slice(0, this._cursor) + this._value.slice(end);
    return { type: 'change', value: this._value, cursor: this._cursor };
  }

  private handleHistory(getEntry: (current: string) => string | null): InputBoxEvent {
    const entry = getEntry(this._value);
    if (entry === null) return { type: 'none' };
    this._value = entry;
    this._cursor = entry.length;
    return { type: 'history', index: 0, value: entry, cursor: this._cursor };
  }

  private completeAtCursor(): InputBoxEvent {
    if (!this.complete) return { type: 'none' };
    const suggestions = normalize(this.complete(this._value, this._cursor));
    if (suggestions.length === 0) return { type: 'none' };
    if (suggestions.length === 1) {
      this.applyCompletion(suggestions[0]);
      return { type: 'change', value: this._value, cursor: this._cursor };
    }
    return { type: 'complete', suggestions, line: this._value, cursor: this._cursor };
  }

  /** Accept a single suggestion by replacing the current word token. */
  private applyCompletion(suggestion: CompletionSuggestion): void {
    let start = this._cursor;
    while (start > 0) {
      const ch = this._value[start - 1];
      if (/[\s\n]/.test(ch)) break;
      start -= 1;
    }
    const end = this._cursor;
    const tail = this._value.slice(end);
    this._value = this._value.slice(0, start) + suggestion.value + tail;
    this._cursor = start + suggestion.value.length;
  }
}