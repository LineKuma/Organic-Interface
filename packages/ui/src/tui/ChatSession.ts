/**
 * @organic/ui - tui ChatSession
 *
 * Orchestrates the interactive TUI: an InputBox backed by a History and a
 * SlashCommand registry, a message buffer, and formatted output. It is the
 * "mainstream agent CLI" surface — type a prompt, hit Enter, get a formatted
 * assistant reply; use `/commands`, Up/Down history, Tab completion and Ctrl-R.
 *
 * Business logic is exercised through `feedKey()` (key events) and `consume()`
 * (a submitted line), both of which are I/O-free and unit-testable. `start()`
 * wires those into real terminal keypresses/rendering.
 */

import * as readline from 'node:readline';
import { History } from './History.js';
import { InputBox } from './InputBox.js';
import { SlashCommandRegistry, type SlashCommandDefinition } from './SlashCommand.js';
import { renderMessage, renderCommandMenu, renderStatusLine } from './render.js';
import type { ChatMessage, ChatRole, KeyEvent, StatusLine } from './types.js';
import { Terminal } from '../terminal/Terminal.js';

/**
 * A sink for rendered output. Defaults to `console.log` when not provided so
 * tests can capture output instead.
 */
export type OutputSink = (line: string) => void;

/**
 * Callback invoked by the session when the user submits an ordinary message.
 * Return a string to have it rendered as an assistant reply, or `undefined` to
 * keep the session quiet.
 */
export type UserMessageHandler = (
  content: string,
  session: ChatSession
) => Promise<string | void> | string | void;

/**
 * ChatSession options.
 */
export interface ChatSessionOptions {
  /** Session name (used for the prompt and status bar). */
  name?: string;
  /** Short description shown in the welcome banner. */
  description?: string;
  /** Version shown in the welcome banner. */
  version?: string;
  /** History store; created with sensible defaults when omitted. */
  history?: History;
  /** Slash-command registry; built-ins are registered when omitted. */
  slash?: SlashCommandRegistry;
  /** Input box; created with sensible defaults when omitted. */
  inputBox?: InputBox;
  /** Invoked for ordinary (non-slash) user messages. */
  onUserMessage?: UserMessageHandler;
  /** Output sink for rendered lines. */
  output?: OutputSink;
  /** Width hint used by the status bar. */
  width?: number;
}

/**
 * Interactive chat session.
 */
export class ChatSession {
  readonly history: History;
  readonly slash: SlashCommandRegistry;
  readonly inputBox: InputBox;
  readonly messages: ChatMessage[] = [];

  private readonly options: Required<
    Pick<ChatSessionOptions, 'name' | 'description' | 'version' | 'width'>
  >;
  private readonly onUserMessage?: UserMessageHandler;
  private readonly output: OutputSink;
  private idCounter = 0;
  private running = false;

  constructor(options: ChatSessionOptions = {}) {
    this.options = {
      name: options.name ?? 'organic',
      description: options.description ?? 'Organic Interface',
      version: options.version ?? '0.1.0',
      width: options.width ?? 80,
    };
    this.output = options.output ?? ((line: string): void => console.log(line));
    this.onUserMessage = options.onUserMessage;

    this.history = options.history ?? new History();
    this.slash = options.slash ?? new SlashCommandRegistry();
    this.registerBuiltInSlashCommands();

    this.inputBox =
      options.inputBox ??
      new InputBox({
        prompt: `${this.options.name}> `,
        history: this.history,
        complete: (buffer, cursor) => this.complete(buffer, cursor),
      });
  }

  /** Register the navigational built-in slash commands on this session. */
  private registerBuiltInSlashCommands(): void {
    for (const def of baseSlashCommands(this)) {
      this.slash.register(def);
    }
  }

  /** Append a message to the buffer and return it. */
  addMessage(role: ChatRole, content: string, extra: Pick<ChatMessage, 'error' | 'data'> = {}): ChatMessage {
    const message: ChatMessage = {
      id: `msg_${++this.idCounter}`,
      role,
      content,
      error: extra.error,
      data: extra.data,
      createdAt: Date.now(),
    };
    this.messages.push(message);
    return message;
  }

  /** Register an additional slash command. */
  registerSlash(def: SlashCommandDefinition): this {
    this.slash.register(def);
    return this;
  }

  /**
   * Completion provider handed to the input box: slash-command names when the
   * caret is inside the initial `/token`, otherwise nothing.
   */
  private complete(buffer: string, cursor: number): string[] | Array<{ value: string }> {
    void cursor;
    if (!this.slash.isSlash(buffer)) return [];
    const hits = this.slash.complete(buffer);
    return hits.map(value => ({ value }));
  }

  /**
   * Process one submitted line. Slash commands are dispatched to their handler;
   * ordinary text is recorded as a user message and passed to `onUserMessage`.
   * Returns `'exit'` to instruct the caller to close the session.
   */
  async consume(line: string): Promise<'continue' | 'exit'> {
    const text = line.trim();
    if (!text) return 'continue';

    if (this.slash.isSlash(text)) {
      const parsed = this.slash.parse(text);
      if (parsed.kind !== 'command') return 'continue';
      const def = this.slash.get(parsed.command);
      if (!def) {
        this.output(`Unknown slash command '${text.split(/\s+/)[0]}'. Type /help for a list.`);
        return 'continue';
      }
      try {
        return await this.runSlash(text);
      } catch (error) {
        this.addMessage('system', error instanceof Error ? error.message : String(error), {
          error: true,
        });
        this.render(this.messages[this.messages.length - 1]);
        return 'continue';
      }
    }

    this.inputBox.setValue('');
    this.history.push(text);
    this.addMessage('user', text);

    if (this.onUserMessage) {
      const reply = await this.onUserMessage(text, this);
      if (reply) this.addMessage('assistant', reply);
    }
    return 'continue';
  }

