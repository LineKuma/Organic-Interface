# TUI 组件参考

## 基本信息

**文档类型**: API 参考
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

Organic-Interface 提供完整的终端 UI（TUI）组件库，包含终端管理、屏幕控制、渲染组件、交互组件、输入处理以及一套 **交互式会话层（agent CLI 风格）**：输入框、历史浏览、斜杠命令与格式化输出。所有组件位于 `@organic/ui` 包中。

---

## 组件架构

```
@organic/ui
├── terminal/          # 终端基础设施
│   ├── Terminal.ts    # 终端能力检测和管理
│   ├── Screen.ts      # 屏幕缓冲区管理
│   ├── Theme.ts       # 主题系统
│   ├── Output.ts      # 格式化输出
│   ├── Spinner.ts     # 加载动画
│   ├── Banner.ts      # 横幅展示
│   ├── Box.ts         # 结构化盒子
│   └── Mouse.ts       # 鼠标事件处理
├── components/        # 交互组件
│   ├── Prompt.ts      # 交互式提示
│   ├── Progress.ts    # 进度条
│   └── Table.ts       # 数据表格
├── cli/              # CLI 系统
│   ├── CLI.ts         # CLI 主程序
│   ├── Command.ts     # 命令定义
│   └── CommandParser.ts # 命令解析器
├── tui/              # 交互式会话层（agent CLI 风格）
│   ├── ChatSession.ts # 会话编排：输入框 + 历史 + 斜杠命令
│   ├── InputBox.ts    # 行编辑器（光标/补全/历史导航）
│   ├── History.ts     # 命令历史（去重/边界/持久化）
│   ├── SlashCommand.ts# 斜杠命令注册、解析与执行
│   ├── render.ts      # 格式化输出（消息框/代码块/富文本/菜单/状态栏）
│   └── types.ts       # TUI 共享类型
└── core/             # 核心系统
    ├── Sandbox.ts     # 安全沙箱
    ├── UIAgent.ts     # UI Agent
    └── UIOperation.ts # UI 操作定义
```

---

## Terminal — 终端管理

### 导入

```typescript
import { Terminal, ANSI, esc } from '@organic/ui';
```

### 方法

#### `Terminal.init(config?)`

初始化终端管理器，自动检测终端能力。

```typescript
const terminal = Terminal.init({
  mouse: 'on',
  colorDepth: 'truecolor',
  width: 120,
  height: 40,
});
```

#### `Terminal.get()`

获取终端单例。

```typescript
const terminal = Terminal.get();
```

#### `terminal.isAvailable(feature)`

检查特定功能是否可用。

```typescript
terminal.isAvailable('mouse'); // boolean
terminal.isAvailable('trueColor'); // boolean
terminal.isAvailable('unicode'); // boolean
terminal.isAvailable('emoji'); // boolean
```

#### `terminal.enable(feature)` / `terminal.disable(feature)`

启用/禁用终端功能。

```typescript
terminal.enable('mouse');
terminal.disable('unicode');
```

#### `terminal.updateConfig(config)`

批量更新配置。

```typescript
terminal.updateConfig({
  mouse: 'off',
  unicode: 'on',
  colorDepth: '256',
});
```

### 属性

| 属性         | 类型                | 说明         |
| ------------ | ------------------- | ------------ |
| `features`   | `TerminalFeatures`  | 终端能力报告 |
| `dimensions` | `{ width, height }` | 终端尺寸     |
| `colorDepth` | `ColorDepth`        | 颜色深度     |
| `config`     | `FeatureConfig`     | 当前配置     |

---

## Screen — 屏幕管理

### 导入

```typescript
import { Screen, createScreen, inAlternateScreen } from '@organic/ui';
```

### 方法

#### `new Screen(terminal?)`

创建屏幕实例。

```typescript
const screen = new Screen();
// 或指定终端
const screen = new Screen(terminal);
```

#### `screen.enterAltScreen()` / `screen.exitAltScreen()`

进入/退出交替屏幕。

```typescript
screen.enterAltScreen();
// ... 在交替屏幕中渲染
screen.exitAltScreen();
```

#### `screen.hideCursor()` / `screen.showCursor()`

控制光标显示。

```typescript
screen.hideCursor();
screen.showCursor();
```

#### `screen.moveTo(x, y)`

移动光标到指定位置。

```typescript
screen.moveTo(10, 5);
```

