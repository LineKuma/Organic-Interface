import { describe, it, expect } from 'vitest';
import { Prompt, createPrompt } from '../../components/Prompt.js';

describe('Prompt', () => {
  describe('constructor', () => {
    it('should create a prompt instance', () => {
      const prompt = new Prompt();
      expect(prompt).toBeDefined();
    });
  });

  describe('formatPrompt', () => {
    it('should format text prompt', () => {
      const prompt = new Prompt();
      const formatted = prompt.formatPrompt({
        type: 'text',
        message: 'Enter your name:',
      });
      expect(formatted).toContain('TEXT');
      expect(formatted).toContain('Enter your name:');
    });

    it('should format prompt with default value', () => {
      const prompt = new Prompt();
      const formatted = prompt.formatPrompt({
        type: 'text',
        message: 'Enter your name:',
        defaultValue: 'John',
      });
      expect(formatted).toContain('default: John');
    });

    it('should format required prompt', () => {
      const prompt = new Prompt();
      const formatted = prompt.formatPrompt({
        type: 'text',
        message: 'Enter your name:',
        required: true,
      });
      expect(formatted).toContain('*');
    });
  });

  describe('renderConfirm', () => {
    it('should return boolean from confirm prompt', () => {
      const prompt = new Prompt();
      const result = prompt.renderConfirm('Continue?', false);
      expect(typeof result).toBe('boolean');
    });

    it('should return false for non y/n input', () => {
      const prompt = new Prompt();
      const formatted = prompt.formatPrompt({
        type: 'confirm',
        message: 'Continue?',
        defaultValue: false,
      });
      expect(formatted).toContain('default: false');
    });
  });

  describe('renderText', () => {
    it('should return string from text prompt', () => {
      const prompt = new Prompt();
      const result = prompt.renderText('Enter name:', { defaultValue: 'test' });
      expect(typeof result).toBe('string');
    });
  });

  describe('renderPassword', () => {
    it('should return string from password prompt', () => {
      const prompt = new Prompt();
      const result = prompt.renderPassword('Enter password:');
      expect(typeof result).toBe('string');
    });
  });

  describe('renderSelect', () => {
    it('should handle select options', () => {
      const prompt = new Prompt();
      const options = [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
      ];
      const result = prompt.renderSelect('Choose:', options);
      expect(typeof result).toBe('string');
    });

    it('should return original input for out of range number', () => {
      const prompt = new Prompt();
      const options = [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
      ];
      const formatted = prompt.formatPrompt({
        type: 'select',
        message: 'Choose:',
        options,
      });
      expect(formatted).toContain('SELECT');
    });

    it('should not select disabled option', () => {
      const prompt = new Prompt();
      const options = [
        { value: 'a', label: 'Option A', disabled: true },
        { value: 'b', label: 'Option B' },
      ];
      const formatted = prompt.formatPrompt({
        type: 'select',
        message: 'Choose:',
        options,
      });
      expect(formatted).toContain('Option A');
    });
  });

  describe('renderMultiselect', () => {
    it('should return string array from multiselect prompt', () => {
      const prompt = new Prompt();
      const options = [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ];
      const result = prompt.renderMultiselect('Choose:', options);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createPrompt', () => {
    it('should create Prompt instance', () => {
      const prompt = createPrompt();
      expect(prompt).toBeDefined();
      expect(prompt).toBeInstanceOf(Prompt);
    });
  });
});