  /** Run a slash command, render its output and report whether to exit. */
  private async runSlash(line: string): Promise<'continue' | 'exit'> {
    const result = await this.slash.run(line);
    if (result?.output) {
      this.addMessage('system', result.output);
      this.render(this.messages[this.messages.length - 1]);
    }
    if (result?.exit) {
      this.running = false;
      return 'exit';
    }
    return 'continue';
  }

  /** Render a single stored message through the output sink. */
  private render(message: ChatMessage): void {
    this.output(renderMessage(message));
  }

  /** Render the status line (used at the bottom of the UI). */
  renderStatus(): string {
    const status: StatusLine = {
      left: `${this.options.name} v${this.options.version}`,
      middle: `${this.options.name}>  type '/help' for commands`,
      right: `${this.messages.length} msgs`,
    };
    return renderStatusLine(status, undefined, this.options.width);
  }

  /** Render the slash-command help menu. */
  renderHelp(): string {
    return renderCommandMenu(this.slash.list());
  }

  /** Feed one key event (headless/testable entry point). */
  feedKey(key: KeyEvent): void {
    const event = this.inputBox.handleKey(key);
    if (event.type === 'submit') {
      void this.consume(event.value);
    } else if (event.type === 'complete') {
      // Surface the menu; single suggestions are applied by the input box itself.
      if (event.suggestions.length > 1) {
        this.output(this.renderHelp());
      }
    }
  }

  /**
   * Start the interactive loop. Uses raw keypress events when stdin is a TTY,
   * falling back to a line-based interface for piped/non-TTY input.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.output('');
    this.output(`${this.options.name} - ${this.options.description}`);
    this.output(`Version ${this.options.version}`);
    this.output(`Type '/help' for commands. Use ↑/↓ for history, Tab to complete.`);
    this.output('');

    const {isTTY} = Terminal.get().features;

    if (!isTTY) {
      const rl = readline.createInterface({ input: process.stdin, terminal: false });
      for await (const line of rl) {
        const action = await this.consume(line);
        if (action === 'exit') break;
      }
      return;
    }

    await this.startKeypressLoop();
  }

  /** Raw-mode keypress loop (only reached when stdin is a TTY). */
  private async startKeypressLoop(): Promise<void> {
    const {stdin} = process;

    // Configure raw mode for fine-grained keypress events.
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    readline.emitKeypressEvents(stdin);

    const draw = (): void => {
      const line = this.inputBox.prefix + this.inputBox.value;
      process.stdout.write(`\x1b[2K\r${  line}`);
      // Reposition the caret over the current edit point.
      const within = this.inputBox.value.slice(0, this.inputBox.cursor);
      process.stdout.write(`\x1b[${within.length + this.inputBox.prefix.length}G`);
    };

    const onKey = async (key: string, raw: KeyEvent): Promise<void> => {
      // Ctrl-C quits.
      if (raw.ctrl && (raw.name === 'c' || raw.name === 'd')) {
        process.stdout.write('\n');
        this.running = false;
        stdin.setRawMode(false);
        stdin.pause();
        return;
      }

      const event = this.inputBox.handleKey(raw);
      if (event.type === 'submit') {
        process.stdout.write('\n');
        const action = await this.consume(event.value);
        if (action === 'exit' || !this.running) {
          this.running = false;
          stdin.setRawMode(false);
          stdin.pause();
          return;
        }
      } else if (event.type === 'complete' && event.suggestions.length > 1) {
        process.stdout.write('\n');
        this.output(this.renderHelp());
        this.output('────────────────────────────────────────────');
      }
      if (this.running) draw();
    };

    const handler = (key: string, value: KeyEvent): void => {
      void onKey(key, value);
    };

    (stdin as NodeJS.EventEmitter).on('keypress', handler);

    draw();

    await new Promise<void>(resolve => {
      const timer = setInterval(() => {
        if (!this.running) {
          clearInterval(timer);
          (stdin as NodeJS.EventEmitter).off('keypress', handler);
          this.output('');
          resolve();
        }
      }, 50);
    });
  }
}

/**
 * Create a ChatSession with common defaults.
 */
export function createChatSession(options: ChatSessionOptions = {}): ChatSession {
  return new ChatSession(options);
}

/**
 * Core navigational slash commands that every powered-up session registers.
 * Business commands should be added via `registerSlash()`.
 */
export function baseSlashCommands(session: ChatSession): SlashCommandDefinition[] {
  return [
    {
      name: 'help',
      description: 'Show all slash commands',
      handler: () => ({ output: session.renderHelp() }),
    },
    {
      name: 'clear',
      description: 'Clear the conversation and screen',
      handler: () => {
        session.messages.length = 0;
        process.stdout.write('\x1b[2J\x1b[H');
        return { output: 'Conversation cleared.' };
      },
    },
    {
      name: 'exit',
      aliases: ['quit', 'q'],
      description: 'Exit the session',
      handler: () => ({ exit: true, output: 'Goodbye!' }),
    },
    {
      name: 'history',
      description: 'Show command history',
      handler: () => {
        const entries = session.history.all();
        if (entries.length === 0) return { output: 'No history.' };
        return {
          output: entries.map((e, i) => `${String(i + 1).padStart(3)}  ${e}`).join('\n'),
        };
      },
    },
  ];
}