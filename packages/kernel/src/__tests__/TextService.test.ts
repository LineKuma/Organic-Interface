/**
 * TextService Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TextService } from '../services/TextService.js';
import type { TextServiceConfig } from '../services/TextService.js';

describe('TextService', () => {
  let textService: TextService;
  let stdoutWriteSpy: any;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // Default: enable color, TTY enabled
    // isTTY is a getter - use Object.defineProperty for reliable mocking
    Object.defineProperty(process.stdout, 'isTTY', {
      get: () => true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== Constructor ====================

  describe('Constructor', () => {
    it('should create with default config', () => {
      const svc = new TextService();
      expect(svc).toBeInstanceOf(TextService);
    });

    it('should disable color when enableColor is false', () => {
      const svc = new TextService({ enableColor: false });
      const result = svc.styled('hello', { color: 'red' });
      // Color disabled → no ANSI codes
      expect(result).toBe('hello');
    });

    it('should enable timestamp when configured', () => {
      const svc = new TextService({ enableTimestamp: true });
      svc.print('test');
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it('should set default indent', () => {
      const svc = new TextService({ defaultIndent: 4 });
      svc.print('test');
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('    test');
    });

    it('should set custom default table options', () => {
      const svc = new TextService({
        defaultTableOptions: { borders: false, align: 'center' },
      });
      const result = svc.formatTable(
        { headers: ['A', 'B'], rows: [['1', '2']] }
      );
      // No borders means no box-drawing chars
      expect(result).not.toContain('┌');
      expect(result).not.toContain('│');
    });

    it('should detect TTY when detectTerminal is true (default)', () => {
      const svc = new TextService();
      const styled = svc.styled('hello', { color: 'red' });
      expect(styled).not.toBe('hello'); // Should have ANSI codes
      expect(styled).toContain('\x1b[');
    });

    it('should respect detectTerminal: false', () => {
      const svc = new TextService({ detectTerminal: false });
      const styled = svc.styled('hello', { color: 'red' });
      expect(styled).toBe('hello');
    });
  });

  // ==================== print() ====================

  describe('print()', () => {
    it('should print plain text', () => {
      textService = new TextService({ enableTimestamp: false });
      textService.print('hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('hello');
    });

    it('should include prefix', () => {
      textService = new TextService({ enableTimestamp: false });
      textService.print('hello', { prefix: '[INFO]' });
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[INFO]');
      expect(output).toContain('hello');
    });

    it('should include suffix', () => {
      textService = new TextService({ enableTimestamp: false });
      textService.print('hello', { suffix: 'END' });
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain(' END');
    });

    it('should apply indentation', () => {
      textService = new TextService({ enableTimestamp: false, defaultIndent: 0 });
      textService.print('hello', { indent: 2 });
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      // print() joins parts with a space: ' '.repeat(2) + ' ' + 'hello' = '   hello'
      expect(output).toBe('   hello');
    });

    it('should include timestamp when enabled', () => {
      textService = new TextService({ enableTimestamp: false });
      textService.print('hello', { timestamp: true });
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      expect(output).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should append newline when newline is true', () => {
      textService = new TextService({ enableTimestamp: false });
      textService.print('hello', { newline: true });
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      expect(output).toBe('hello\n');
    });

    it('should use default indent when no indent option provided', () => {
      textService = new TextService({ defaultIndent: 4, enableTimestamp: false });
      textService.print('hello');
      const output = stdoutWriteSpy.mock.calls[0]?.[0] as string;
      // print() joins parts with a space: ' '.repeat(4) + ' ' + 'hello' = '     hello'
      expect(output).toBe('     hello');
    });
  });

  // ==================== println() ====================

  describe('println()', () => {
    it('should print text with newline', () => {
      textService = new TextService();
      textService.println('hello world');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('hello world\n');
    });

    it('should print empty line when no argument', () => {
      textService = new TextService();
      textService.println();
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });

    it('should print empty string', () => {
      textService = new TextService();
      textService.println('');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });
  });

  // ==================== formatTable() ====================

  describe('formatTable()', () => {
    const tableData = {
      headers: ['Name', 'Value'],
      rows: [['foo', 'bar'], ['hello', 'world']],
    };

    it('should format a table with borders by default', () => {
      textService = new TextService();
      const result = textService.formatTable(tableData);
      expect(result).toContain('┌');
      expect(result).toContain('│');
      expect(result).toContain('└');
      expect(result).toContain('Name');
      expect(result).toContain('Value');
    });

    it('should format a table without borders', () => {
      textService = new TextService();
      const result = textService.formatTable(tableData, { borders: false });
      expect(result).not.toContain('┌');
      expect(result).not.toContain('│');
      expect(result).toContain('Name');
      expect(result).toContain('Value');
    });

    it('should align text right', () => {
      textService = new TextService();
      const result = textService.formatTable(tableData, { align: 'right', borders: false });
      // Right-aligned "foo" should start with spaces
      const lines = result.split('\n');
      const dataLine = lines[1]; // first data row
      expect(dataLine).toMatch(/^\s+foo/);
    });

    it('should align text center', () => {
      textService = new TextService();
      const result = textService.formatTable(
        { headers: ['X'], rows: [['a']] },
        { align: 'center', borders: false }
      );
      // The single cell "a" should be centered with padding
      expect(result).toBe('X\na');
    });

    it('should use custom column widths', () => {
      textService = new TextService();
      const result = textService.formatTable(tableData, {
        columnWidths: [10, 10],
        borders: false,
      });
      const lines = result.split('\n');
      // Header should have padded columns of width 10
      expect(lines[0].match(/.{10}/)).toBeTruthy();
    });

    it('should use maxWidth for column calculation', () => {
      textService = new TextService({
        defaultTableOptions: { maxWidth: 40 },
      });
      const result = textService.formatTable(tableData);
      expect(result).toContain('Name');
    });

    it('should handle empty rows', () => {
      textService = new TextService();
      const result = textService.formatTable({ headers: [], rows: [] });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  // ==================== formatList() ====================

  describe('formatList()', () => {
    it('should format a bullet list', () => {
      textService = new TextService();
      const result = textService.formatList(['item1', 'item2', 'item3']);
      expect(result).toBe('• item1\n• item2\n• item3');
    });

    it('should format a numbered list', () => {
      textService = new TextService();
      const result = textService.formatList(['first', 'second'], { numbered: true });
      expect(result).toBe('1. first\n2. second');
    });

    it('should start numbered list from custom number', () => {
      textService = new TextService();
      const result = textService.formatList(['third', 'fourth'], {
        numbered: true,
        startNumber: 3,
      });
      expect(result).toBe('3. third\n4. fourth');
    });

    it('should apply indentation', () => {
      textService = new TextService();
      const result = textService.formatList(['item'], { indent: 4 });
      expect(result).toBe('    • item');
    });

    it('should use custom bullet character', () => {
      textService = new TextService();
      const result = textService.formatList(['item'], { bullet: '→' });
      expect(result).toBe('→ item');
    });

    it('should handle empty items array', () => {
      textService = new TextService();
      const result = textService.formatList([]);
      expect(result).toBe('');
    });
  });

  // ==================== formatSection() ====================

  describe('formatSection()', () => {
    it('should format a section with borders by default', () => {
      textService = new TextService();
      const result = textService.formatSection('Title', 'Content here');
      expect(result).toContain('══');
      expect(result).toContain('Title');
      expect(result).toContain('Content');
    });

    it('should format a section without borders', () => {
      textService = new TextService();
      const result = textService.formatSection('Title', 'Content', { border: false });
      expect(result).not.toContain('══');
      expect(result).toContain('Title');
    });
  });

  // ==================== styled() ====================

  describe('styled()', () => {
    beforeEach(() => {
      textService = new TextService({ enableColor: true });
    });

    it('should apply text color', () => {
      const result = textService.styled('hello', { color: 'red' });
      expect(result).toContain('\x1b[31m'); // red
      expect(result).toContain('hello');
      expect(result).toContain('\x1b[0m'); // reset
    });

    it('should apply bold style', () => {
      const result = textService.styled('hello', { bold: true });
      expect(result).toContain('\x1b[1m');
    });

    it('should apply dim style', () => {
      const result = textService.styled('hello', { dim: true });
      expect(result).toContain('\x1b[2m');
    });

    it('should apply underline style', () => {
      const result = textService.styled('hello', { underline: true });
      expect(result).toContain('\x1b[4m');
    });

    it('should apply multiple styles', () => {
      const result = textService.styled('hello', {
        color: 'blue',
        bold: true,
        underline: true,
      });
      expect(result).toContain('\x1b[34m');
      expect(result).toContain('\x1b[1m');
      expect(result).toContain('\x1b[4m');
    });

    it('should apply background color', () => {
      const result = textService.styled('hello', { background: 'blue' });
      expect(result).toContain('\x1b[44m');
    });

    it('should not apply color when TTY is disabled', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        get: () => false,
        configurable: true,
      });
      const svc = new TextService({ enableColor: true });
      const result = svc.styled('hello', { color: 'red' });
      expect(result).toBe('hello');
    });

    it('should return plain text when color is disabled', () => {
      const svc = new TextService({ enableColor: false });
      const result = svc.styled('hello', { color: 'red' });
      expect(result).toBe('hello');
    });
  });

  // ==================== success/error/warning/info ====================

  describe('Shortcut methods', () => {
    beforeEach(() => {
      textService = new TextService({ enableColor: true });
    });

    it('should format success message in green bold', () => {
      const result = textService.success('Done');
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('\x1b[1m');
      expect(result).toContain('Done');
    });

    it('should format error message in red bold', () => {
      const result = textService.error('Failed');
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('\x1b[1m');
      expect(result).toContain('Failed');
    });

    it('should format warning message in yellow bold', () => {
      const result = textService.warning('Careful');
      expect(result).toContain('\x1b[33m');
      expect(result).toContain('\x1b[1m');
      expect(result).toContain('Careful');
    });

    it('should format info message in cyan', () => {
      const result = textService.info('Notice');
      expect(result).toContain('\x1b[36m');
      expect(result).toContain('Notice');
      expect(result).not.toContain('\x1b[1m'); // info is not bold
    });
  });

  // ==================== createStream() ====================

  describe('createStream()', () => {
    it('should write chunks to stdout', () => {
      textService = new TextService();
      const stream = textService.createStream();
      stream.write('hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('hello');
    });

    it('should write line with newline', () => {
      textService = new TextService();
      const stream = textService.createStream();
      stream.writeln('hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('hello\n');
    });

    it('should write empty line with writeln()', () => {
      textService = new TextService();
      const stream = textService.createStream();
      stream.writeln();
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });

    it('should include prefix in write', () => {
      textService = new TextService();
      const stream = textService.createStream({ prefix: '> ' });
      stream.write('hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('> hello');
    });

    it('should include prefix in writeln', () => {
      textService = new TextService();
      const stream = textService.createStream({ prefix: '> ' });
      stream.writeln('hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('> hello\n');
    });

    it('should not write after end()', () => {
      textService = new TextService();
      const stream = textService.createStream();
      stream.end();
      stream.write('should not appear');
      // end() clears buffer (empty) then newline, so only newline was written
      const calls = stdoutWriteSpy.mock.calls;
      // There should be no calls with 'should not appear'
      const hasWrite = calls.some((call: unknown[]) => {
        const arg = call[0] as string;
        return arg.includes('should not appear');
      });
      expect(hasWrite).toBe(false);
    });

    it('should flush buffer when flush() is called', () => {
      textService = new TextService();
      const stream = textService.createStream();
      // flush writes buffer only if non-empty; buffer starts empty
      stream.flush();
      // No error expected
    });
  });

  // ==================== progress() ====================

  describe('progress()', () => {
    it('should generate a progress bar', () => {
      textService = new TextService();
      const result = textService.progress(50, 100, 'Processing');
      expect(result).toContain('[');
      expect(result).toContain('█');
      expect(result).toContain('░');
      expect(result).toContain('50%');
      expect(result).toContain('50/100');
      expect(result).toContain('Processing');
    });

    it('should show 0% progress', () => {
      textService = new TextService();
      const result = textService.progress(0, 100);
      expect(result).toContain('0%');
      expect(result).toContain('0/100');
      expect(result).not.toContain('█');
    });

    it('should show 100% progress', () => {
      textService = new TextService();
      const result = textService.progress(100, 100);
      expect(result).toContain('100%');
      expect(result).toContain('100/100');
    });

    it('should handle zero total', () => {
      textService = new TextService();
      const result = textService.progress(0, 0);
      expect(result).toContain('0%');
    });

    it('should hide percent when showPercent is false', () => {
      textService = new TextService();
      const result = textService.progress(50, 100, '', { showPercent: false });
      expect(result).not.toContain('%');
      expect(result).toContain('50/100');
    });

    it('should use custom width', () => {
      textService = new TextService();
      const result = textService.progress(10, 100, '', { width: 20 });
      expect(result).toContain('10%');
    });

    it('should cap at 100% when current exceeds total', () => {
      textService = new TextService();
      const result = textService.progress(200, 100);
      expect(result).toContain('100%');
    });
  });

  // ==================== spinner() ====================

  describe('spinner()', () => {
    beforeEach(() => {
      textService = new TextService({ enableColor: false });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create a spinner controller', () => {
      const spinner = textService.spinner('dots');
      expect(spinner).toBeDefined();
      expect(typeof spinner.start).toBe('function');
      expect(typeof spinner.stop).toBe('function');
      expect(typeof spinner.success).toBe('function');
      expect(typeof spinner.error).toBe('function');
      expect(typeof spinner.stopWithMessage).toBe('function');
    });

    it('should render frames when started', () => {
      const spinner = textService.spinner('dots');
      spinner.start('Loading');
      // First call is clearLine, second is the actual frame render
      expect(stdoutWriteSpy).toHaveBeenCalled();
      const secondCall = stdoutWriteSpy.mock.calls[1]?.[0] as string;
      // Should contain the loading message
      expect(secondCall).toContain('Loading');
    });

    it('should advance frames on interval', () => {
      const spinner = textService.spinner('dots');
      spinner.start('Loading');
      const callCountBefore = stdoutWriteSpy.mock.calls.length;

      vi.advanceTimersByTime(200); // 2 intervals of 100ms
      expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    it('should not start if already running', () => {
      const spinner = textService.spinner('dots');
      spinner.start('Loading');
      const callCount = stdoutWriteSpy.mock.calls.length;
      spinner.start('Other');
      // Should not have additional render calls from second start()
      expect(stdoutWriteSpy.mock.calls.length).toBe(callCount);
    });

    it('should stop the spinner', () => {
      const spinner = textService.spinner('dots');
      spinner.start('Loading');
      spinner.stop();
      // After stop, no more rendering
      const callCount = stdoutWriteSpy.mock.calls.length;
      vi.advanceTimersByTime(200);
      expect(stdoutWriteSpy.mock.calls.length).toBe(callCount);
    });

    it('should not stop if not running', () => {
      const spinner = textService.spinner('dots');
      // Should not throw
      expect(() => spinner.stop()).not.toThrow();
    });

    it('should stop with success message', () => {
      // Use color-enabled for styled output
      const svc = new TextService({ enableColor: true });
      const spinner = svc.spinner('dots');
      spinner.start('Loading');
      spinner.success('Completed');
      const successCall = stdoutWriteSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('Completed')
      );
      expect(successCall).toBeDefined();
    });

    it('should stop with error message', () => {
      const svc = new TextService({ enableColor: true });
      const spinner = svc.spinner('dots');
      spinner.start('Loading');
      spinner.error('Crashed');
      const errorCall = stdoutWriteSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('Crashed')
      );
      expect(errorCall).toBeDefined();
    });

    it('should stop with custom message and type', () => {
      const svc = new TextService({ enableColor: true });
      const spinner = svc.spinner('dots');
      spinner.start('Loading');
      spinner.stopWithMessage('Warning text', 'warning');

      const warningCall = stdoutWriteSpy.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('Warning text')
      );
      expect(warningCall).toBeDefined();
    });

    it('should support different spinner types', () => {
      const types = ['dots', 'line', 'pipe', 'moon', 'ball', 'arrow'] as const;
      for (const type of types) {
        const spinner = textService.spinner(type);
        expect(spinner).toBeDefined();
      }
    });

    it('should use default types when none specified', () => {
      const spinner = textService.spinner();
      expect(spinner).toBeDefined();
    });
  });
});