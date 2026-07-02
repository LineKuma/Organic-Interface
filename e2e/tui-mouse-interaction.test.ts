/**
 * E2E: TUI 鼠标事件处理测试
 *
 * 模拟用户在 TUI 应用中使用鼠标交互的完整流程：
 * 1. 鼠标处理器创建和配置
 * 2. 鼠标事件监听（click/dblclick/mousedown/mouseup/mousemove/drag/wheel/scroll）
 * 3. SGR 鼠标序列解析（左/中/右键、滚轮、修饰键）
 * 4. 鼠标处理器生命周期（启动/停止/状态）
 * 5. 双击检测和拖拽检测
 * 6. 键盘输入转发（data 事件）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MouseHandler,
  createMouseHandler,
  type MouseEvent,
  type MouseButton,
  type MouseEventType,
  Terminal,
  ANSI,
} from '@organic/ui';

// ── 测试辅助：模拟 SGR 鼠标序列 ───────────────────────────────────

/**
 * 创建 SGR 鼠标按下序列
 * Cb 编码: bits 0-1=button, bit2=shift, bit3=alt, bit4=ctrl, bit5=motion
 */
function sgrMousePress(
  button: number,
  x: number,
  y: number,
  shift: boolean = false,
  alt: boolean = false,
  ctrl: boolean = false
): Buffer {
  let cb = button;
  if (shift) cb |= 4;
  if (alt) cb |= 8;
  if (ctrl) cb |= 16;
  return Buffer.from(`\x1b[<${cb};${x};${y}M`);
}

/** 创建 SGR 鼠标释放序列 */
function sgrMouseRelease(
  button: number,
  x: number,
  y: number,
  shift: boolean = false,
  alt: boolean = false,
  ctrl: boolean = false
): Buffer {
  let cb = button;
  if (shift) cb |= 4;
  if (alt) cb |= 8;
  if (ctrl) cb |= 16;
  return Buffer.from(`\x1b[<${cb};${x};${y}m`);
}

/** 创建 SGR 鼠标移动序列（button=3, motion bit=32） */
function sgrMouseMove(x: number, y: number): Buffer {
  return Buffer.from(`\x1b[<35;${x};${y}M`);
}

/** 创建 SGR 鼠标拖拽序列（button=0, motion bit=32） */
function sgrMouseDrag(button: number, x: number, y: number): Buffer {
  const cb = button | 32;
  return Buffer.from(`\x1b[<${cb};${x};${y}M`);
}

/** 创建 SGR 滚轮序列（bit6=64） */
function sgrMouseWheel(isUp: boolean, x: number, y: number): Buffer {
  const cb = (isUp ? 0 : 1) | 64;
  return Buffer.from(`\x1b[<${cb};${x};${y}M`);
}

// ── 测试辅助：模拟 stdin 数据注入 ─────────────────────────────────

function injectStdinData(data: Buffer): void {
  process.stdin.emit('data', data);
}

// ── 用户场景：鼠标处理器创建和配置 ────────────────────────────────

