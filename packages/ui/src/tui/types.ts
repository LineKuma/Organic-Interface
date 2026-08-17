/**
 * @organic/ui - tui shared types
 *
 * Shared types for the interactive TUI layer (InputBox / History / SlashCommand /
 * message rendering). These are pure, framework-agnostic types so the TUI components
 * can be unit-tested without a real terminal and re-used by WebUI renderers later.
 */

/**
 * Role of a chat message.
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A single message in the TUI conversation buffer.
 */
export interface ChatMessage {
  /** Stable message id (assigned by the session when pushed). */
  id?: string;
  /** Who produced the message. */
  role: ChatRole;
  /** Message body (rendered via the format layer). */
  content: string;
  /** Optional structured payload attached to the message. */
  data?: Record<string, unknown>;
  /** Whether the message represents an error (styled red). */
  error?: boolean;
  /** Epoch ms timestamp. */
  createdAt?: number;
}

/**
 * A normalized key event, compatible with Node's `readline.emitKeypressEvents`.
 */
export interface KeyEvent {
  /** Printable character, if any. */
  char?: string;
  /** Canonical key name, e.g. `left`, `enter`, `tab`, `up`. */
  name?: string;
  /** Whether Ctrl was held. */
  ctrl?: boolean;
  /** Whether Meta/Alt was held. */
  meta?: boolean;
  /** Whether Shift was held. */
  shift?: boolean;
  /** Raw escape sequence. */
  sequence?: string;
}

/**
 * A completion candidate produced for Tab-expansion.
 */
export interface CompletionSuggestion {
  /** Text to insert on accept. */
  value: string;
  /** Text shown in the completion menu (usually identical to `value`). */
  label?: string;
  /** Optional one-line description shown next to the menu item. */
  detail?: string;
}

/**
 * Result of feeding one key event into `InputBox`.
 */
export type InputBoxEvent =
  | { type: 'submit'; value: string }
  | { type: 'complete'; suggestions: CompletionSuggestion[]; line: string; cursor: number }
  | { type: 'history'; index: number; value: string; cursor: number }
  | { type: 'change'; value: string; cursor: number }
  | { type: 'none' };

/**
 * Status line segments used to render the bottom status bar.
 */
export interface StatusLine {
  left: string;
  middle: string;
  right: string;
}