#### `screen.moveUp(n?)` / `screen.moveDown(n?)` / `screen.moveLeft(n?)` / `screen.moveRight(n?)`

相对移动光标。

```typescript
screen.moveUp(3);
screen.moveDown(2);
screen.moveLeft(1);
screen.moveRight(4);
```

#### `screen.clear()` / `screen.clearLine()` / `screen.clearDown()`

清屏操作。

```typescript
screen.clear(); // 清空整个屏幕
screen.clearLine(); // 清除当前行
screen.clearDown(); // 清除光标以下
```

#### `screen.write(text)`

写入文本到屏幕。

```typescript
screen.write('Hello, World!');
```

#### `screen.saveCursor()` / `screen.restoreCursor()`

保存/恢复光标位置。

---

## Theme — 主题系统

### 导入

```typescript
import { defaultTheme, lowColorTheme, noneTheme, createAutoTheme, createTheme } from '@organic/ui';
```

### 预定义主题

| 主题            | 说明       | 适用场景                      |
| --------------- | ---------- | ----------------------------- |
| `defaultTheme`  | 默认主题   | 支持 Unicode 和真彩色的终端   |
| `lowColorTheme` | 低色彩主题 | 256 色终端，禁用 Unicode 前缀 |
| `noneTheme`     | 无色主题   | 不支持颜色或 Unicode 的终端   |

### 自定义主题

```typescript
const theme = createTheme({
  primaryColor: 'blue',
  successColor: 'green',
  errorColor: 'red',
  infoPrefix: 'INFO',
  successPrefix: 'OK',
  useUnicodePrefixes: false,
});
```

### 自动主题

```typescript
const theme = createAutoTheme();
// 自动根据终端能力选择最佳主题
```

---

## Output — 格式化输出

### 导入

```typescript
import { Output, createOutput, defaultOutput } from '@organic/ui';
```

### 方法

| 方法                            | 说明                     | 示例                            |
| ------------------------------- | ------------------------ | ------------------------------- |
| `heading(text)`                 | 标题输出                 | `output.heading('Section')`     |
| `subheading(text)`              | 子标题输出               | `output.subheading('Sub')`      |
| `info(text)`                    | 信息输出                 | `output.info('Message')`        |
| `success(text)`                 | 成功输出                 | `output.success('Done')`        |
| `warn(text)`                    | 警告输出                 | `output.warn('Caution')`        |
| `error(text)`                   | 错误输出                 | `output.error('Failed')`        |
| `debug(text)`                   | 调试输出（verbose 模式） | `output.debug('Detail')`        |
| `keyValue(key, value, indent?)` | 键值对                   | `output.keyValue('CPU', '45%')` |
| `bullet(text, indent?)`         | 无序列表                 | `output.bullet('Item')`         |
| `numbered(n, text, indent?)`    | 有序列表                 | `output.numbered(1, 'First')`   |
| `divider(width?)`               | 分隔线                   | `output.divider(80)`            |
| `newline()`                     | 空行                     | `output.newline()`              |
| `plain(text)`                   | 纯文本                   | `output.plain('Text')`          |
| `log(level, message)`           | 通用日志                 | `output.log('info', 'Msg')`     |
| `setVerbose(verbose)`           | 设置 verbose 模式        | `output.setVerbose(true)`       |

---

## Spinner — 加载动画

### 导入

```typescript
import { Spinner, createSpinner, withSpinner } from '@organic/ui';
```

### 方法

| 方法                      | 说明           |
| ------------------------- | -------------- |
| `start(text?)`            | 启动 Spinner   |
| `stop()`                  | 停止 Spinner   |
| `succeed(text?)`          | 成功完成       |
| `fail(text?)`             | 失败完成       |
| `warn(text?)`             | 警告完成       |
| `info(text?)`             | 信息提示完成   |
| `setText(text)`           | 更新文本       |
| `stopAndPersist(options)` | 停止并保留输出 |

### 示例

```typescript
const spinner = new Spinner({ text: 'Installing...', color: 'green' });
spinner.start();

// 执行操作...
spinner.setText('Compiling...');

// 完成
spinner.succeed('Installation complete');
```

### withSpinner

```typescript
const result = await withSpinner('Processing', async () => {
  // 耗时操作
  return 'done';
});
```

---

## Banner — 横幅展示

### 导入

```typescript
import { Banner, createBanner, defaultBanner } from '@organic/ui';
```

### `banner.render(config)`

