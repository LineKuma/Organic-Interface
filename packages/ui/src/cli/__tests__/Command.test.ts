import { describe, it, expect } from 'vitest';
import { Command, CommandOption, CommandArgument, CommandResult, createCommand, addSubcommand, findCommand } from '../Command.js';

describe('Command', () => {
  describe('CommandOption', () => {
    it('should accept option with required fields', () => {
      const option: CommandOption = {
        long: 'verbose',
        description: 'Enable verbose output',
      };
      expect(option.long).toBe('verbose');
    });

    it('should accept option with all fields', () => {
      const option: CommandOption = {
        short: 'v',
        long: 'verbose',
        description: 'Enable verbose output',
        required: true,
        defaultValue: false,
        valueType: 'boolean',
      };
      expect(option.short).toBe('v');
      expect(option.required).toBe(true);
    });
  });

  describe('CommandArgument', () => {
    it('should accept argument with required fields', () => {
      const arg: CommandArgument = {
        name: 'input',
        description: 'Input file path',
      };
      expect(arg.name).toBe('input');
    });

    it('should accept optional argument', () => {
      const arg: CommandArgument = {
        name: 'input',
        description: 'Input file path',
        required: false,
        defaultValue: 'default.txt',
      };
      expect(arg.required).toBe(false);
      expect(arg.defaultValue).toBe('default.txt');
    });
  });

  describe('CommandResult', () => {
    it('should accept success result', () => {
      const result: CommandResult = {
        success: true,
        code: 0,
        message: 'Command executed successfully',
      };
      expect(result.success).toBe(true);
      expect(result.code).toBe(0);
    });

    it('should accept error result', () => {
      const result: CommandResult = {
        success: false,
        code: 1,
        error: 'Command failed',
      };
      expect(result.success).toBe(false);
      expect(result.code).toBe(1);
    });
  });

  describe('createCommand', () => {
    it('should create command with required fields', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
      });
      expect(cmd.name).toBe('test');
      expect(cmd.description).toBe('Test command');
    });

    it('should create command with aliases', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
        aliases: ['t', 'ts'],
      });
      expect(cmd.aliases).toEqual(['t', 'ts']);
    });

    it('should create command with arguments', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
        arguments: [
          { name: 'input', description: 'Input file' },
        ],
      });
      expect(cmd.arguments).toHaveLength(1);
    });

    it('should create command with options', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
        options: [
          { long: 'verbose', description: 'Verbose mode' },
        ],
      });
      expect(cmd.options).toHaveLength(1);
    });

    it('should create command with subcommands map', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
      });
      expect(cmd.subcommands).toBeDefined();
      expect(cmd.subcommands.size).toBe(0);
    });
  });

  describe('addSubcommand', () => {
    it('should add subcommand to parent', () => {
      const parent = createCommand({
        name: 'parent',
        description: 'Parent command',
      });
      const child = createCommand({
        name: 'child',
        description: 'Child command',
      });

      addSubcommand(parent, child);
      expect(parent.subcommands?.size).toBe(1);
      expect(parent.subcommands?.get('child')).toBe(child);
    });

    it('should set child parent reference', () => {
      const parent = createCommand({
        name: 'parent',
        description: 'Parent command',
      });
      const child = createCommand({
        name: 'child',
        description: 'Child command',
      });

      addSubcommand(parent, child);
      expect(child.parent).toBe(parent);
    });

    it('should register aliases for subcommand', () => {
      const parent = createCommand({
        name: 'parent',
        description: 'Parent command',
      });
      const child = createCommand({
        name: 'child',
        description: 'Child command',
        aliases: ['c'],
      });

      addSubcommand(parent, child);
      expect(parent.subcommands?.get('c')).toBe(child);
    });
  });

  describe('findCommand', () => {
    it('should find command by name', () => {
      const root = createCommand({
        name: 'root',
        description: 'Root command',
      });
      const child = createCommand({
        name: 'child',
        description: 'Child command',
      });

      addSubcommand(root, child);
      const found = findCommand(root, 'child');
      expect(found).toBe(child);
    });

    it('should find command by alias', () => {
      const root = createCommand({
        name: 'root',
        description: 'Root command',
      });
      const child = createCommand({
        name: 'child',
        description: 'Child command',
        aliases: ['c'],
      });

      addSubcommand(root, child);
      const found = findCommand(root, 'c');
      expect(found).toBe(child);
    });

    it('should return undefined for non-existent command', () => {
      const root = createCommand({
        name: 'root',
        description: 'Root command',
      });
      const found = findCommand(root, 'non-existent');
      expect(found).toBeUndefined();
    });
  });
});
