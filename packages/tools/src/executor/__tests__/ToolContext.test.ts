import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolContext } from '../ToolContext.js';

vi.mock('@organic/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ToolContext', () => {
  let context: ToolContext;
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    context = new ToolContext({
      request_id: 'req-1',
      caller_plugin_id: 'plugin-1',
      caller_plugin_name: 'TestPlugin',
      timestamp: Date.now(),
      logger: mockLogger as any,
      verbose: false,
      working_directory: '/tmp',
    });
  });

  describe('constructor', () => {
    it('should create context with required options', () => {
      expect(context).toBeDefined();
    });

    it('should set default working directory', () => {
      const defaultContext = new ToolContext({
        request_id: 'req-1',
        caller_plugin_id: 'plugin-1',
        caller_plugin_name: 'TestPlugin',
        timestamp: Date.now(),
        logger: mockLogger as any,
      });
      expect(defaultContext).toBeDefined();
    });
  });

  describe('getContext', () => {
    it('should return execution context', () => {
      const execContext = context.getContext();
      expect(execContext.request_id).toBe('req-1');
      expect(execContext.caller_plugin_id).toBe('plugin-1');
    });
  });

  describe('getRequestId', () => {
    it('should return request ID', () => {
      expect(context.getRequestId()).toBe('req-1');
    });
  });

  describe('getCallerPluginId', () => {
    it('should return caller plugin ID', () => {
      expect(context.getCallerPluginId()).toBe('plugin-1');
    });
  });

  describe('getCallerPluginName', () => {
    it('should return caller plugin name', () => {
      expect(context.getCallerPluginName()).toBe('TestPlugin');
    });
  });

  describe('getTimestamp', () => {
    it('should return timestamp', () => {
      expect(context.getTimestamp()).toBeDefined();
    });
  });

  describe('getWorkingDirectory', () => {
    it('should return working directory', () => {
      expect(context.getWorkingDirectory()).toBe('/tmp');
    });
  });

  describe('isVerbose', () => {
    it('should return false by default', () => {
      expect(context.isVerbose()).toBe(false);
    });

    it('should return true when verbose mode enabled', () => {
      const verboseContext = new ToolContext({
        request_id: 'req-1',
        caller_plugin_id: 'plugin-1',
        caller_plugin_name: 'TestPlugin',
        timestamp: Date.now(),
        logger: mockLogger as any,
        verbose: true,
      });
      expect(verboseContext.isVerbose()).toBe(true);
    });
  });

  describe('setProgress', () => {
    it('should set progress', () => {
      context.setProgress(50);
      expect(context.getProgress()).toBe(50);
    });

    it('should clamp progress between 0 and 100', () => {
      context.setProgress(150);
      expect(context.getProgress()).toBe(100);

      context.setProgress(-10);
      expect(context.getProgress()).toBe(0);
    });

    it('should update status when provided', () => {
      context.setProgress(50, 'Processing');
      expect(context.getStatus()).toBe('Processing');
    });
  });

  describe('getProgress', () => {
    it('should return current progress', () => {
      context.setProgress(75);
      expect(context.getProgress()).toBe(75);
    });
  });

  describe('setStatus', () => {
    it('should set status message', () => {
      context.setStatus('Running');
      expect(context.getStatus()).toBe('Running');
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      context.setStatus('Testing');
      expect(context.getStatus()).toBe('Testing');
    });
  });

  describe('addIntermediateResult', () => {
    it('should add intermediate result', () => {
      context.addIntermediateResult({ key: 'value' });
      const results = context.getIntermediateResults();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'value' });
    });
  });

  describe('getIntermediateResults', () => {
    it('should return copy of results', () => {
      context.addIntermediateResult({ data: 1 });
      const results = context.getIntermediateResults();
      results.push({ data: 2 });
      const current = context.getIntermediateResults();
      expect(current).toHaveLength(1);
    });
  });

  describe('isCancelled', () => {
    it('should return false initially', () => {
      expect(context.isCancelled()).toBe(false);
    });

    it('should return true after cancel', () => {
      context.cancel();
      expect(context.isCancelled()).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should set cancelled flag and status', () => {
      context.cancel();
      expect(context.isCancelled()).toBe(true);
      expect(context.getStatus()).toBe('cancelled');
    });
  });

  describe('getElapsedTime', () => {
    it('should return elapsed time in ms', () => {
      const before = Date.now();
      context = new ToolContext({
        request_id: 'req-1',
        caller_plugin_id: 'plugin-1',
        caller_plugin_name: 'TestPlugin',
        timestamp: before,
        logger: mockLogger as any,
      });

      const elapsed = context.getElapsedTime();
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isTimeoutExceeded', () => {
    it('should return false when under timeout', () => {
      expect(context.isTimeoutExceeded(10000)).toBe(false);
    });

    it('should return true when over timeout', () => {
      const oldContext = new ToolContext({
        request_id: 'req-1',
        caller_plugin_id: 'plugin-1',
        caller_plugin_name: 'TestPlugin',
        timestamp: Date.now() - 20000,
        logger: mockLogger as any,
      });

      expect(oldContext.isTimeoutExceeded(10000)).toBe(true);
    });
  });

  describe('logging', () => {
    it('should log info message', () => {
      context.info('Test message');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log warning message', () => {
      context.warn('Warning message');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log error message', () => {
      context.error('Error message');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should only log debug in verbose mode', () => {
      context.debug('Debug message');
      expect(mockLogger.debug).not.toHaveBeenCalled();

      const verboseContext = new ToolContext({
        request_id: 'req-1',
        caller_plugin_id: 'plugin-1',
        caller_plugin_name: 'TestPlugin',
        timestamp: Date.now(),
        logger: mockLogger as any,
        verbose: true,
      });

      verboseContext.debug('Debug message');
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('custom data', () => {
    it('should store and retrieve custom data', () => {
      context.setData('key', 'value');
      expect(context.getData('key')).toBe('value');
    });

    it('should return undefined for non-existent key', () => {
      expect(context.getData('non-existent')).toBeUndefined();
    });

    it('should delete custom data', () => {
      context.setData('key', 'value');
      const result = context.deleteData('key');
      expect(result).toBe(true);
      expect(context.getData('key')).toBeUndefined();
    });

    it('should return all data keys', () => {
      context.setData('key1', 'value1');
      context.setData('key2', 'value2');
      const keys = context.getDataKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('createChildContext', () => {
    it('should create child context with inherited values', () => {
      const child = context.createChildContext({});
      expect(child.getRequestId()).toBe('req-1');
      expect(child.getCallerPluginId()).toBe('plugin-1');
    });

    it('should allow overriding options', () => {
      const child = context.createChildContext({
        request_id: 'child-req',
      });
      expect(child.getRequestId()).toBe('child-req');
    });
  });

  describe('clone', () => {
    it('should create cloned context', () => {
      context.setData('key', 'value');
      context.addIntermediateResult({ data: 1 });

      const cloned = context.clone();

      expect(cloned.getRequestId()).toBe('req-1');
      expect(cloned.getData('key')).toBe('value');
      expect(cloned.getIntermediateResults()).toHaveLength(1);
    });

    it('should not affect original when clone is modified', () => {
      context.setData('key', 'value');
      const cloned = context.clone();
      cloned.setData('key', 'modified');

      expect(context.getData('key')).toBe('value');
      expect(cloned.getData('key')).toBe('modified');
    });
  });
});
