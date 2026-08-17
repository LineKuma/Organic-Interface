/**
 * @organic/ui - tui module
 *
 * The interactive TUI layer. Modelled after mainstream agent CLIs:
 *  - InputBox: key-driven line editor with cursor, history and Tab completion.
 *  - History: bounded persistent command history with reverse search.
 *  - SlashCommand: `/command` system with aliases and completion.
 *  - render: formatted output (role badges, code blocks, Markdown-ish body).
 *  - ChatSession: orchestrator wiring the above into an interactive session.
 */

export { History, type HistoryOptions } from './History.js';
export {
  SlashCommandRegistry,
  slashCommand,
  type SlashCommandContext,
  type SlashCommandDefinition,
  type SlashCommandHandler,
  type SlashCommandResult,
  type SlashLine,
} from './SlashCommand.js';
export { InputBox, type CompletionProvider, type InputBoxOptions } from './InputBox.js';
export {
  ChatSession,
  createChatSession,
  baseSlashCommands,
  type ChatSessionOptions,
  type UserMessageHandler,
  type OutputSink,
} from './ChatSession.js';
export {
  roleBadge,
  renderCodeBlock,
  renderRichText,
  renderMessage,
  renderCommandMenu,
  renderCompletionMenu,
  renderStatusLine,
} from './render.js';
export type {
  ChatMessage,
  ChatRole,
  KeyEvent,
  CompletionSuggestion,
  InputBoxEvent,
  StatusLine,
} from './types.js';
