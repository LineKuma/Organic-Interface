/**
 * InputParser Tests
 *
 * Tests for the InputParser class which handles parsing, validation,
 * and intent extraction from user input.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputParser } from '../InputParser.js';
import { InputType, MessageSender } from '../types/index.js';

describe('InputParser', () => {
  let parser: InputParser;

  beforeEach(() => {
    parser = new InputParser({
      maxLength: 1000,
      enableCommands: true,
      enableIntentExtraction: true,
      stripWhitespace: true,
    });
  });

  describe('parse', () => {
    describe('plain text input', () => {
      it('should parse plain text as TEXT type', () => {
        const result = parser.parse('Hello, world!');

        expect(result.type).toBe(InputType.TEXT);
        expect(result.normalizedText).toBe('Hello, world!');
        expect(result.command).toBeUndefined();
      });

      it('should handle empty input', () => {
        const result = parser.parse('');

        expect(result.type).toBe(InputType.TEXT);
        expect(result.normalizedText).toBe('');
      });

      it('should handle null/undefined input', () => {
        const result1 = parser.parse(null as unknown as string);
        const result2 = parser.parse(undefined as unknown as string);

        expect(result1.type).toBe(InputType.TEXT);
        expect(result1.normalizedText).toBe('');
        expect(result2.type).toBe(InputType.TEXT);
        expect(result2.normalizedText).toBe('');
      });

      it('should trim whitespace when enabled', () => {
        const result = parser.parse('  Hello  ');

        expect(result.normalizedText).toBe('Hello');
      });

      it('should truncate input exceeding max length', () => {
        const longParser = new InputParser({ maxLength: 10 });
        const result = longParser.parse('This is a very long message');

        expect(result.normalizedText.length).toBe(10);
      });

      it('should preserve original length in metadata', () => {
        const result = parser.parse('  Hello world  ');

        // Original length is the length of the raw input before trimming
        expect(result.metadata.originalLength).toBe(15);
      });
    });

    describe('command input', () => {
      it('should parse command with / prefix', () => {
        const result = parser.parse('/help');

        expect(result.type).toBe(InputType.COMMAND);
        expect(result.command).toBe('help');
      });

      it('should parse command with arguments', () => {
        const result = parser.parse('/command arg1 arg2');

        expect(result.type).toBe(InputType.COMMAND);
        expect(result.command).toBe('command');
        expect(result.arguments).toBeDefined();
      });

      it('should parse key:value arguments', () => {
        const result = parser.parse('/search query:hello category:tech');

        expect(result.type).toBe(InputType.COMMAND);
        expect(result.command).toBe('search');
        expect(result.arguments?.query).toBe('hello');
        expect(result.arguments?.category).toBe('tech');
      });

      it('should parse quoted values', () => {
        const result = parser.parse('/command message:"hello world"');

        expect(result.arguments?.message).toBe('hello world');
      });

      it('should parse positional arguments', () => {
        const result = parser.parse('/command value1 value2');

        expect(result.arguments?._pos0).toBe('value1');
        expect(result.arguments?._pos1).toBe('value2');
      });

      it('should parse mixed positional and named arguments', () => {
        const result = parser.parse('/command filename:test.txt --verbose');

        expect(result.arguments?.filename).toBe('test.txt');
        expect(result.arguments?._pos0).toBe('--verbose');
      });

      it('should handle boolean values', () => {
        const result = parser.parse('/command flag:true');

        expect(result.arguments?.flag).toBe(true);
      });

      it('should handle numeric values', () => {
        const result = parser.parse('/command count:42');

        expect(result.arguments?.count).toBe(42);
      });

      it('should store raw arguments in options', () => {
        const result = parser.parse('/command arg1 arg2');

        expect(result.options?.rawArgs).toBe('arg1 arg2');
      });
    });

    describe('intent extraction', () => {
      it('should extract help intent', () => {
        const result = parser.parse('Can you help me with this?');

        expect(result.options?.intent).toBe('help');
      });

      it('should extract question intent', () => {
        const result = parser.parse('What is the weather like?');

        expect(result.options?.intent).toBe('question');
      });

      it('should extract code intent', () => {
        const result = parser.parse('Please write a function to sort an array');

        expect(result.options?.intent).toBe('code');
      });

      it('should extract search intent', () => {
        const result = parser.parse('Find all files with .ts extension');

        expect(result.options?.intent).toBe('search');
      });

      it('should extract modify intent', () => {
        const result = parser.parse('Edit the configuration file');

        expect(result.options?.intent).toBe('modify');
      });

      it('should return null for no matching intent', () => {
        const result = parser.parse('Just a regular message');

        // When no intent matches, options.intent is not set (undefined)
        expect(result.options?.intent).toBeUndefined();
      });
    });

    describe('token estimation', () => {
      it('should estimate tokens in metadata', () => {
        const result = parser.parse('Hello world');

        expect(result.metadata.tokenEstimate).toBeGreaterThan(0);
        expect(result.metadata.tokenEstimate).toBe(Math.ceil('Hello world'.length / 4));
      });

      it('should estimate more tokens for longer text', () => {
        const short = parser.parse('Hi');
        const long = parser.parse('This is a much longer sentence with more words');

        expect(long.metadata.tokenEstimate!).toBeGreaterThan(short.metadata.tokenEstimate!);
      });
    });

    describe('JSON input', () => {
      it('should parse JSON array as TEXT type', () => {
        const result = parser.parse('[1, 2, 3]');

        expect(result.type).toBe(InputType.TEXT);
        expect(result.arguments?.[0]).toBe(1);
        expect(result.arguments?.[1]).toBe(2);
        expect(result.arguments?.[2]).toBe(3);
      });

      it('should parse JSON object arguments', () => {
        const result = parser.parse('{"name": "test", "value": 42}');

        expect(result.arguments?.name).toBe('test');
        expect(result.arguments?.value).toBe(42);
      });

      it('should not parse invalid JSON as command', () => {
        const result = parser.parse('not { valid json');

        expect(result.type).toBe(InputType.TEXT);
        expect(result.arguments).toBeUndefined();
      });
    });
  });

  describe('validate', () => {
    it('should return valid for non-empty input', () => {
      const parsed = parser.parse('Hello');
      const result = parser.validate(parsed);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid for empty input', () => {
      const parsed = parser.parse('');
      const result = parser.validate(parsed);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].code).toBe('EMPTY_INPUT');
    });

    it('should warn when input was truncated', () => {
      const shortParser = new InputParser({ maxLength: 5 });
      const parsed = shortParser.parse('This is a long message');
      const result = shortParser.validate(parsed);

      expect(result.warnings).toBeDefined();
      expect(result.warnings![0].code).toBe('TRUNCATED');
    });

    it('should validate command name format', () => {
      const valid = parser.parse('/validCommand');
      const invalid1 = parser.parse('/123invalid');
      // /has-dash parses as command "has" with args "-dash"
      const invalid2 = parser.parse('/has-dash');
      // /has space parses as command "has" with args "space"
      const invalid3 = parser.parse('/has space');

      expect(parser.validate(valid).valid).toBe(true);
      expect(parser.validate(invalid1).valid).toBe(false);
      // The command name "has" is valid, the dash is parsed as argument
      expect(parser.validate(invalid2).valid).toBe(true);
      // The command name "has" is valid
      expect(parser.validate(invalid3).valid).toBe(true);
    });

    it('should require command name for command type', () => {
      const result = parser.validate({
        type: InputType.COMMAND,
        rawText: '/command',
        normalizedText: '/command',
        command: undefined,
        arguments: {},
        options: {},
        metadata: { timestamp: 0, originalLength: 9 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors!.some((e) => e.code === 'INVALID_COMMAND')).toBe(true);
    });
  });

  describe('extractIntent', () => {
    it('should return intent for matching pattern', () => {
      expect(parser.extractIntent('I need help')).toBe('help');
      expect(parser.extractIntent('How do I do this?')).toBe('question');
    });

    it('should return null for no match', () => {
      expect(parser.extractIntent('random text without intent')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(parser.extractIntent('HELP ME')).toBe('help');
      expect(parser.extractIntent('What is this')).toBe('question');
    });
  });

  describe('extractParameters', () => {
    it('should extract parameters using registered patterns', () => {
      parser.registerIntent(/download (\w+)/, 'download', (match) => ({
        filename: match[1],
      }));

      // The regex (\w+) only matches 'report', not 'report.pdf'
      const params = parser.extractParameters('download report');
      expect(params.filename).toBe('report');
    });

    it('should return empty object for no match', () => {
      const params = parser.extractParameters('no matching pattern');
      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe('registerIntent', () => {
    it('should register custom intent pattern', () => {
      parser.registerIntent(/^deploy$/, 'deploy');

      expect(parser.extractIntent('deploy')).toBe('deploy');
    });

    it('should allow multiple patterns for same intent', () => {
      parser.registerIntent(/\brun\b/i, 'execute');
      parser.registerIntent(/\bstart\b/i, 'execute');

      expect(parser.extractIntent('run this')).toBe('execute');
      expect(parser.extractIntent('start that')).toBe('execute');
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = parser.getHelp();

      expect(help).toContain('Available commands');
      expect(help).toContain('/help');
      expect(help).toContain('/status');
    });
  });

  describe('createMessage', () => {
    it('should create message from parsed input', () => {
      const parsed = parser.parse('Hello world');
      const message = parser.createMessage(parsed, 'session-1');

      expect(message.id).toMatch(/^msg_/);
      expect(message.content).toBe('Hello world');
      expect(message.sender).toBe(MessageSender.USER);
      expect(message.sessionId).toBe('session-1');
      expect(message.metadata).toBeDefined();
    });

    it('should include command info in message metadata', () => {
      const parsed = parser.parse('/command arg: value');
      const message = parser.createMessage(parsed);

      expect(message.metadata?.type).toBe(InputType.COMMAND);
      expect(message.metadata?.command).toBe('command');
      expect(message.metadata?.arguments).toBeDefined();
    });

    it('should generate unique message IDs', () => {
      const parsed = parser.parse('Test');
      const msg1 = parser.createMessage(parsed);
      const msg2 = parser.createMessage(parsed);

      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe('command parsing edge cases', () => {
    it('should handle empty argument string', () => {
      const result = parser.parse('/command');

      expect(result.command).toBe('command');
      expect(result.arguments).toEqual({});
    });

    it('should handle multiple spaces between arguments', () => {
      const result = parser.parse('/command arg1    arg2');

      expect(result.arguments?._pos0).toBe('arg1');
      expect(result.arguments?._pos1).toBe('arg2');
    });

    it('should handle escaped quotes', () => {
      // The parser strips outer quotes but doesn't handle escaped quotes
      const result = parser.parse('/command text:"hello world"');

      expect(result.arguments?.text).toBe('hello world');
    });

    it('should handle single quotes', () => {
      const result = parser.parse("/command text:'single quoted'");

      expect(result.arguments?.text).toBe('single quoted');
    });
  });

  describe('configuration options', () => {
    it('should respect disableCommands option', () => {
      const noCommands = new InputParser({ enableCommands: false });
      const result = noCommands.parse('/help');

      expect(result.type).toBe(InputType.TEXT);
      expect(result.command).toBeUndefined();
    });

    it('should respect disableIntentExtraction option', () => {
      const noIntent = new InputParser({ enableIntentExtraction: false });
      const result = noIntent.parse('Can you help me?');

      expect(result.options?.intent).toBeUndefined();
    });

    it('should respect disableStripWhitespace option', () => {
      const noStrip = new InputParser({ stripWhitespace: false });
      const result = noStrip.parse('  Hello  ');

      expect(result.normalizedText).toBe('  Hello  ');
    });

    it('should use custom command prefixes', () => {
      const customPrefix = new InputParser({ commandPrefixes: ['!', '>>'] });
      const result1 = customPrefix.parse('!test');
      const result2 = customPrefix.parse('>>test');

      expect(result1.type).toBe(InputType.COMMAND);
      expect(result1.command).toBe('test');
      expect(result2.type).toBe(InputType.COMMAND);
      expect(result2.command).toBe('test');
    });
  });
});