```typescript
const output = banner.render({
  title: 'My Application', // 标题
  version: '1.0.0', // 版本号
  subtitle: 'AI-powered UI', // 副标题
  description: 'Description...', // 描述
  style: 'double', // 'simple' | 'box' | 'double' | 'rounded'
  align: 'center', // 'left' | 'center'
  width: 70, // 宽度
});
```

### `banner.heading(text)`

```typescript
const output = banner.heading('Section Title');
```

### `banner.print(config)`

直接输出到终端。

---

## Box — 结构化盒子

### 导入

```typescript
import { Box, createBox, defaultBox } from '@organic/ui';
```

### `box.render(config)`

```typescript
const output = box.render({
  title: 'System Info', // 标题
  content: [
    // 内容行
    'CPU: 45%',
    'Memory: 60%',
  ],
  style: 'single', // 'single' | 'double' | 'rounded' | 'bold' | 'dashed'
  align: 'center', // 'left' | 'center'
  width: 50, // 宽度
  padding: 1, // 内边距
});
```

### `box.renderKeyValue(entries, config?)`

```typescript
const output = box.renderKeyValue(
  [
    ['Name', 'Organic Interface'],
    ['Version', '0.1.0'],
    ['Status', 'Running'],
  ],
  { title: 'App Info', style: 'rounded' }
);
```

### `box.print(config)`

直接输出到终端。

---

## 交互式会话层（InputBox / History / SlashCommand / ChatSession）

面向主流 agent CLI 工具（如 Claude Code、Cursor CLI、gh copilot）交互体验的会话层。它们全部是无 I/O 的纯状态机，通过 `KeyEvent` 驱动、返回事件，便于单测与未来 WebUI 复用。

### 导入

```typescript
import {
  ChatSession,
  createChatSession,
  InputBox,
  History,
  SlashCommandRegistry,
  slashCommand,
  renderMessage,
  renderRichText,
  renderStatusLine,
} from '@organic/ui';
```

### ChatSession — 会话编排

协调输入框、历史与斜杠命令，输出格式化消息。

```typescript
const session = createChatSession({
  name: 'organic',
  onUserMessage: async content => {
    // 业务处理（调用 Agent / 工具链）...
    return '处理完成';
  },
  // output: line => process.stdout.write(line + '\n'),
});

// 无 I/O 入口：适合测试与 headless 调用
session.feedKey({ name: 'h', char: 'h' });
await session.consume('/help');

// 有 I/O 入口：TTY raw 模式（↑/↓ 历史、Tab 补全、Ctrl-C 退出），
// 非 TTY 回退为逐行读取
// await session.start();
```

`consume(line)` 处理一行输入：`/...` 走斜杠命令，其余作为用户消息回调 `onUserMessage`。返回 `'continue' | 'exit'`。

### InputBox — 行编辑器

含光标移动、`Home`/`End`、`Ctrl-A/E/U/K/W` 绑定、`↑/↓` 历史、`Tab` 补全。以 `handleKey()` 喂入按键，返回 `InputBoxEvent`。

```typescript
const box = new InputBox({
  prompt: 'organic> ',
  history: new History(),
  complete: buffer => (buffer.startsWith('/') ? ['/help', '/history'] : []),
});

box.setValue('rm -rf /tmp/x', 13);
box.handleKey({ name: 'w', ctrl: true }); // 删除前一个词 → 'rm -rf /tmp/'
box.handleKey({ name: 'a', ctrl: true }); // 移动到行首
box.handleKey({ name: 'tab' }); // 补全 / 触发 complete 菜单
box.handleKey({ name: 'return' }); // { type: 'submit', value }
```

事件类型：`change`（内容/光标变化）、`submit`（回车提交）、`complete`（多候选菜单）、`history`（历史导航）、`none`（无操作或忽略）。

### History — 命令历史

带大小上限、去重、导航游标与可选持久化。

```typescript
const history = new History({ max: 1000, filePath: '~/.config/organic/history' });
history.push('list projects');
history.previous(''); // 上一条；未记录 draft 时自动暂存当前输入
history.next(); // 下一条 / 恢复 draft
```

### SlashCommand — 斜杠命令

集中注册、解析（`/name args...`）、执行；支持别名、隐藏、补全与列表。

