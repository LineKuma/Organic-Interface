import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kernel, LifecycleState, type KernelConfig } from '@organic/kernel';
import { Progress, createProgress, type ProgressStyle } from '@organic/ui';
import { Table, createTable, type TableColumn, type TableConfig } from '@organic/ui';
import { Prompt, createPrompt } from '@organic/ui';

describe('UI Components', () => {
  let kernel: Kernel;

  beforeEach(async () => {
    const config: KernelConfig = {
      name: 'test-kernel',
      version: '1.0.0',
    };
    kernel = new Kernel({ config });
    await kernel.initialize();
  });

  afterEach(async () => {
    if (kernel.getStatus().state !== LifecycleState.STOPPED) {
      await kernel.stop();
    }
  });

  describe('Progress Component', () => {
    it('should create progress with default config', async () => {
      const progress = createProgress({ total: 100 });

      expect(progress).toBeDefined();
      expect(progress.getState().total).toBe(100);
    });

    it('should update progress state', async () => {
      const progress = createProgress({ total: 100, current: 0 });

      progress.start();
      const state = progress.update(50);

      expect(state.current).toBe(50);
      expect(state.percentage).toBe(50);
    });

    it('should complete progress at 100%', async () => {
      const progress = createProgress({ total: 100 });

      progress.start();
      progress.update(100);

      const state = progress.getState();
      expect(state.completed).toBe(true);
      expect(state.percentage).toBe(100);
    });

    it('should increment progress', async () => {
      const progress = createProgress({ total: 100, current: 0 });

      progress.start();
      progress.increment(25);

      expect(progress.getState().current).toBe(25);
    });

    it('should show elapsed time', async () => {
      const progress = createProgress({ total: 100, showElapsed: true });

      progress.start();
      progress.update(50);

      const state = progress.getState();
      expect(state.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle different styles', async () => {
      const styles: ProgressStyle[] = ['bar', 'spinner', 'dots', 'percentage'];

      for (const style of styles) {
        const progress = createProgress({ total: 100, style });
        progress.start();
        progress.update(50);
        progress.stop();

        const state = progress.getState();
        expect(state.current).toBe(50);
      }
    });

    it('should track remaining time estimate', async () => {
      const progress = createProgress({ total: 100 });

      progress.start();
      progress.update(25);

      const state = progress.getState();
      expect(state.remaining).toBeDefined();
    });

    it('should stop progress', async () => {
      const progress = createProgress({ total: 100 });

      progress.start();
      progress.update(50);
      progress.stop();

      const state = progress.getState();
      expect(state.current).toBe(50);
    });
  });

  describe('Table Component', () => {
    it('should create table with default config', async () => {
      const table = createTable({
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'value', header: 'Value' },
        ],
      });

      expect(table).toBeDefined();
    });

    it('should render table with data', async () => {
      const table = createTable({
        columns: [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
        ],
        data: [
          { id: '1', name: 'First' },
          { id: '2', name: 'Second' },
        ],
      });

      expect(table).toBeDefined();
      const state = table.getState();
      expect(state.data.length).toBe(2);
    });

    it('should sort table by column', async () => {
      const table = createTable({
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'value', header: 'Value' },
        ],
        data: [
          { name: 'Beta', value: '2' },
          { name: 'Alpha', value: '1' },
        ],
      });

      table.sort('name', 'asc');
      const sorted = table.getState().data;
      expect(sorted[0].name).toBe('Alpha');
    });

    it('should paginate table data', async () => {
      const table = createTable({
        columns: [
          { key: 'id', header: 'ID' },
        ],
        data: Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1) })),
      });

      table.setPageSize(10);
      const state = table.getState();
      expect(state.data.length).toBe(10);
      expect(state.currentPage).toBe(1);
    });

    it('should handle table with custom formatter', async () => {
      const table = createTable({
        columns: [
          { key: 'value', header: 'Value', format: (v) => `$${v}` },
        ],
        data: [{ value: 100 }],
      });

      expect(table).toBeDefined();
      const rendered = table.render();
      expect(rendered).toContain('$100');
    });

    it('should toggle table header visibility', async () => {
      const table = createTable({
        columns: [{ key: 'col1', header: 'Column 1' }],
        showHeader: true,
      });

      expect(table.getState().showHeader).toBe(true);

      table.setShowHeader(false);
      expect(table.getState().showHeader).toBe(false);
    });

    it('should handle empty table', async () => {
      const table = createTable({
        columns: [{ key: 'name', header: 'Name' }],
        data: [],
      });

      expect(table).toBeDefined();
      const state = table.getState();
      expect(state.data.length).toBe(0);
    });
  });

  describe('Prompt Component', () => {
    it('should create prompt with default config', async () => {
      const prompt = createPrompt({});

      expect(prompt).toBeDefined();
    });

    it('should render confirm prompt', async () => {
      const prompt = createPrompt({});
      const result = prompt.renderConfirm('Continue?');

      expect(result).toBeDefined();
    });

    it('should render text prompt', async () => {
      const prompt = createPrompt({});
      const result = prompt.renderText('Enter name:', 'test-user');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should manage prompt state', async () => {
      const prompt = createPrompt({});

      prompt.setDefaultValue('default-value');
      const state = prompt.getState();

      expect(state).toBeDefined();
    });

    it('should handle select prompt options', async () => {
      const prompt = createPrompt({});
      const options = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ];

      const result = prompt.renderSelect('Choose:', options);
      expect(result).toBeDefined();
    });

    it('should render password prompt', async () => {
      const prompt = createPrompt({});
      const result = prompt.renderPassword('Enter password:');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle multiselect prompt', async () => {
      const prompt = createPrompt({});
      const options = [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ];

      const result = prompt.renderMultiselect('Select:', options);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle prompt cancellation', async () => {
      const prompt = createPrompt({});
      const result = prompt.renderText('Enter value:', '');

      expect(result).toBeDefined();
    });
  });
});