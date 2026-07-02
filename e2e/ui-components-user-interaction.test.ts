/**
 * E2E: 用户使用 UI 组件完成日常任务
 *
 * 模拟用户在使用 Organic Interface 时与 UI 组件交互的完整流程：
 * 1. 用户查看进度条（任务执行过程中的进度展示）
 * 2. 用户浏览和操作数据表格（查看、排序、筛选、添加/删除数据）
 * 3. 用户与交互式提示交互（文本输入、确认、选择、多选、验证）
 *
 * 所有测试从用户视角出发，模拟真实使用场景。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Prompt,
  Progress,
  Table,
  createPrompt,
  createProgress,
  createTable,
  showProgress,
  renderTable,
  type PromptConfig,
  type ProgressConfig,
  type ProgressState,
  type ProgressStyle,
  type TableColumn,
  type TableSortConfig,
  type SelectOption,
} from '@organic/ui';

// ── 用户场景：使用进度条追踪任务 ──────────────────────────────────

describe('用户使用 UI 组件完成日常任务', () => {
  describe('场景一：用户使用进度条追踪任务进度', () => {
    it('用户看到进度条从 0% 开始', () => {
      const progress = new Progress({ total: 100, label: '下载文件' });
      const state = progress.getState();

      expect(state.current).toBe(0);
      expect(state.total).toBe(100);
      expect(state.percentage).toBe(0);
      expect(state.completed).toBe(false);
    });

    it('用户看到进度条更新到 50%', () => {
      const progress = new Progress({ total: 100, label: '处理数据' });
      const state = progress.update(50);

      expect(state.current).toBe(50);
      expect(state.percentage).toBe(50);
      expect(state.completed).toBe(false);
    });

    it('用户看到进度条到达 100% 完成', () => {
      const progress = new Progress({ total: 100, label: '安装依赖' });
      const state = progress.update(100);

      expect(state.current).toBe(100);
      expect(state.percentage).toBe(100);
      expect(state.completed).toBe(true);
      expect(state.endTime).toBeDefined();
    });

    it('用户逐次递增进度（模拟步骤进度）', () => {
      const progress = new Progress({ total: 5, label: '部署步骤' });

      let state = progress.increment(); // 1/5
      expect(state.current).toBe(1);
      expect(state.percentage).toBe(20);

      state = progress.increment(); // 2/5
      expect(state.current).toBe(2);
      expect(state.percentage).toBe(40);

      state = progress.increment(2); // 4/5
      expect(state.current).toBe(4);
      expect(state.percentage).toBe(80);

      state = progress.increment(); // 5/5 完成
      expect(state.current).toBe(5);
      expect(state.percentage).toBe(100);
      expect(state.completed).toBe(true);
    });

    it('用户看到进度条不会超过总数', () => {
      const progress = new Progress({ total: 100 });
      const state = progress.update(150);

      expect(state.current).toBeLessThanOrEqual(state.total);
      expect(state.current).toBe(100);
    });

    it('用户看到进度条显示预计剩余时间', () => {
      const progress = new Progress({ total: 100, label: '上传文件' });
      const state = progress.update(50);

      expect(state.remaining).toBeDefined();
      expect(state.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('用户使用不同风格的进度条', () => {
      const styles: ProgressStyle[] = ['bar', 'spinner', 'dots', 'percentage'];

      for (const style of styles) {
        const progress = new Progress({ total: 100, label: '任务', style });
        const state = progress.update(50);
        expect(state.percentage).toBe(50);
      }
    });

    it('用户使用工厂函数创建进度条', () => {
      const progress = createProgress({ total: 200, label: '构建', style: 'bar' });
      const state = progress.getState();

      expect(state.total).toBe(200);
      expect(state.current).toBe(0);
    });

    it('用户使用 showProgress 辅助函数快速显示进度', () => {
      // showProgress 应该不抛出异常
      expect(() => showProgress('快速任务', 3, 10, 'bar')).not.toThrow();
    });

    it('用户显式调用 complete 完成进度', () => {
      const progress = new Progress({ total: 100, label: '任务' });
      progress.update(30);
      progress.complete();

      const state = progress.getState();
      expect(state.completed).toBe(true);
      expect(state.current).toBe(100);
      expect(state.percentage).toBe(100);
    });

    it('用户停止进度条', () => {
      const progress = new Progress({ total: 100, label: '任务', style: 'spinner' });
      progress.start();
      progress.stop();
      // 不抛出异常即可
      expect(progress.getState()).toBeDefined();
    });
  });

  // ── 用户场景：使用数据表格 ──────────────────────────────────────

  describe('场景二：用户使用数据表格浏览和操作数据', () => {
    interface User {
      id: number;
      name: string;
      email: string;
      role: string;
      [key: string]: unknown;
    }

    const userColumns: TableColumn<User>[] = [
      { key: 'id', header: 'ID', width: 5 },
      { key: 'name', header: '姓名', width: 15 },
      { key: 'email', header: '邮箱', width: 30 },
      { key: 'role', header: '角色', width: 12 },
    ];

    it('用户创建空表格并查看', () => {
      const table = new Table<User>(userColumns, { title: '用户列表' });
      const output = table.render();

      expect(output).toContain('用户列表');
      expect(output).toContain('(No data)');
    });

    it('用户添加一行数据后表格显示该行', () => {
      const table = new Table<User>(userColumns);
      table.addRow({ id: 1, name: '张三', email: 'zhangsan@example.com', role: '管理员' });

      const output = table.render();
      expect(output).toContain('张三');
      expect(output).toContain('zhangsan@example.com');
      expect(output).toContain('管理员');
    });

    it('用户批量添加多行数据', () => {
      const table = new Table<User>(userColumns);
      table.addRows([
        { id: 1, name: '张三', email: 'zhangsan@example.com', role: '管理员' },
        { id: 2, name: '李四', email: 'lisi@example.com', role: '编辑' },
        { id: 3, name: '王五', email: 'wangwu@example.com', role: '访客' },
      ]);

      expect(table.rowCount).toBe(3);
      const output = table.render();
      expect(output).toContain('张三');
      expect(output).toContain('李四');
      expect(output).toContain('王五');
    });

    it('用户按姓名排序表格', () => {
      const table = new Table<User>(userColumns);
      table.addRows([
        { id: 1, name: 'Charlie', email: 'c@test.com', role: '编辑' },
        { id: 2, name: 'Alice', email: 'a@test.com', role: '管理员' },
        { id: 3, name: 'Bob', email: 'b@test.com', role: '访客' },
      ]);

      table.sort('name', 'asc');
      const output = table.render();

      // 确认排序配置
      const sortConfig = table.getSortConfig();
      expect(sortConfig).toBeDefined();
      expect(sortConfig!.column).toBe('name');
      expect(sortConfig!.direction).toBe('asc');
    });

    it('用户按 ID 降序排序表格', () => {
      const table = new Table<User>(userColumns);
      table.addRows([
        { id: 1, name: 'Alice', email: 'a@test.com', role: '管理员' },
        { id: 3, name: 'Bob', email: 'b@test.com', role: '访客' },
        { id: 2, name: 'Charlie', email: 'c@test.com', role: '编辑' },
      ]);

      table.sort('id', 'desc');
      const sortConfig = table.getSortConfig();
      expect(sortConfig!.direction).toBe('desc');
    });

    it('用户筛选表格数据', () => {
      const table = new Table<User>(userColumns);
      table.addRows([
        { id: 1, name: 'Alice', email: 'a@test.com', role: '管理员' },
        { id: 2, name: 'Bob', email: 'b@test.com', role: '编辑' },
        { id: 3, name: 'Charlie', email: 'c@test.com', role: '管理员' },
      ]);

      table.filter(row => row.role === '管理员');
      expect(table.rowCount).toBe(2);
    });

    it('用户替换表格所有数据', () => {
      const table = new Table<User>(userColumns);
      table.addRows([
        { id: 1, name: 'Old', email: 'old@test.com', role: '访客' },
      ]);

      table.setRows([
        { id: 2, name: 'New1', email: 'n1@test.com', role: '管理员' },
        { id: 3, name: 'New2', email: 'n2@test.com', role: '编辑' },
      ]);

      expect(table.rowCount).toBe(2);
    });

    it('用户清空表格', () => {
      const table = new Table<User>(userColumns);
      table.addRows([
        { id: 1, name: 'Test', email: 'test@test.com', role: '访客' },
      ]);

      table.clear();
      expect(table.rowCount).toBe(0);
    });

    it('用户查看表格列数', () => {
      const table = new Table<User>(userColumns);
      expect(table.columnCount).toBe(4);
    });

    it('用户使用无边框表格', () => {
      const table = new Table<User>(userColumns, { border: false });
      table.addRow({ id: 1, name: 'Test', email: 't@test.com', role: '访客' });

      const output = table.render();
      expect(output).toContain('Test');
    });

    it('用户使用自定义列格式化', () => {
      const columns: TableColumn<User>[] = [
        { key: 'id', header: 'ID' },
        {
          key: 'name',
          header: '姓名',
          format: (value: unknown) => `[${value}]`,
        },
      ];

      const table = new Table<User>(columns);
      table.addRow({ id: 1, name: 'Alice', email: 'a@test.com', role: '访客' });

      const output = table.render();
      expect(output).toContain('[Alice]');
    });

    it('用户使用 renderTable 辅助函数快速渲染', () => {
      const data = [
        { id: 1, name: 'Alice', email: 'a@test.com', role: '管理员' },
        { id: 2, name: 'Bob', email: 'b@test.com', role: '编辑' },
      ];

      const output = renderTable(data, ['id', 'name', 'role']);
      expect(output).toContain('Alice');
      expect(output).toContain('Bob');
    });

    it('用户使用 createTable 工厂函数创建表格', () => {
      const table = createTable<User>(userColumns, { title: '工厂创建' });
      table.addRow({ id: 1, name: 'Test', email: 't@test.com', role: '访客' });

      const output = table.render();
      expect(output).toContain('工厂创建');
      expect(output).toContain('Test');
    });
  });

  // ── 用户场景：使用交互式提示 ────────────────────────────────────

  describe('场景三：用户使用交互式提示组件', () => {
    let prompt: Prompt;

    beforeEach(() => {
      prompt = new Prompt();
    });

    it('用户格式化文本输入提示', () => {
      const formatted = prompt.formatPrompt({
        type: 'text',
        message: '请输入您的姓名：',
      });

      expect(formatted).toContain('TEXT');
      expect(formatted).toContain('请输入您的姓名：');
    });

    it('用户格式化带默认值的提示', () => {
      const formatted = prompt.formatPrompt({
        type: 'text',
        message: '请输入姓名：',
        defaultValue: '张三',
      });

      expect(formatted).toContain('default: 张三');
    });

    it('用户格式化必填字段提示', () => {
      const formatted = prompt.formatPrompt({
        type: 'text',
        message: '请输入邮箱：',
        required: true,
      });

      expect(formatted).toContain('*');
    });

    it('用户格式化密码输入提示', () => {
      const formatted = prompt.formatPrompt({
        type: 'password',
        message: '请输入密码：',
      });

      expect(formatted).toContain('PASSWORD');
      expect(formatted).toContain('请输入密码：');
    });

    it('用户格式化确认提示', () => {
      const formatted = prompt.formatPrompt({
        type: 'confirm',
        message: '确认删除？',
        defaultValue: false,
      });

      expect(formatted).toContain('CONFIRM');
      expect(formatted).toContain('确认删除？');
    });

    it('用户格式化单选提示', () => {
      const options: SelectOption[] = [
        { value: 'zh', label: '中文' },
        { value: 'en', label: 'English' },
        { value: 'ja', label: '日本語' },
      ];

      const formatted = prompt.formatPrompt({
        type: 'select',
        message: '选择语言：',
        options,
      });

      expect(formatted).toContain('SELECT');
      expect(formatted).toContain('选择语言：');
      expect(formatted).toContain('中文');
      expect(formatted).toContain('English');
      expect(formatted).toContain('日本語');
    });

    it('用户格式化多选提示', () => {
      const options: SelectOption[] = [
        { value: 'read', label: '读取' },
        { value: 'write', label: '写入' },
        { value: 'delete', label: '删除' },
      ];

      const formatted = prompt.formatPrompt({
        type: 'multiselect',
        message: '选择权限：',
        options,
      });

      expect(formatted).toContain('MULTISELECT');
      expect(formatted).toContain('选择权限：');
      expect(formatted).toContain('读取');
      expect(formatted).toContain('写入');
      expect(formatted).toContain('删除');
    });

    it('用户格式化多选提示带默认值', () => {
      const options: SelectOption[] = [
        { value: 'read', label: '读取' },
        { value: 'write', label: '写入' },
        { value: 'delete', label: '删除' },
      ];

      const formatted = prompt.formatPrompt({
        type: 'multiselect',
        message: '选择权限：',
        options,
        defaultValue: ['read'],
      });

      expect(formatted).toContain('default: read');
    });

    it('用户格式化包含禁用选项的提示', () => {
      const options: SelectOption[] = [
        { value: 'admin', label: '管理员' },
        { value: 'root', label: '超级管理员', disabled: true },
      ];

      const formatted = prompt.formatPrompt({
        type: 'select',
        message: '选择角色：',
        options,
      });

      expect(formatted).toContain('disabled');
    });

    it('用户使用同步确认方法', () => {
      const result = prompt.renderConfirm('继续操作？', true);
      expect(typeof result).toBe('boolean');
    });

    it('用户使用同步选择方法', () => {
      const options: SelectOption[] = [
        { value: 'light', label: '浅色主题' },
        { value: 'dark', label: '深色主题' },
      ];

      const result = prompt.renderSelect('选择主题：', options);
      expect(typeof result).toBe('string');
    });

    it('用户使用同步多选方法', () => {
      const options: SelectOption[] = [
        { value: 'email', label: '邮件通知' },
        { value: 'sms', label: '短信通知' },
        { value: 'push', label: '推送通知' },
      ];

      const result = prompt.renderMultiselect('选择通知方式：', options);
      expect(Array.isArray(result)).toBe(true);
    });

    it('用户使用同步文本输入方法', () => {
      const result = prompt.renderText('输入名称：', {
        defaultValue: '默认名称',
        required: true,
      });

      expect(typeof result).toBe('string');
    });

    it('用户使用同步密码输入方法', () => {
      const result = prompt.renderPassword('输入密码：', { required: true });
      expect(typeof result).toBe('string');
    });

    it('用户使用工厂函数创建 Prompt', () => {
      const customPrompt = createPrompt();
      expect(customPrompt).toBeInstanceOf(Prompt);
    });
  });

  // ── 用户场景：综合使用多个组件（模拟日常工作流）─────────────────

  describe('场景四：用户综合使用多个组件', () => {
    interface FileItem {
      name: string;
      size: string;
      status: string;
      [key: string]: unknown;
    }

    it('用户查看文件列表并追踪处理进度', () => {
      // 场景：用户批量处理文件，使用表格展示文件列表，使用进度条追踪处理进度

      // 1. 用户创建文件列表表格
      const columns: TableColumn<FileItem>[] = [
        { key: 'name', header: '文件名' },
        { key: 'size', header: '大小' },
        { key: 'status', header: '状态' },
      ];

      const table = new Table<FileItem>(columns, { title: '文件处理列表' });
      table.addRows([
        { name: 'report.pdf', size: '2.3MB', status: '待处理' },
        { name: 'data.csv', size: '1.1MB', status: '待处理' },
        { name: 'image.png', size: '5.7MB', status: '待处理' },
      ]);

      expect(table.rowCount).toBe(3);

      // 2. 用户创建进度条追踪处理
      const progress = new Progress({ total: 3, label: '处理文件' });

      let state = progress.increment();
      expect(state.current).toBe(1);
      expect(state.percentage).toBeCloseTo(33.33, 0);

      state = progress.increment();
      expect(state.current).toBe(2);

      state = progress.increment();
      expect(state.current).toBe(3);
      expect(state.completed).toBe(true);
    });

    it('用户使用提示确认后执行表格操作', () => {
      const prompt = new Prompt();

      // 用户创建数据表格
      const columns: TableColumn<FileItem>[] = [
        { key: 'name', header: '文件名' },
        { key: 'status', header: '状态' },
      ];

      const table = new Table<FileItem>(columns);
      table.addRows([
        { name: 'doc1.txt', size: '', status: '待删除' },
        { name: 'doc2.txt', size: '', status: '正常' },
      ]);

      // 用户筛选待删除的文件
      table.filter(row => row.status === '待删除');
      expect(table.rowCount).toBe(1);

      // 用户确认删除操作
      const confirmed = prompt.renderConfirm('确认删除这些文件？', false);
      expect(typeof confirmed).toBe('boolean');
    });
  });
});