```typescript
const slash = new SlashCommandRegistry();

slash.register(
  slashCommand('exit', '退出会话', ctx => ({ exit: true, output: '再见！' }), {
    aliases: ['quit', 'q'],
  })
);

slash.isSlash('/exit'); // true
slash.parse('/model fast big'); // { kind:'command', command:'model', args:'fast big', ... }
slash.complete('/ex'); // ['/exit']
slash.list(); // SlashCommandDefinition[]
await slash.run('/model fast big');
```

`slashCommand(name, description, handler, options?)` 返回标准定义。`ChatSession` 内置 `baseSlashCommands()`：`/help` `/clear` `/exit` `/history`，业务命令通过 `session.registerSlash(...)` 追加。

### render — 格式化输出

纯字符串渲染函数，使用主题着色：

| 函数                   | 作用                                 |
| ---------------------- | ------------------------------------ |
| `renderMessage`        | 完整消息框（角色徽标 + 富文本内容）  |
| `renderRichText`       | 轻量 Markdown：代码块/标题/列表/行内 |
| `renderCodeBlock`      | 带语言头的边框代码块                 |
| `renderCommandMenu`    | 斜杠命令帮助/补全菜单                |
| `renderCompletionMenu` | Tab 补全候选菜单                     |
| `renderStatusLine`     | 三段式状态栏（左中右/居中/右对齐）   |
| `roleBadge`            | 角色徽标（`[You]`/`[AI]`/`[Tool]`）  |

````typescript
const out = renderRichText('Use `npm i`, then **restart**:\n```ts\nlet x = 1\n```', theme);
const status = renderStatusLine(
  { left: 'organic v0.1.0', middle: "type '/help'", right: '3 msgs' },
  theme,
  80
);
````

单测覆盖：`packages/ui/src/tui/__tests__/`（InputBox / History / SlashCommand / render）。

---

## Prompt — 交互式提示

### 导入

```typescript
import { Prompt, createPrompt } from '@organic/ui';
```

### 方法

#### `prompt.formatPrompt(config)`

格式化提示文本（用于非交互环境）。

```typescript
const formatted = prompt.formatPrompt({
  type: 'text',
  message: '请输入姓名：',
  defaultValue: '张三',
  required: true,
});
```

#### `prompt.renderText(message, options?)`

同步文本输入。

```typescript
const name = prompt.renderText('输入名称：', { required: true });
```

#### `prompt.renderPassword(message, options?)`

同步密码输入。

```typescript
const password = prompt.renderPassword('输入密码：');
```

#### `prompt.renderConfirm(message, defaultValue?)`

同步确认。

```typescript
const confirmed = prompt.renderConfirm('继续？', false);
```

#### `prompt.renderSelect(message, options)`

同步选择。

```typescript
const theme = prompt.renderSelect('选择主题：', [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]);
```

#### `prompt.renderMultiselect(message, options)`

同步多选。

```typescript
const notifications = prompt.renderMultiselect('选择通知方式：', [
  { value: 'email', label: '邮件' },
  { value: 'sms', label: '短信' },
  { value: 'push', label: '推送' },
]);
```

### 提示类型

| 类型          | 说明     | 返回值     |
| ------------- | -------- | ---------- |
| `text`        | 文本输入 | `string`   |
| `password`    | 密码输入 | `string`   |
| `confirm`     | 确认     | `boolean`  |
| `select`      | 单选     | `string`   |
| `multiselect` | 多选     | `string[]` |

---

## Progress — 进度条

### 导入

```typescript
import { Progress, createProgress, showProgress } from '@organic/ui';
```

### 方法

| 方法            | 说明                 |
| --------------- | -------------------- |
| `update(value)` | 更新进度到指定值     |
| `increment(n?)` | 递增进度             |
| `complete()`    | 完成进度             |
| `getState()`    | 获取进度状态         |
| `start()`       | 启动（spinner 模式） |
| `stop()`        | 停止（spinner 模式） |

### 示例

```typescript
const progress = new Progress({ total: 100, label: '下载', style: 'bar' });

progress.update(30); // 30%
progress.update(60); // 60%
progress.update(100); // 完成

const state = progress.getState();
// { current: 100, total: 100, percentage: 100, completed: true }
```

### 进度样式

| 样式         | 说明       |
| ------------ | ---------- |
| `bar`        | 进度条     |
| `spinner`    | 旋转动画   |
| `dots`       | 点状动画   |
| `percentage` | 百分比数字 |

---

## Table — 数据表格

### 导入

```typescript
import { Table, createTable, renderTable } from '@organic/ui';
```

### 方法

