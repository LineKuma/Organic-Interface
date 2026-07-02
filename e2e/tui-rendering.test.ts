/**
 * E2E: TUI 渲染组件测试（Spinner、Banner、Box、Output）
 *
 * 模拟用户使用 TUI 渲染组件的完整操作流程：
 * 1. 用户使用 Spinner 显示加载状态
 * 2. 用户使用 Banner 展示欢迎信息
 * 3. 用户使用 Box 展示结构化内容
 * 4. 用户使用 Output 进行格式化输出
 * 5. 用户综合使用多个渲染组件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Spinner,
  createSpinner,
  withSpinner,
  Banner,
  createBanner,
  defaultBanner,
  Box,
  createBox,
  defaultBox,
  Output,
  createOutput,
  defaultOutput,
  type SpinnerOptions,
  type BannerConfig,
  type BannerStyle,
  type BoxConfig,
  type BoxStyle,
  type OutputLevel,
} from '@organic/ui';

// ── 用户场景：使用 Spinner 显示加载状态 ───────────────────────────

describe('TUI 渲染组件', () => {
  describe('场景一：用户使用 Spinner 显示加载状态', () => {
    it('用户创建默认 Spinner', () => {
      const spinner = new Spinner();
      expect(spinner).toBeDefined();
      expect(spinner.isSpinning).toBe(false);
    });

    it('用户创建带文本的 Spinner', () => {
      const spinner = new Spinner({ text: 'Loading...' });
      expect(spinner).toBeDefined();
      expect(spinner.isSpinning).toBe(false);
    });

    it('用户使用 createSpinner 工厂函数', () => {
      const spinner = createSpinner({ text: 'Processing' });
      expect(spinner).toBeInstanceOf(Spinner);
    });

    it('用户启动 Spinner', () => {
      const spinner = new Spinner({ text: 'Starting...' });
      expect(() => spinner.start()).not.toThrow();
      spinner.stop();
    });

    it('用户启动 Spinner 时更新文本', () => {
      const spinner = new Spinner();
      expect(() => spinner.start('Loading data...')).not.toThrow();
      spinner.stop();
    });

    it('用户更新 Spinner 文本', () => {
      const spinner = new Spinner({ text: 'Step 1' });
      spinner.start();
      expect(() => spinner.setText('Step 2')).not.toThrow();
      spinner.stop();
    });

    it('用户成功完成 Spinner', () => {
      const spinner = new Spinner({ text: 'Installing...' });
      spinner.start();
      spinner.succeed('Installed successfully');
      // 不应抛出异常
    });

    it('用户成功完成 Spinner（无文本）', () => {
      const spinner = new Spinner();
      spinner.start();
      spinner.succeed();
      // 不应抛出异常
    });

    it('用户失败完成 Spinner', () => {
      const spinner = new Spinner({ text: 'Deploying...' });
      spinner.start();
      spinner.fail('Deployment failed');
      // 不应抛出异常
    });

    it('用户失败完成 Spinner（无文本）', () => {
      const spinner = new Spinner();
      spinner.start();
      spinner.fail();
      // 不应抛出异常
    });

    it('用户警告完成 Spinner', () => {
      const spinner = new Spinner({ text: 'Checking...' });
      spinner.start();
      spinner.warn('Warning: deprecated');
      // 不应抛出异常
    });

    it('用户信息提示完成 Spinner', () => {
      const spinner = new Spinner({ text: 'Syncing...' });
      spinner.start();
      spinner.info('Already up to date');
      // 不应抛出异常
    });

    it('用户停止 Spinner', () => {
      const spinner = new Spinner({ text: 'Working...' });
      spinner.start();
      spinner.stop();
      // 不应抛出异常
    });

    it('用户停止并保留 Spinner 输出', () => {
      const spinner = new Spinner({ text: 'Working...' });
      spinner.start();
      spinner.stopAndPersist({ symbol: '✓', text: 'Done' });
      // 不应抛出异常
    });

    it('用户使用不同 Spinner 样式', () => {
      const styles = ['dots', 'line', 'star', 'dots2', 'arc'];
      for (const style of styles) {
        const spinner = new Spinner({ text: style, spinner: style });
        spinner.start();
        spinner.stop();
      }
      // 不应抛出异常
    });

    it('用户使用不同颜色 Spinner', () => {
      const spinner = new Spinner({ text: 'Colored', color: 'green' });
      spinner.start();
      spinner.stop();
      // 不应抛出异常
    });

    it('用户使用 withSpinner 辅助函数（成功）', async () => {
      const result = await withSpinner('Processing', async () => {
        return 'done';
      });
      expect(result).toBe('done');
    });

    it('用户使用 withSpinner 辅助函数（失败）', async () => {
      try {
        await withSpinner('Processing', async () => {
          throw new Error('Failed');
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('用户获取原始 ora 实例', () => {
      const spinner = new Spinner();
      expect(spinner.raw).toBeDefined();
    });
  });

  // ── 用户场景：使用 Banner 展示信息 ──────────────────────────────

  describe('场景二：用户使用 Banner 展示欢迎信息', () => {
    let banner: Banner;

    beforeEach(() => {
      banner = new Banner();
    });

    it('用户创建 Banner 实例', () => {
      const b = new Banner();
      expect(b).toBeDefined();
    });

    it('用户使用 createBanner 工厂函数', () => {
      const b = createBanner();
      expect(b).toBeInstanceOf(Banner);
    });

    it('用户使用默认 Banner 实例', () => {
      expect(defaultBanner).toBeDefined();
      expect(defaultBanner).toBeInstanceOf(Banner);
    });

    it('用户渲染简单 Banner（带标题）', () => {
      const output = banner.render({
        title: 'My Application',
        style: 'simple',
      });

      expect(output).toContain('My Application');
    });

    it('用户渲染带副标题的简单 Banner', () => {
      const output = banner.render({
        title: 'Organic Interface',
        subtitle: 'AI-powered UI automation',
        style: 'simple',
      });

      expect(output).toContain('Organic Interface');
      expect(output).toContain('AI-powered UI automation');
    });

    it('用户渲染带版本号的简单 Banner', () => {
      const output = banner.render({
        title: 'MyApp',
        version: '1.0.0',
        style: 'simple',
      });

      expect(output).toContain('MyApp');
      expect(output).toContain('v1.0.0');
    });

    it('用户渲染 Box 风格的 Banner', () => {
      const output = banner.render({
        title: 'System Dashboard',
        style: 'box',
      });

      expect(output).toContain('System Dashboard');
      expect(output).toContain('┌');
      expect(output).toContain('┐');
      expect(output).toContain('└');
      expect(output).toContain('┘');
    });

    it('用户渲染 Double 风格的 Banner', () => {
      const output = banner.render({
        title: 'Welcome',
        style: 'double',
      });

      expect(output).toContain('Welcome');
      expect(output).toContain('╔');
      expect(output).toContain('╗');
      expect(output).toContain('╚');
      expect(output).toContain('╝');
    });

    it('用户渲染 Rounded 风格的 Banner', () => {
      const output = banner.render({
        title: 'Hello',
        style: 'rounded',
      });

      expect(output).toContain('Hello');
      expect(output).toContain('╭');
      expect(output).toContain('╮');
      expect(output).toContain('╰');
      expect(output).toContain('╯');
    });

    it('用户渲染居中对齐的 Banner', () => {
      const output = banner.render({
        title: 'Center',
        align: 'center',
        style: 'box',
      });

      expect(output).toContain('Center');
    });

    it('用户渲染左对齐的 Banner', () => {
      const output = banner.render({
        title: 'Left',
        align: 'left',
        style: 'box',
      });

      expect(output).toContain('Left');
    });

    it('用户渲染带描述的 Banner', () => {
      const output = banner.render({
        title: 'App',
        description: 'This is a terminal UI application for automation',
        style: 'box',
      });

      expect(output).toContain('App');
      expect(output).toContain('terminal');
    });

    it('用户渲染完整 Banner（标题+版本+副标题+描述）', () => {
      const output = banner.render({
        title: 'Organic Interface',
        version: '1.0.0',
        subtitle: 'AI-powered UI automation framework',
        description: 'A comprehensive framework for building AI-driven terminal user interfaces with rich rendering capabilities.',
        style: 'double',
        width: 70,
      });

      expect(output).toContain('Organic Interface');
      expect(output).toContain('v1.0.0');
      expect(output).toContain('AI-powered');
      expect(output).toContain('comprehensive');
    });

    it('用户渲染简单 heading', () => {
      const output = banner.heading('Section Title');
      expect(output).toContain('Section Title');
      expect(output).toContain('─');
    });

    it('用户使用 Banner.print 直接输出', () => {
      const b = new Banner();
      expect(() => b.print({ title: 'Test', style: 'simple' })).not.toThrow();
    });
  });

  // ── 用户场景：使用 Box 展示结构化内容 ───────────────────────────

  describe('场景三：用户使用 Box 展示结构化内容', () => {
    let box: Box;

    beforeEach(() => {
      box = new Box();
    });

    it('用户创建 Box 实例', () => {
      const b = new Box();
      expect(b).toBeDefined();
    });

    it('用户使用 createBox 工厂函数', () => {
      const b = createBox();
      expect(b).toBeInstanceOf(Box);
    });

    it('用户使用默认 Box 实例', () => {
      expect(defaultBox).toBeDefined();
      expect(defaultBox).toBeInstanceOf(Box);
    });

    it('用户渲染简单的 Box', () => {
      const output = box.render({
        content: ['Hello World'],
        style: 'single',
      });

      expect(output).toContain('Hello World');
      expect(output).toContain('┌');
      expect(output).toContain('┐');
      expect(output).toContain('└');
      expect(output).toContain('┘');
    });

    it('用户渲染带标题的 Box', () => {
      const output = box.render({
        title: 'System Info',
        content: ['CPU: 45%', 'Memory: 60%'],
        style: 'single',
      });

      expect(output).toContain('System Info');
      expect(output).toContain('CPU: 45%');
      expect(output).toContain('Memory: 60%');
    });

    it('用户渲染多行内容的 Box', () => {
      const output = box.render({
        content: [
          'Line 1',
          'Line 2',
          'Line 3',
          'Line 4',
          'Line 5',
        ],
        style: 'single',
      });

      expect(output).toContain('Line 1');
      expect(output).toContain('Line 5');
    });

    it('用户渲染 Double 风格的 Box', () => {
      const output = box.render({
        content: ['Double border'],
        style: 'double',
      });

      expect(output).toContain('╔');
      expect(output).toContain('╗');
      expect(output).toContain('╚');
      expect(output).toContain('╝');
    });

    it('用户渲染 Rounded 风格的 Box', () => {
      const output = box.render({
        content: ['Rounded corners'],
        style: 'rounded',
      });

      expect(output).toContain('╭');
      expect(output).toContain('╮');
      expect(output).toContain('╰');
      expect(output).toContain('╯');
    });

    it('用户渲染 Bold 风格的 Box', () => {
      const output = box.render({
        content: ['Bold border'],
        style: 'bold',
      });

      expect(output).toContain('┏');
      expect(output).toContain('┓');
      expect(output).toContain('┗');
      expect(output).toContain('┛');
    });

    it('用户渲染 Dashed 风格的 Box', () => {
      const output = box.render({
        content: ['Dashed border'],
        style: 'dashed',
      });

      expect(output).toContain('┌');
      expect(output).toContain('┐');
      expect(output).toContain('└');
      expect(output).toContain('┘');
    });

    it('用户渲染指定宽度的 Box', () => {
      const output = box.render({
        content: ['Short'],
        width: 30,
        style: 'single',
      });

      expect(output).toContain('Short');
      // 宽度检查：至少包含边框字符
      expect(output.split('\n')[0].length).toBeGreaterThanOrEqual(30);
    });

    it('用户渲染居中对齐的 Box', () => {
      const output = box.render({
        title: 'Center Box',
        content: ['Centered text'],
        align: 'center',
        style: 'single',
      });

      expect(output).toContain('Centered text');
    });

    it('用户渲染自定义 padding 的 Box', () => {
      const output = box.render({
        content: ['With padding'],
        padding: 3,
        style: 'single',
      });

      expect(output).toContain('With padding');
    });

    it('用户渲染零 padding 的 Box', () => {
      const output = box.render({
        content: ['No padding'],
        padding: 0,
        style: 'single',
      });

      expect(output).toContain('No padding');
    });

    it('用户渲染 Key-Value Box', () => {
      const output = box.renderKeyValue([
        ['Name', 'Organic Interface'],
        ['Version', '0.1.0'],
        ['Status', 'Running'],
        ['Uptime', '2h 30m'],
      ], { title: 'Application Info', style: 'single' });

      expect(output).toContain('Application Info');
      expect(output).toContain('Name');
      expect(output).toContain('Organic Interface');
      expect(output).toContain('Version');
      expect(output).toContain('0.1.0');
      expect(output).toContain('Status');
      expect(output).toContain('Running');
      expect(output).toContain('Uptime');
      expect(output).toContain('2h 30m');
    });

    it('用户渲染 Key-Value Box 无标题', () => {
      const output = box.renderKeyValue([
        ['Key1', 'Value1'],
        ['Key2', 'Value2'],
      ]);

      expect(output).toContain('Key1');
      expect(output).toContain('Value1');
      expect(output).toContain('Key2');
      expect(output).toContain('Value2');
    });

    it('用户使用 Box.print 直接输出', () => {
      const b = new Box();
      expect(() => b.print({ content: ['Test'] })).not.toThrow();
    });
  });

  // ── 用户场景：使用 Output 进行格式化输出 ────────────────────────

  describe('场景四：用户使用 Output 进行格式化输出', () => {
    let output: Output;

    beforeEach(() => {
      output = new Output();
    });

    it('用户创建 Output 实例', () => {
      const o = new Output();
      expect(o).toBeDefined();
    });

    it('用户使用 createOutput 工厂函数', () => {
      const o = createOutput();
      expect(o).toBeInstanceOf(Output);
    });

    it('用户使用默认 Output 实例', () => {
      expect(defaultOutput).toBeDefined();
      expect(defaultOutput).toBeInstanceOf(Output);
    });

    it('用户输出带标题的 heading', () => {
      expect(() => output.heading('Section Title')).not.toThrow();
    });

    it('用户输出 subheading', () => {
      expect(() => output.subheading('Subsection')).not.toThrow();
    });

    it('用户输出 info 级别消息', () => {
      expect(() => output.info('Information message')).not.toThrow();
    });

    it('用户输出 success 级别消息', () => {
      expect(() => output.success('Operation completed')).not.toThrow();
    });

    it('用户输出 warning 级别消息', () => {
      expect(() => output.warn('Warning message')).not.toThrow();
    });

    it('用户输出 error 级别消息', () => {
      expect(() => output.error('Error occurred')).not.toThrow();
    });

    it('用户输出 debug 消息（非 verbose 模式不显示）', () => {
      expect(() => output.debug('Debug info')).not.toThrow();
    });

    it('用户输出 key-value 对', () => {
      expect(() => output.keyValue('Name', 'Alice')).not.toThrow();
    });

    it('用户输出带缩进的 key-value 对', () => {
      expect(() => output.keyValue('Property', 'Value', 4)).not.toThrow();
    });

    it('用户输出 bullet 列表', () => {
      expect(() => output.bullet('Item 1')).not.toThrow();
      expect(() => output.bullet('Item 2', 2)).not.toThrow();
    });

    it('用户输出 numbered 列表', () => {
      expect(() => output.numbered(1, 'First item')).not.toThrow();
      expect(() => output.numbered(2, 'Second item', 2)).not.toThrow();
    });

    it('用户输出 divider 分隔线', () => {
      expect(() => output.divider()).not.toThrow();
      expect(() => output.divider(80)).not.toThrow();
    });

    it('用户输出空行', () => {
      expect(() => output.newline()).not.toThrow();
    });

    it('用户输出纯文本', () => {
      expect(() => output.plain('Plain text')).not.toThrow();
    });

    it('用户使用 log 方法输出不同级别', () => {
      const levels: OutputLevel[] = ['info', 'success', 'warning', 'error', 'debug'];
      for (const level of levels) {
        expect(() => output.log(level, `Message at ${level}`)).not.toThrow();
      }
    });

    it('用户设置 verbose 模式', () => {
      output.setVerbose(true);
      expect(() => output.debug('Debug in verbose')).not.toThrow();
    });

    it('用户获取主题颜色', () => {
      const colors = output.theme_colors;
      expect(colors).toBeDefined();
      expect(colors.primary).toBeDefined();
      expect(colors.success).toBeDefined();
      expect(colors.error).toBeDefined();
    });

    it('用户获取 chalk 实例', () => {
      expect(output.chalk).toBeDefined();
    });
  });

  // ── 用户场景：综合使用渲染组件 ──────────────────────────────────

  describe('场景五：用户综合使用 TUI 渲染组件', () => {
    it('用户使用 Banner + Box 创建应用仪表盘', () => {
      // 1. 用户看到应用 Banner
      const banner = new Banner();
      const bannerOutput = banner.render({
        title: 'Dashboard',
        version: '1.0.0',
        style: 'double',
        width: 60,
      });
      expect(bannerOutput).toContain('Dashboard');

      // 2. 用户看到系统信息 Box
      const box = new Box();
      const boxOutput = box.renderKeyValue([
        ['CPU', '45%'],
        ['Memory', '8.2 GB / 16 GB'],
        ['Disk', '120 GB / 256 GB'],
      ], { title: 'System Info', style: 'rounded' });
      expect(boxOutput).toContain('System Info');
      expect(boxOutput).toContain('CPU');

      // 3. 用户看到状态 Box
      const statusBox = new Box();
      const statusOutput = statusBox.render({
        title: 'Services',
        content: [
          'Web Server    ✓ Running',
          'Database      ✓ Running',
          'Cache         ✓ Running',
          'Queue         ✗ Stopped',
        ],
        style: 'single',
      });
      expect(statusOutput).toContain('Services');
      expect(statusOutput).toContain('Running');
      expect(statusOutput).toContain('Stopped');
    });

    it('用户使用 Output 输出结构化日志', () => {
      const output = new Output();

      expect(() => {
        output.heading('Deployment Report');
        output.info('Starting deployment...');
        output.keyValue('Environment', 'production');
        output.keyValue('Version', '1.0.0');
        output.divider();
        output.success('Build completed');
        output.success('Tests passed');
        output.warn('Coverage below threshold (78%)');
        output.divider();
        output.numbered(1, 'Upload artifacts');
        output.numbered(2, 'Update database');
        output.numbered(3, 'Restart services');
        output.newline();
        output.success('Deployment successful!');
      }).not.toThrow();
    });

    it('用户使用 Spinner 追踪操作进度', () => {
      const spinner = new Spinner({ text: 'Processing batch...' });

      expect(() => {
        spinner.start();
        spinner.setText('Processing item 1/5...');
        spinner.setText('Processing item 2/5...');
        spinner.setText('Processing item 3/5...');
        spinner.setText('Processing item 4/5...');
        spinner.setText('Processing item 5/5...');
        spinner.succeed('Batch completed');
        spinner.stopAndPersist({ text: 'All items processed' });
      }).not.toThrow();
    });
  });
});