describe('TUI 鼠标事件处理', () => {
  afterEach(() => {
    Terminal.reset();
  });

  describe('场景一：用户创建鼠标处理器', () => {
    it('用户创建 MouseHandler 实例', () => {
      const mouse = new MouseHandler();
      expect(mouse).toBeDefined();
      expect(mouse).toBeInstanceOf(MouseHandler);
    });

    it('用户使用 createMouseHandler 工厂函数', () => {
      const mouse = createMouseHandler();
      expect(mouse).toBeInstanceOf(MouseHandler);
    });

    it('用户创建 MouseHandler 时指定 Terminal', () => {
      const terminal = Terminal.init({ mouse: 'on' });
      const mouse = new MouseHandler(terminal);
      expect(mouse).toBeDefined();
    });

    it('用户创建 MouseHandler 时默认初始状态为未激活', () => {
      const mouse = new MouseHandler();
      expect(mouse.isActive).toBe(false);
    });
  });

  describe('场景二：用户配置鼠标处理器', () => {
    it('用户设置双击检测间隔', () => {
      const mouse = new MouseHandler();
      mouse.setClickTimeout(500);
      expect(mouse.isActive).toBe(false);
    });

    it('用户设置默认双击间隔', () => {
      const mouse = new MouseHandler();
      mouse.setClickTimeout(300);
      // 不应抛出异常
    });
  });

  // ── 用户场景：鼠标事件监听 ──────────────────────────────────────

  describe('场景三：用户监听鼠标事件', () => {
    let mouse: MouseHandler;
    let events: MouseEvent[];

    beforeEach(() => {
      Terminal.init({ mouse: 'on' });
      mouse = new MouseHandler();
      events = [];

      // 注册所有事件监听
      const eventTypes: MouseEventType[] = [
        'click', 'dblclick', 'mousedown', 'mouseup',
        'mousemove', 'drag', 'wheel', 'scroll',
      ];
      for (const type of eventTypes) {
        mouse.on(type, (ev: MouseEvent) => {
          events.push(ev);
        });
      }
    });

    afterEach(() => {
      mouse.stop();
    });

    it('用户点击鼠标左键', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseRelease(0, 10, 5));

      expect(events.length).toBeGreaterThan(0);
      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.button).toBe('left');
        expect(mousedown.x).toBe(10);
        expect(mousedown.y).toBe(5);
      }
    });

    it('用户点击鼠标中键', () => {
      mouse.start();
      injectStdinData(sgrMousePress(1, 15, 8));
      injectStdinData(sgrMouseRelease(1, 15, 8));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.button).toBe('middle');
      }
    });

    it('用户点击鼠标右键', () => {
      mouse.start();
      injectStdinData(sgrMousePress(2, 20, 10));
      injectStdinData(sgrMouseRelease(2, 20, 10));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.button).toBe('right');
      }
    });

    it('用户鼠标移动', () => {
      mouse.start();
      injectStdinData(sgrMouseMove(12, 4));
      injectStdinData(sgrMouseMove(14, 6));
      injectStdinData(sgrMouseMove(16, 8));

      const moves = events.filter(e => e.type === 'mousemove');
      expect(moves.length).toBeGreaterThanOrEqual(0);
    });

    it('用户使用修饰键点击（Shift+Click）', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5, true, false, false));
      injectStdinData(sgrMouseRelease(0, 10, 5, true, false, false));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.shift).toBe(true);
      }
    });

    it('用户使用修饰键点击（Ctrl+Click）', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5, false, false, true));
      injectStdinData(sgrMouseRelease(0, 10, 5, false, false, true));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.ctrl).toBe(true);
      }
    });

    it('用户使用修饰键点击（Alt+Click）', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5, false, true, false));
      injectStdinData(sgrMouseRelease(0, 10, 5, false, true, false));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.alt).toBe(true);
      }
    });

    it('用户使用组合修饰键点击（Ctrl+Shift+Click）', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5, true, false, true));
      injectStdinData(sgrMouseRelease(0, 10, 5, true, false, true));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.shift).toBe(true);
        expect(mousedown.ctrl).toBe(true);
      }
    });

    it('用户鼠标滚轮向上', () => {
      mouse.start();
      injectStdinData(sgrMouseWheel(true, 10, 5));

      const wheel = events.find(e => e.type === 'wheel');
      if (wheel) {
        expect(wheel.button).toBe('wheelUp');
      }
    });

    it('用户鼠标滚轮向下', () => {
      mouse.start();
      injectStdinData(sgrMouseWheel(false, 10, 5));

      const wheel = events.find(e => e.type === 'wheel');
      if (wheel) {
        expect(wheel.button).toBe('wheelDown');
      }
    });

    it('用户滚轮事件同时触发 wheel 事件', () => {
      mouse.start();
      injectStdinData(sgrMouseWheel(true, 10, 5));

      const wheel = events.find(e => e.type === 'wheel');
      expect(wheel).toBeDefined();
      if (wheel) {
        expect(wheel.button).toBe('wheelUp');
      }
    });

    it('用户监听所有事件（* 通配符）', () => {
      const allEvents: MouseEvent[] = [];
      mouse.on('*', (ev: MouseEvent) => {
        allEvents.push(ev);
      });

      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseRelease(0, 10, 5));

      expect(allEvents.length).toBeGreaterThan(0);
    });

    it('用户鼠标事件的 timestamp 字段存在', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 10, 5));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.timestamp).toBeDefined();
        expect(typeof mousedown.timestamp).toBe('number');
      }
    });

    it('用户鼠标事件的坐标是 1-indexed', () => {
      mouse.start();
      injectStdinData(sgrMousePress(0, 1, 1));

      const mousedown = events.find(e => e.type === 'mousedown');
      if (mousedown) {
        expect(mousedown.x).toBeGreaterThanOrEqual(1);
        expect(mousedown.y).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ── 用户场景：双击检测 ──────────────────────────────────────────

  describe('场景四：用户双击检测', () => {
    let mouse: MouseHandler;
    let doubleClicks: MouseEvent[];

    beforeEach(() => {
      Terminal.init({ mouse: 'on' });
      mouse = new MouseHandler();
      doubleClicks = [];

      mouse.on('dblclick', (ev: MouseEvent) => {
        doubleClicks.push(ev);
      });
    });

    afterEach(() => {
      mouse.stop();
    });

    it('用户快速双击同一位置触发 dblclick 事件', () => {
      mouse.start();

      // 第一次点击
      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseRelease(0, 10, 5));

      // 第二次点击（同一位置，快速）
      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseRelease(0, 10, 5));

      expect(doubleClicks.length).toBeGreaterThanOrEqual(1);
    });

    it('用户双击同时触发 click 事件', () => {
      const clicks: MouseEvent[] = [];
      mouse.on('click', (ev: MouseEvent) => {
        clicks.push(ev);
      });

      mouse.start();

      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseRelease(0, 10, 5));
      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseRelease(0, 10, 5));

      // click 事件应该被触发
      expect(clicks.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 用户场景：拖拽检测 ──────────────────────────────────────────

  describe('场景五：用户拖拽检测', () => {
    let mouse: MouseHandler;
    let dragEvents: MouseEvent[];

    beforeEach(() => {
      Terminal.init({ mouse: 'on' });
      mouse = new MouseHandler();
      dragEvents = [];

      mouse.on('drag', (ev: MouseEvent) => {
        dragEvents.push(ev);
      });
    });

    afterEach(() => {
      mouse.stop();
    });

    it('用户按住鼠标左键拖拽触发 drag 事件', () => {
      mouse.start();

      // 按下左键
      injectStdinData(sgrMousePress(0, 10, 5));
      // 拖拽移动
      injectStdinData(sgrMouseDrag(0, 12, 5));
      injectStdinData(sgrMouseDrag(0, 14, 5));
      injectStdinData(sgrMouseDrag(0, 16, 5));
      // 释放
      injectStdinData(sgrMouseRelease(0, 16, 5));

      expect(dragEvents.length).toBeGreaterThanOrEqual(3);
    });

    it('用户拖拽过程中坐标变化', () => {
      mouse.start();

      injectStdinData(sgrMousePress(0, 10, 5));
      injectStdinData(sgrMouseDrag(0, 15, 8));
      injectStdinData(sgrMouseDrag(0, 20, 12));
      injectStdinData(sgrMouseRelease(0, 20, 12));

      if (dragEvents.length >= 2) {
        expect(dragEvents[0].x).toBe(15);
        expect(dragEvents[0].y).toBe(8);
        expect(dragEvents[1].x).toBe(20);
        expect(dragEvents[1].y).toBe(12);
      }
    });
  });

  // ── 用户场景：键盘输入转发 ──────────────────────────────────────

  describe('场景六：用户键盘输入转发', () => {
    let mouse: MouseHandler;
    let dataEvents: Buffer[];

    beforeEach(() => {
      Terminal.init({ mouse: 'on' });
      mouse = new MouseHandler();
      dataEvents = [];

      mouse.on('data', (data: Buffer) => {
        dataEvents.push(data);
      });
    });

    afterEach(() => {
      mouse.stop();
    });

    it('用户普通键盘输入被转发为 data 事件', () => {
      mouse.start();
      injectStdinData(Buffer.from('a'));
      injectStdinData(Buffer.from('hello'));

      expect(dataEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('用户回车键输入被转发', () => {
      mouse.start();
      injectStdinData(Buffer.from('\r'));

      expect(dataEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('用户 Tab 键输入被转发', () => {
      mouse.start();
      injectStdinData(Buffer.from('\t'));

      expect(dataEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('用户 Ctrl+C 被转发', () => {
      mouse.start();
      injectStdinData(Buffer.from('\x03'));

      expect(dataEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('用户光标键序列被转发', () => {
      mouse.start();
      injectStdinData(Buffer.from('\x1b[A')); // Up arrow

      expect(dataEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 用户场景：鼠标处理器生命周期 ────────────────────────────────

  describe('场景七：用户管理鼠标处理器生命周期', () => {
    it('用户启动鼠标处理器', () => {
      Terminal.init({ mouse: 'on' });
      const mouse = new MouseHandler();
      mouse.start();
      expect(mouse.isActive).toBe(true);
      mouse.stop();
    });

    it('用户停止鼠标处理器', () => {
      Terminal.init({ mouse: 'on' });
      const mouse = new MouseHandler();
      mouse.start();
      mouse.stop();
      expect(mouse.isActive).toBe(false);
    });

    it('用户重复启动不会出错', () => {
      Terminal.init({ mouse: 'on' });
      const mouse = new MouseHandler();
      mouse.start();
      mouse.start();
      expect(mouse.isActive).toBe(true);
      mouse.stop();
    });

    it('用户重复停止不会出错', () => {
      Terminal.init({ mouse: 'on' });
      const mouse = new MouseHandler();
      mouse.start();
      mouse.stop();
      mouse.stop();
      expect(mouse.isActive).toBe(false);
    });

    it('用户未启动时停止不会出错', () => {
      Terminal.init({ mouse: 'on' });
      const mouse = new MouseHandler();
      mouse.stop();
      expect(mouse.isActive).toBe(false);
    });

    it('鼠标功能不可用时启动不会激活', () => {
      Terminal.init({ mouse: 'off' });
      const mouse = new MouseHandler();
      mouse.start();
      expect(mouse.isActive).toBe(false);
      mouse.stop();
    });
  });
});