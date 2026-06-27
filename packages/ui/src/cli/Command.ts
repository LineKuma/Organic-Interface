/**
 * Command interface for CLI
 */

import type { Logger } from '@organic/utils';

/**
 * Command option definition
 */
export interface CommandOption {
  /** Short flag (e.g., 'v') */
  short?: string;
  /** Long flag (e.g., 'verbose') */
  long: string;
  /** Option description */
  description: string;
  /** Whether the option is required */
  required?: boolean;
  /** Default value if not provided */
  defaultValue?: string | boolean | number;
  /** Expected value type */
  valueType?: 'string' | 'number' | 'boolean';
}

/**
 * Command argument definition
 */
export interface CommandArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description: string;
  /** Whether the argument is required */
  required?: boolean;
  /** Default value if not provided */
  defaultValue?: string;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether the command executed successfully */
  success: boolean;
  /** Exit code */
  code: number;
  /** Output message */
  message?: string;
  /** Error details if failed */
  error?: string;
}

/**
 * Command handler function type
 */
export type CommandHandler = (
  args: Record<string, unknown>,
  logger: Logger
) => Promise<CommandResult> | CommandResult;

/**
 * Command definition
 */
export interface Command {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Command aliases */
  aliases?: string[];
  /** Command arguments */
  arguments?: CommandArgument[];
  /** Command options */
  options?: CommandOption[];
  /** Subcommands */
  subcommands: Map<string, Command>;
  /** Parent command (for subcommands) */
  parent?: Command;
  /** Handler function */
  handler?: CommandHandler;
}

/**
 * Create a basic command
 */
export function createCommand(config: {
  name: string;
  description: string;
  aliases?: string[];
  arguments?: CommandArgument[];
  options?: CommandOption[];
  handler?: CommandHandler;
}): Command {
  return {
    name: config.name,
    description: config.description,
    aliases: config.aliases,
    arguments: config.arguments,
    options: config.options,
    subcommands: new Map(),
    handler: config.handler,
  };
}

/**
 * Add a subcommand to a command
 */
export function addSubcommand(parent: Command, subcommand: Command): Command {
  if (!parent.subcommands) {
    parent.subcommands = new Map();
  }
  parent.subcommands.set(subcommand.name, subcommand);
  subcommand.parent = parent;

  // Also register aliases
  if (subcommand.aliases) {
    for (const alias of subcommand.aliases) {
      parent.subcommands.set(alias, subcommand);
    }
  }

  return parent;
}

/**
 * Find a command by name or alias
 */
export function findCommand(root: Command, name: string): Command | undefined {
  return root.subcommands?.get(name);
}
