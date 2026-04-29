import { describe, it, expect } from 'vitest';
import { Prompt } from '../../components/Prompt.js';

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
  });

  describe('renderText', () => {
    it('should return string from text prompt', () => {
      const prompt = new Prompt();
      const result = prompt.renderText('Enter name:', { defaultValue: 'test' });
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
  });
});
