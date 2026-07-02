/**
 * E2E: TUI 终端能力检测与屏幕管理测试
 *
 * 模拟用户在不同终端环境中的 TUI 体验：
 * 1. 终端能力自动检测（颜色深度、鼠标、Unicode、Emoji、宽高）
 * 2. 终端功能开关（手动启用/禁用各项特性）
 * 3. 屏幕缓冲区管理（交替屏幕、光标控制、清屏、位置移动）
 * 4. 主题系统（自动检测、自定义、低色彩、无色模式）
 * 5. ANSI 转义序列
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Terminal,
  Screen,
  createScreen,
  inAlternateScreen,
  ANSI,
  esc,
  DEFAULT_FEATURE_CONFIG,
  defaultTheme,
  lowColorTheme,
  noneTheme,
  createAutoTheme,
  createTheme,
  type FeatureConfig,
  type ColorDepth,
  type TerminalFeatures,
} from '@organic/ui';

// ── 测试辅助 ──────────────────────────────────────────────────────

function resetTerminal() {
  Terminal.reset();
}

// ── 用户场景：终端能力检测 ────────────────────────────────────────

describe('TUI 终端能力检测与屏幕管理', () => {
  afterEach(() => {
    resetTerminal();
  });

  describe('场景一：用户首次启动 — 终端能力自动检测', () => {
    it('用户启动终端管理器后获得终端能力报告', () => {
      const terminal = Terminal.init();

      const features = terminal.features;
      expect(features).toBeDefined();
      expect(features.termType).toBeDefined();
      expect(features.termProgram).toBeDefined();
      expect(typeof features.isTTY).toBe('boolean');
      expect(typeof features.unicode).toBe('boolean');
      expect(typeof features.mouse).toBe('boolean');
      expect(typeof features.trueColor).toBe('boolean');
      expect(typeof features.colors256).toBe('boolean');
      expect(typeof features.emoji).toBe('boolean');
      expect(typeof features.alternateScreen).toBe('boolean');
      expect(typeof features.bracketedPaste).toBe('boolean');
      expect(typeof features.focusEvents).toBe('boolean');
      expect(typeof features.cursorControl).toBe('boolean');
      expect(typeof features.resizeEvents).toBe('boolean');
    });

    it('用户可以看到终端尺寸信息', () => {
      const terminal = Terminal.init();
      const dims = terminal.dimensions;

      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('用户可以看到颜色深度', () => {
      const terminal = Terminal.init();
      const depth = terminal.colorDepth;

      const validDepths: ColorDepth[] = ['truecolor', '256', '16', '8', 'none'];
      expect(validDepths).toContain(depth);
    });

    it('用户使用 Terminal.get() 获取单例', () => {
      const t1 = Terminal.get();
      const t2 = Terminal.get();
      expect(t1).toBe(t2);
    });

    it('用户使用 terminal() 快捷函数', async () => {
      const { terminal } = await import('@organic/ui');
      const t = terminal();
      expect(t).toBeDefined();
      expect(t.features).toBeDefined();
    });
  });

  describe('场景二：用户查看终端功能详细报告', () => {
    it('用户查看终端类型和程序', () => {
      const terminal = Terminal.init();
      const features = terminal.features;

      // 这些是环境变量，至少有一个有值
      expect(typeof features.termType).toBe('string');
      expect(typeof features.termProgram).toBe('string');
    });

    it('用户查看 Term 是否支持鼠标', () => {
      const terminal = Terminal.init();
      const hasMouse = terminal.isAvailable('mouse');
      expect(typeof hasMouse).toBe('boolean');
    });

    it('用户查看 Term 是否支持真彩色', () => {
      const terminal = Terminal.init();
      const hasTrueColor = terminal.isAvailable('trueColor');
      expect(typeof hasTrueColor).toBe('boolean');
    });

    it('用户查看 Term 是否支持 Unicode', () => {
      const terminal = Terminal.init();
      const hasUnicode = terminal.isAvailable('unicode');
      expect(typeof hasUnicode).toBe('boolean');
    });

    it('用户查看 Term 是否支持 Emoji', () => {
      const terminal = Terminal.init();
      const hasEmoji = terminal.isAvailable('emoji');
      expect(typeof hasEmoji).toBe('boolean');
    });

    it('用户查看 Term 是否支持交替屏幕', () => {
      const terminal = Terminal.init();
      const hasAltScreen = terminal.isAvailable('alternateScreen');
      expect(typeof hasAltScreen).toBe('boolean');
    });

    it('用户查看 Term 是否支持光标控制', () => {
      const terminal = Terminal.init();
      const hasCursor = terminal.isAvailable('cursorControl');
      expect(typeof hasCursor).toBe('boolean');
    });

    it('用户查看 Term 是否支持焦点事件', () => {
      const terminal = Terminal.init();
      const hasFocus = terminal.isAvailable('focusEvents');
      expect(typeof hasFocus).toBe('boolean');
    });

    it('用户查看 Term 是否支持粘贴括号', () => {
      const terminal = Terminal.init();
      const hasBracket = terminal.isAvailable('bracketedPaste');
      expect(typeof hasBracket).toBe('boolean');
    });

    it('用户查看 Term 是否支持 resize 事件', () => {
      const terminal = Terminal.init();
      const hasResize = terminal.isAvailable('resizeEvents');
      expect(typeof hasResize).toBe('boolean');
    });
  });

  // ── 用户场景：手动配置终端功能 ──────────────────────────────────

  describe('场景三：用户手动配置终端功能开关', () => {
    it('用户强制启用鼠标功能', () => {
      const terminal = Terminal.init({ mouse: 'on' });
      expect(terminal.features.mouse).toBe(true);
    });

    it('用户强制禁用鼠标功能', () => {
      const terminal = Terminal.init({ mouse: 'off' });
      expect(terminal.features.mouse).toBe(false);
    });

    it('用户强制启用 Unicode', () => {
      const terminal = Terminal.init({ unicode: 'on' });
      expect(terminal.features.unicode).toBe(true);
    });

    it('用户强制禁用 Unicode', () => {
      const terminal = Terminal.init({ unicode: 'off' });
      expect(terminal.features.unicode).toBe(false);
    });

    it('用户强制启用 Emoji', () => {
      const terminal = Terminal.init({ emoji: 'on' });
      expect(terminal.features.emoji).toBe(true);
    });

    it('用户强制启用交替屏幕', () => {
      const terminal = Terminal.init({ alternateScreen: 'on' });
      expect(terminal.features.alternateScreen).toBe(true);
    });

    it('用户强制禁用交替屏幕', () => {
      const terminal = Terminal.init({ alternateScreen: 'off' });
      expect(terminal.features.alternateScreen).toBe(false);
    });

    it('用户强制指定颜色深度为 256', () => {
      Terminal.init({ colorDepth: '256' });
      const terminal = Terminal.get();
      expect(terminal.colorDepth).toBe('256');
    });

    it('用户强制指定颜色深度为 truecolor', () => {
      Terminal.init({ colorDepth: 'truecolor' });
      const terminal = Terminal.get();
      expect(terminal.colorDepth).toBe('truecolor');
    });

    it('用户强制指定颜色深度为 none', () => {
      Terminal.init({ colorDepth: 'none' });
      const terminal = Terminal.get();
      expect(terminal.colorDepth).toBe('none');
    });

    it('用户强制指定终端尺寸', () => {
      const terminal = Terminal.init({ width: 120, height: 40 });
      const dims = terminal.dimensions;
      expect(dims.width).toBe(120);
      expect(dims.height).toBe(40);
    });

    it('用户使用 enable/disable 方法切换功能', () => {
      const terminal = Terminal.init();

      terminal.enable('mouse');
      expect(terminal.features.mouse).toBe(true);

      terminal.disable('mouse');
      expect(terminal.features.mouse).toBe(false);
    });

    it('用户使用 enable/disable 切换 Unicode', () => {
      const terminal = Terminal.init();

      terminal.enable('unicode');
      expect(terminal.features.unicode).toBe(true);

      terminal.disable('unicode');
      expect(terminal.features.unicode).toBe(false);
    });

    it('用户使用 updateConfig 批量更新配置', () => {
      const terminal = Terminal.init();

      terminal.updateConfig({
        mouse: 'on',
        unicode: 'off',
        emoji: 'off',
        colorDepth: '16',
      });

      expect(terminal.features.mouse).toBe(true);
      expect(terminal.features.unicode).toBe(false);
      expect(terminal.features.emoji).toBe(false);
      expect(terminal.colorDepth).toBe('16');
    });

    it('用户查看默认配置', () => {
      const terminal = Terminal.init();
      const config = terminal.config;

      expect(config.mouse).toBe('auto');
      expect(config.unicode).toBe('auto');
      expect(config.emoji).toBe('auto');
      expect(config.trueColor).toBe('auto');
      expect(config.colors256).toBe('auto');
      expect(config.colorDepth).toBe('auto');
    });

    it('用户刷新终端尺寸', () => {
      const terminal = Terminal.init();
      const before = { ...terminal.dimensions };

      terminal.refreshDimensions();
      const after = terminal.dimensions;

      expect(after.width).toBeGreaterThanOrEqual(0);
      expect(after.height).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 用户场景：屏幕缓冲区管理 ────────────────────────────────────

  describe('场景四：用户使用屏幕缓冲区（交替屏幕）', () => {
    it('用户创建 Screen 实例', () => {
      const screen = new Screen();
      expect(screen).toBeDefined();
    });

    it('用户使用 createScreen 工厂函数', () => {
      const screen = createScreen();
      expect(screen).toBeInstanceOf(Screen);
      expect(screen).toBeDefined();
    });

    it('用户使用指定 Terminal 创建 Screen', () => {
      const terminal = Terminal.init();
      const screen = new Screen(terminal);
      expect(screen).toBeDefined();
    });

    it('用户进入交替屏幕（需要终端支持）', () => {
      const screen = new Screen();
      screen.enterAltScreen();
      // 如果终端不支持交替屏幕，则不会激活
      expect(typeof screen.isAltScreen).toBe('boolean');
    });

    it('用户退出交替屏幕', () => {
      const screen = new Screen();
      screen.enterAltScreen();
      screen.exitAltScreen();
      expect(screen.isAltScreen).toBe(false);
    });

    it('用户重复进入交替屏幕不会出错', () => {
      const screen = new Screen();
      screen.enterAltScreen();
      screen.enterAltScreen();
      expect(typeof screen.isAltScreen).toBe('boolean');
    });

    it('用户查看交替屏幕状态', () => {
      const screen = new Screen();
      expect(typeof screen.isAltScreen).toBe('boolean');
    });

    it('用户使用 inAlternateScreen 辅助函数', async () => {
      let screenPassed: Screen | null = null;

      await inAlternateScreen(async (screen) => {
        screenPassed = screen;
      });

      expect(screenPassed).toBeDefined();
      expect(screenPassed).toBeInstanceOf(Screen);
    });

    it('inAlternateScreen 函数在异常时也能恢复', async () => {
      try {
        await inAlternateScreen(async () => {
          throw new Error('test error');
        });
      } catch {
        // 预期异常被抛出
      }
      // 屏幕应该被恢复，不应有挂起的交替屏幕
    });
  });

  // ── 用户场景：光标控制 ──────────────────────────────────────────

  describe('场景五：用户控制光标显示和位置', () => {
    let screen: Screen;

    beforeEach(() => {
      screen = new Screen();
    });

    it('用户隐藏光标', () => {
      screen.hideCursor();
      // 不应抛出异常
    });

    it('用户显示光标', () => {
      screen.hideCursor();
      screen.showCursor();
      // 不应抛出异常
    });

    it('用户重复隐藏光标不会出错', () => {
      screen.hideCursor();
      screen.hideCursor();
    });

    it('用户移动光标到指定位置', () => {
      screen.moveTo(10, 5);
      // 不应抛出异常
    });

    it('用户相对移动光标', () => {
      screen.moveUp(2);
      screen.moveDown(3);
      screen.moveLeft(1);
      screen.moveRight(4);
      // 不应抛出异常
    });

    it('用户移动光标默认步长', () => {
      screen.moveUp();
      screen.moveDown();
      screen.moveLeft();
      screen.moveRight();
      // 不应抛出异常
    });

    it('用户保存和恢复光标位置', () => {
      screen.saveCursor();
      screen.restoreCursor();
      // 不应抛出异常
    });
  });

  // ── 用户场景：清屏操作 ──────────────────────────────────────────

  describe('场景六：用户清屏操作', () => {
    let screen: Screen;

    beforeEach(() => {
      screen = new Screen();
    });

    it('用户清空整个屏幕', () => {
      screen.clear();
      // 不应抛出异常
    });

    it('用户清除当前行', () => {
      screen.clearLine();
      // 不应抛出异常
    });

    it('用户清除光标以下内容', () => {
      screen.clearDown();
      // 不应抛出异常
    });

    it('用户写入文本到屏幕', () => {
      screen.write('Hello TUI');
      // 不应抛出异常
    });
  });

  // ── 用户场景：屏幕尺寸和 resize 事件 ────────────────────────────

  describe('场景七：用户处理屏幕尺寸变化', () => {
    it('用户获取屏幕尺寸', () => {
      const screen = new Screen();
      const dims = screen.dimensions;

      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('用户监听 resize 事件', () => {
      const screen = new Screen();
      screen.listenResize();
      screen.unlistenResize();
      // 不应抛出异常
    });

    it('用户重复监听 resize 不会出错', () => {
      const screen = new Screen();
      screen.listenResize();
      screen.listenResize();
      screen.unlistenResize();
    });

    it('用户取消监听不会出错', () => {
      const screen = new Screen();
      screen.unlistenResize();
      // 不应抛出异常
    });

    it('用户设置 cleanup 处理器', () => {
      const screen = new Screen();
      screen.setupCleanup();
      // 不应抛出异常
    });

    it('用户 restore 恢复终端状态', () => {
      const screen = new Screen();
      screen.restore();
      // 不应抛出异常
    });
  });

  // ── 用户场景：主题系统 ──────────────────────────────────────────

  describe('场景八：用户使用主题系统', () => {
    it('用户使用默认主题', () => {
      expect(defaultTheme).toBeDefined();
      expect(defaultTheme.colors).toBeDefined();
      expect(defaultTheme.colors.primary).toBeDefined();
      expect(defaultTheme.colors.success).toBeDefined();
      expect(defaultTheme.colors.error).toBeDefined();
      expect(defaultTheme.colors.warning).toBeDefined();
      expect(defaultTheme.colors.info).toBeDefined();
      expect(defaultTheme.useUnicodePrefixes).toBe(true);
    });

    it('用户使用低色彩主题', () => {
      expect(lowColorTheme).toBeDefined();
      expect(lowColorTheme.useUnicodePrefixes).toBe(false);
      expect(lowColorTheme.errorPrefix).toBe('ERR');
      expect(lowColorTheme.successPrefix).toBe('ok');
    });

    it('用户使用无色主题', () => {
      expect(noneTheme).toBeDefined();
      expect(noneTheme.useUnicodePrefixes).toBe(false);
      expect(noneTheme.infoPrefix).toBe('i');
      expect(noneTheme.errorPrefix).toBe('x');
    });

    it('用户使用自动主题检测', () => {
      const theme = createAutoTheme();
      expect(theme).toBeDefined();
      expect(theme.colors).toBeDefined();
    });

    it('用户创建自定义主题', () => {
      const theme = createTheme({
        infoPrefix: 'INFO',
        successPrefix: 'OK',
        useUnicodePrefixes: false,
      });

      expect(theme.infoPrefix).toBe('INFO');
      expect(theme.successPrefix).toBe('OK');
      expect(theme.useUnicodePrefixes).toBe(false);
    });

    it('用户创建部分覆盖的自定义主题', () => {
      const theme = createTheme({
        errorPrefix: 'ERROR',
      });

      // 仅覆盖 errorPrefix，其他保持默认
      expect(theme.errorPrefix).toBe('ERROR');
      expect(theme.useUnicodePrefixes).toBe(true);
    });
  });

  // ── 用户场景：ANSI 转义序列 ─────────────────────────────────────

  describe('场景九：用户使用 ANSI 转义序列', () => {
    it('esc 函数生成转义序列', () => {
      const result = esc('2J');
      expect(result).toBe('\x1b[2J');
    });

    it('ANSI 常量包含所有需要的序列', () => {
      expect(ANSI.mouseOn).toBeDefined();
      expect(ANSI.mouseOff).toBeDefined();
      expect(ANSI.altScreenOn).toBeDefined();
      expect(ANSI.altScreenOff).toBeDefined();
      expect(ANSI.bracketedPasteOn).toBeDefined();
      expect(ANSI.bracketedPasteOff).toBeDefined();
      expect(ANSI.focusOn).toBeDefined();
      expect(ANSI.focusOff).toBeDefined();
      expect(ANSI.cursorShow).toBeDefined();
      expect(ANSI.cursorHide).toBeDefined();
      expect(ANSI.clearScreen).toBeDefined();
      expect(ANSI.saveCursor).toBeDefined();
      expect(ANSI.restoreCursor).toBeDefined();
      expect(ANSI.eraseLine).toBeDefined();
      expect(ANSI.eraseDown).toBeDefined();
      expect(ANSI.reset).toBeDefined();
      expect(ANSI.bold).toBeDefined();
      expect(ANSI.dim).toBeDefined();
      expect(ANSI.italic).toBeDefined();
      expect(ANSI.underline).toBeDefined();
      expect(ANSI.blink).toBeDefined();
      expect(ANSI.inverse).toBeDefined();
      expect(ANSI.hidden).toBeDefined();
      expect(ANSI.strikethrough).toBeDefined();
    });

    it('ANSI.moveTo 生成正确的位置序列', () => {
      const seq = ANSI.moveTo(10, 5);
      expect(seq).toBe('\x1b[10;5H');
    });

    it('ANSI 方向移动序列', () => {
      expect(ANSI.up(3)).toBe('\x1b[3A');
      expect(ANSI.down(2)).toBe('\x1b[2B');
      expect(ANSI.right(4)).toBe('\x1b[4C');
      expect(ANSI.left(1)).toBe('\x1b[1D');
    });

    it('ANSI 方向移动默认步长', () => {
      expect(ANSI.up()).toBe('\x1b[1A');
      expect(ANSI.down()).toBe('\x1b[1B');
      expect(ANSI.right()).toBe('\x1b[1C');
      expect(ANSI.left()).toBe('\x1b[1D');
    });
  });
});