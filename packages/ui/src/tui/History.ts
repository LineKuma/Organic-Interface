/**
 * @organic/ui - tui History
 *
 * Command history with bounded size, up/down navigation and reverse search.
 * Optionally persists to a file so history survives across sessions (a common
 * feature of mainstream agent CLIs).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * History options.
 */
export interface HistoryOptions {
  /** Maximum number of entries retained (oldest dropped). */
  max?: number;
  /** Optional file path used to persist/restore history between sessions. */
  filePath?: string;
}

/**
 * Command history store.
 *
 * - Entries are deduplicated against the most recent entry to avoid repeats.
 * - `previous()` / `next()` move a navigation cursor so the Up/Down arrows browse
 *   the history, mirroring mainstream agent CLI behaviour.
 * - `search()` implements incremental reverse search (like Ctrl-R) returning the
 *   most-recent matches first.
 */
export class History {
  private readonly max: number;
  private readonly filePath?: string;
  private entries: string[] = [];
  /** Navigation cursor: -1 means "editing a fresh line", otherwise an index. */
  private cursor = -1;
  /** Input captured when navigation started, restored when moving below oldest. */
  private draft = '';

  constructor(options: HistoryOptions = {}) {
    this.max = options.max ?? 1000;
    this.filePath = options.filePath;
    this.entries = this.filePath ? this.load(this.filePath) : [];
  }

  /** Number of stored entries. */
  get length(): number {
    return this.entries.length;
  }

  /** All entries, oldest first. */
  all(): readonly string[] {
    return [...this.entries];
  }

  /** Push a new command into the history and persist. */
  push(entry: string): void {
    const text = entry.trim();
    if (!text) return;
    // De-duplicate consecutive entries.
    if (this.entries[this.entries.length - 1] === text) return;
    this.entries.push(text);
    if (this.entries.length > this.max) {
      this.entries.splice(0, this.entries.length - this.max);
    }
    this.cursor = -1;
    this.draft = '';
    this.save();
  }

  /** Clear the whole history and persist. */
  clear(): void {
    this.entries = [];
    this.cursor = -1;
    this.draft = '';
    this.save();
  }

  /**
   * Reset the navigation cursor back to the "fresh line" position. Call this
   * after moving the cursor away from history editing.
   */
  reset(): void {
    this.cursor = -1;
    this.draft = '';
  }

  /**
   * Move one step up (older). Returns the entry to show, or `null` when there is
   * nothing older. The first call captures the current draft input.
   */
  previous(currentInput: string): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor < 0) {
      this.draft = currentInput;
      this.cursor = this.entries.length - 1;
    } else if (this.cursor > 0) {
      this.cursor -= 1;
    } else {
      return null;
    }
    return this.entries[this.cursor];
  }

  /**
   * Move one step down (newer). Returns the entry to show, the captured draft
   * when passing the newest entry, or `null` if there is no history at all.
   */
  next(): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor < 0) return null;
    if (this.cursor < this.entries.length - 1) {
      this.cursor += 1;
      return this.entries[this.cursor];
    }
    // Reached the newest entry; fall back to the captured draft.
    const {draft} = this;
    this.cursor = -1;
    this.draft = '';
    return draft;
  }

  /**
   * Reverse search. Returns entries containing `query`, most-recent first.
   * An empty query returns nothing (a no-op search is not useful).
   */
  search(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches: string[] = [];
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (this.entries[i].toLowerCase().includes(q)) {
        matches.push(this.entries[i]);
      }
    }
    return matches;
  }

  /**
   * Find the most recent entry containing `query`, or `null` (used for Ctrl-R).
   */
  find(query: string): string | null {
    const matches = this.search(query);
    return matches.length > 0 ? matches[0] : null;
  }

  // ── Persistence ─────────────────────────────────────────────

  /**
   * Replace all in-memory entries with the persisted file content. Bounded by
   * `max`, newest kept.
   */
  replaceFromFile(filePath: string): void {
    const loaded = this.load(filePath);
    this.entries = loaded;
  }

  /**
   * Read persisted entries from `filePath`. Returns `[]` whenever the file is
   * missing or unreadable so a bad history file never crashes the shell.
   */
  private load(filePath: string): string[] {
    try {
      if (!existsSync(filePath)) return [];
      const raw = readFileSync(filePath, 'utf8');
      const lines = raw
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      return lines.slice(-this.max);
    } catch {
      // Unreadable/invalid history file: treat as empty.
      return [];
    }
  }

  /**
   * Persist entries to `filePath` if configured. Tolerates missing directories
   * by creating them; silently ignores write errors.
   */
  private save(): void {
    if (!this.filePath) return;
    try {
      const dir = dirname(this.filePath);
      if (dir) mkdirSync(dir, { recursive: true });
      writeFileSync(this.filePath, this.entries.join('\n') + (this.entries.length ? '\n' : ''), 'utf8');
    } catch {
      // Persistence is best-effort; never crash the interactive session.
    }
  }
}