| 方法                      | 说明         |
| ------------------------- | ------------ |
| `addRow(row)`             | 添加一行     |
| `addRows(rows)`           | 批量添加     |
| `setRows(rows)`           | 替换所有行   |
| `sort(column, direction)` | 排序         |
| `filter(predicate)`       | 筛选         |
| `clear()`                 | 清空         |
| `render()`                | 渲染为字符串 |
| `getSortConfig()`         | 获取排序配置 |

### 示例

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  [key: string]: unknown;
}

const columns: TableColumn<User>[] = [
  { key: 'id', header: 'ID', width: 5 },
  { key: 'name', header: '姓名', width: 15 },
  { key: 'email', header: '邮箱', width: 30 },
];

const table = new Table<User>(columns, { title: '用户列表' });
table.addRows([
  { id: 1, name: '张三', email: 'zhang@test.com' },
  { id: 2, name: '李四', email: 'li@test.com' },
]);

table.sort('name', 'asc');
table.filter(row => row.id > 0);

const output = table.render();
```

### 列配置

| 属性     | 类型                            | 说明       |
| -------- | ------------------------------- | ---------- |
| `key`    | `string`                        | 数据键名   |
| `header` | `string`                        | 列标题     |
| `width`  | `number`                        | 列宽       |
| `align`  | `'left' \| 'center' \| 'right'` | 对齐方式   |
| `format` | `(value: unknown) => string`    | 格式化函数 |

### 辅助函数

```typescript
// 快速渲染数据
const output = renderTable(data, ['id', 'name', 'role']);
```

---

## Mouse — 鼠标事件

### 导入

```typescript
import { MouseHandler, createMouseHandler } from '@organic/ui';
```

### 事件类型

| 事件        | 说明         |
| ----------- | ------------ |
| `click`     | 单击         |
| `dblclick`  | 双击         |
| `mousedown` | 按下         |
| `mouseup`   | 释放         |
| `mousemove` | 移动         |
| `drag`      | 拖拽         |
| `wheel`     | 滚轮         |
| `scroll`    | 滚动         |
| `data`      | 键盘输入转发 |
| `*`         | 所有事件     |

### 示例

```typescript
const mouse = new MouseHandler();

mouse.on('click', (ev: MouseEvent) => {
  console.log(`点击: button=${ev.button}, x=${ev.x}, y=${ev.y}`);
});

mouse.on('dblclick', (ev: MouseEvent) => {
  console.log('双击');
});

mouse.on('drag', (ev: MouseEvent) => {
  console.log(`拖拽到: x=${ev.x}, y=${ev.y}`);
});

mouse.on('wheel', (ev: MouseEvent) => {
  console.log(`滚轮: ${ev.button}`); // wheelUp | wheelDown
});

mouse.start();
// ... 鼠标事件处理中 ...
mouse.stop();
```

---

## ANSI 转义序列

### 导入

```typescript
import { ANSI, esc } from '@organic/ui';
```

### 常用序列

| 常量                                                  | 说明          |
| ----------------------------------------------------- | ------------- |
| `ANSI.mouseOn` / `mouseOff`                           | 鼠标启用/禁用 |
| `ANSI.altScreenOn` / `altScreenOff`                   | 交替屏幕      |
| `ANSI.cursorShow` / `cursorHide`                      | 光标显示/隐藏 |
| `ANSI.clearScreen`                                    | 清屏          |
| `ANSI.saveCursor` / `restoreCursor`                   | 保存/恢复光标 |
| `ANSI.eraseLine` / `eraseDown`                        | 擦除行/下行   |
| `ANSI.reset`                                          | 重置          |
| `ANSI.bold` / `dim` / `italic` / `underline`          | 文本样式      |
| `ANSI.blink` / `inverse` / `hidden` / `strikethrough` | 文本效果      |

### 移动序列

| 方法                    | 说明       |
| ----------------------- | ---------- |
| `ANSI.moveTo(row, col)` | 移动到坐标 |
| `ANSI.up(n?)`           | 向上移动   |
| `ANSI.down(n?)`         | 向下移动   |
| `ANSI.right(n?)`        | 向右移动   |
| `ANSI.left(n?)`         | 向左移动   |

### 自定义序列

```typescript
const seq = esc('2J'); // → '\x1b[2J'
```

---

## 相关文档

- [CLI 参考](./cli-reference.md) — CLI 命令系统
- [配置参考](./configuration.md) — 组件配置选项
- [常见工作流](./common-workflows.md) — 使用示例
