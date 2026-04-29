import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandParser, defaultParser } from '../CommandParser.js';
import { createCommand } from '../Command.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('CommandParser', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
  });

  describe('constructor', () => {
    it('should create parser instance', () => {
      expect(parser).toBeDefined();
    });
  });

  describe('parse', () => {
    it('should parse simple command', () => {
      const result = parser.parse('test');
      expect(result.success).toBe(true);
      expect(result.parsed?.command).toBe('test');
    });

    it('should parse command with arguments', () => {
      const result = parser.parse('test arg1 arg2');
      expect(result.success).toBe(true);
      expect(result.parsed?.raw).toEqual(['arg1', 'arg2']);
    });

    it('should parse command with options', () => {
      const result = parser.parse('test --verbose --output=file.txt');
      expect(result.success).toBe(true);
      expect(result.parsed?.options.verbose).toBe(true);
      expect(result.parsed?.options.output).toBe('file.txt');
    });

    it('should parse command with short options', () => {
      const result = parser.parse('test -v -o file.txt');
      expect(result.success).toBe(true);
      expect(result.parsed?.options.v).toBe(true);
      expect(result.parsed?.options.o).toBe('file.txt');
    });

    it('should parse command with quoted arguments', () => {
      const result = parser.parse('test "arg with spaces"');
      expect(result.success).toBe(true);
      expect(result.parsed?.raw).toContain('arg with spaces');
    });

    it('should return error for empty input', () => {
      const result = parser.parse('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty input');
    });

    it('should handle option with equals sign value', () => {
      const result = parser.parse('test --name=value');
      expect(result.success).toBe(true);
      expect(result.parsed?.options.name).toBe('value');
    });
  });

  describe('validate', () => {
    it('should validate required arguments', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test',
        arguments: [
          { name: 'input', description: 'Input file', required: true },
        ],
      });

      const parsed = parser.parse('test');
      const result = parser.validate(parsed.parsed!, cmd);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required argument');
    });

    it('should validate required options', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test',
        options: [
          { long: 'required', description: 'Required option', required: true },
        ],
      });

      const parsed = parser.parse('test');
      const result = parser.validate(parsed.parsed!, cmd);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required option');
    });

    it('should pass validation for valid input', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test',
        arguments: [
          { name: 'input', description: 'Input file' },
        ],
        options: [
          { long: 'verbose', description: 'Verbose mode' },
        ],
      });

      const parsed = parser.parse('test file.txt --verbose');
      const result = parser.validate(parsed.parsed!, cmd);
      expect(result.valid).toBe(true);
    });
  });

  describe('extractArgs', () => {
    it('should use default values for missing arguments', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test',
        arguments: [
          { name: 'input', description: 'Input file', defaultValue: 'default.txt' },
        ],
      });

      const parsed = parser.parse('test');
      const args = parser.extractArgs(parsed.parsed!, cmd);
      expect(args.input).toBe('default.txt');
    });

    it('should extract options with type conversion', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test',
        options: [
          { long: 'count', description: 'Count', valueType: 'number' },
          { long: 'debug', description: 'Debug mode', valueType: 'boolean' },
        ],
      });

      const parsed = parser.parse('test --count=5 --debug');
      const args = parser.extractArgs(parsed.parsed!, cmd);
      expect(args.count).toBe(5);
      expect(args.debug).toBe(true);
    });

    it('should use default values for missing options', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test',
        options: [
          { long: 'verbose', description: 'Verbose', defaultValue: false },
        ],
      });

      const parsed = parser.parse('test');
      const args = parser.extractArgs(parsed.parsed!, cmd);
      expect(args.verbose).toBe(false);
    });
  });

  describe('formatHelp', () => {
    it('should format help for command', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('test');
      expect(help).toContain('Test command');
    });

    it('should format help with arguments', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
        arguments: [
          { name: 'input', description: 'Input file', required: true },
          { name: 'output', description: 'Output file', required: false },
        ],
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('<input>');
      expect(help).toContain('[output]');
    });

    it('should format help with options', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
        options: [
          { short: 'v', long: 'verbose', description: 'Verbose mode' },
        ],
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('-v');
      expect(help).toContain('--verbose');
    });

    it('should format help with aliases', () => {
      const cmd = createCommand({
        name: 'test',
        description: 'Test command',
        aliases: ['t', 'ts'],
      });

      const help = parser.formatHelp(cmd);
      expect(help).toContain('Aliases: t, ts');
    });
  });

  describe('defaultParser', () => {
    it('should be a CommandParser instance', () => {
      expect(defaultParser).toBeDefined();
      expect(defaultParser).toBeInstanceOf(CommandParser);
    });
  });
});
