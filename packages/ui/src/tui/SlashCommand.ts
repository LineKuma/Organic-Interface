/**
 * @organic/ui - tui SlashCommand
 *
 * Slash-command system modelled after mainstream agent CLIs (Claude Code / Cursor
 * / Warp): a line that begins with `/command` invokes a registered handler, while
 * anything else is treated as ordinary text. Includes registration, alias
 * resolution, `/help`-style listing and Tab-completion hints.
 */

/**
 * Context passed to a slash-command handler.
 */
export interface SlashCommandContext {
  /** Everything after the command name, trimmed (possibly empty). */
  args: string;
  /** The full submitted line, including the leading `/name`. */
  raw: string;
}

/**
 * Result a handler may use to influence the session.
 */
export interface SlashCommandResult {
  /** Text to render as a system-level response to the command. */
  output?: string;
  /** Set true to close the interactive session after the handler runs. */
  exit?: boolean;
}

/**
 * A slash-command handler. It may be sync or async and may return a result.
 */
export type SlashCommandHandler = (
  ctx: SlashCommandContext
) => SlashCommandResult | Promise<SlashCommandResult>;

/**
 * Definition of a single slash command (name excludes the leading `/`).
 */
export interface SlashCommandDefinition {
  /** Command name, without the leading `/`. */
  name: string;
  /** Short human readable description (shown in `/help`). */
  description: string;
  /** Alternative aliases, without the leading `/`. */
  aliases?: string[];
  /** Example usage shown in `/help`. */
  usage?: string;
  /** Hide the command from `/help` listings (advanced commands). */
  hidden?: boolean;
  /** Invoked when the command is entered. */
  handler: SlashCommandHandler;
}

/**
 * Parsed shape of an input line.
 */
export type SlashLine =
  | { kind: 'command'; command: string; args: string; raw: string }
  | { kind: 'text'; text: string };

/**
 * A standalone slash-command definition built from a name + handler.
 */
export function slashCommand(
  name: string,
  description: string,
  handler: SlashCommandHandler,
  extra: Partial<Pick<SlashCommandDefinition, 'aliases' | 'usage' | 'hidden'>> = {}
): SlashCommandDefinition {
  return { name, description, handler, ...extra };
}

/**
 * Registry of slash commands with lookup, completion and dispatch helpers.
 */
export class SlashCommandRegistry {
  private readonly commands = new Map<string, SlashCommandDefinition>();
  private readonly aliases = new Map<string, string>();

  /** Register (or overwrite) a command definition. */
  register(def: SlashCommandDefinition): this {
    this.commands.set(def.name, def);
    for (const alias of def.aliases ?? []) {
      this.aliases.set(alias, def.name);
    }
    return this;
  }

  /** Register many definitions at once. */
  registerAll(defs: SlashCommandDefinition[]): this {
    for (const def of defs) this.register(def);
    return this;
  }

  /** Remove a command (by name or alias). Returns true when removed. */
  unregister(name: string): boolean {
    const canonical = this.resolve(name);
    if (!canonical) return false;
    const def = this.commands.get(canonical);
    this.commands.delete(canonical);
    if (def) {
      for (const alias of def.aliases ?? []) this.aliases.delete(alias);
    }
    return true;
  }

  /** Resolve a name or alias to its canonical command name. */
  resolve(name: string): string | undefined {
    if (this.commands.has(name)) return name;
    return this.aliases.get(name);
  }

  /** Look up a definition by name or alias. */
  get(name: string): SlashCommandDefinition | undefined {
    const canonical = this.resolve(name);
    if (!canonical) return undefined;
    return this.commands.get(canonical);
  }

  /** List all visible commands (used by `/help`). */
  list(): SlashCommandDefinition[] {
    return [...this.commands.values()].filter(def => !def.hidden);
  }

  /** All registered names (including hidden), for completion. */
  names(): string[] {
    return [...this.commands.values()].map(def => def.name);
  }

  /** Return true when a line looks like a slash command invocation. */
  isSlash(line: string): boolean {
    return line.length > 1 && line.startsWith('/') && !line.startsWith('//');
  }

  /**
   * Parse an input line. Returns a `command` node when it is a known slash command
   * (resolving aliases), a `text` node for ordinary input, or a `command` node
   * with `command` set and no registered handler when it looks like an unknown
   * slash command (callers that need to distinguish use `get()`).
   */
  parse(line: string): SlashLine {
    const text = line.trim();
    if (this.isSlash(text)) {
      const [rawName, ...rest] = text.split(/\s+/);
      const name = rawName.replace(/^\//, '');
      const args = rest.join(' ').trim();
      return { kind: 'command', command: this.resolve(name) ?? name, args, raw: text };
    }
    return { kind: 'text', text };
  }

  /**
   * Suggest command names (with leading `/`) for a partial line used by the
   * input box for Tab completion. Only completes when the line looks like a
   * command and the caret is at the start of the command token.
   */
  complete(line: string): string[] {
    const text = line.trim();
    if (!text.startsWith('/') || text.startsWith('//') || /[/\s]/.test(text.slice(1))) {
      return [];
    }
    const partial = text.slice(1).toLowerCase();
    return this.names()
      .filter(name => name.toLowerCase().startsWith(partial))
      .map(name => `/${name}`)
      .sort();
  }

  /**
   * Execute a slash command line. Returns `null` when the line is not a slash
   * command. Throws for unknown commands so the caller can present an error.
   */
  async run(line: string): Promise<SlashCommandResult | null> {
    const parsed = this.parse(line);
    if (parsed.kind !== 'command') return null;
    const def = this.get(parsed.command);
    if (!def) {
      throw new Error(`Unknown slash command '${parsed.raw.split(/\s+/)[0]}'. Type /help for a list.`);
    }
    return def.handler({ args: parsed.args, raw: parsed.raw });
  }
}