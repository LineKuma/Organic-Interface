# 配置参考

## 基本信息

**文档类型**: 配置参考
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

Organic-Interface 采用多级配置覆盖机制，从低到高依次为：默认配置 → 系统配置 → 项目配置 → 用户配置 → 环境变量。配置系统基于 `@organic/utils` 的 ConfigManager 实现，支持运行时热更新和类型安全校验。

---

## 配置层级

### 优先级顺序

```
环境变量 (最高优先级)
    ↓ 覆盖
用户配置 (~/.organic/config.json)
    ↓ 覆盖
项目配置 (./.organic.json)
    ↓ 覆盖
系统配置 (/etc/organic/config.json)
    ↓ 覆盖
默认配置 (代码内置)
```

### 配置文件位置

| 层级     | 路径                       | 说明                 |
| -------- | -------------------------- | -------------------- |
| 默认     | 代码内置                   | 出厂默认值，不可修改 |
| 系统     | `/etc/organic/config.json` | 系统级配置           |
| 项目     | `./.organic.json`          | 项目根目录配置       |
| 用户     | `~/.organic/config.json`   | 用户个人配置         |
| 环境变量 | `ORGANIC_*`                | 运行时覆盖           |

---

## 沙箱配置

### SandboxConfig

沙箱安全配置，控制 UI 操作的安全策略。

| 参数                      | 类型                | 默认值                                       | 说明                   |
| ------------------------- | ------------------- | -------------------------------------------- | ---------------------- |
| `enabled`                 | `boolean`           | `true`                                       | 是否启用沙箱           |
| `permissionLevel`         | `UIPermissionLevel` | `'L2'`                                       | 默认权限级别           |
| `maxOperationsPerSession` | `number`            | `1000`                                       | 单会话最大操作数       |
| `maxOperationDuration`    | `number`            | `30000`                                      | 单操作最大耗时（毫秒） |
| `requireConfirmation`     | `boolean`           | `true`                                       | 敏感操作是否需要确认   |
| `enableRecording`         | `boolean`           | `true`                                       | 是否启用操作记录       |
| `allowedOperations`       | `UIOperationType[]` | 所有 9 种操作                                | 允许的操作列表         |
| `deniedOperations`        | `UIOperationType[]` | `[]`                                         | 禁止的操作列表         |
| `deniedPaths`             | `string[]`          | `['/etc', '/root', '/sys', '/proc', '/var']` | 禁止访问的路径         |

### 权限级别

| 级别 | 可执行操作                                             | 说明               |
| ---- | ------------------------------------------------------ | ------------------ |
| L1   | scroll, hover, wait, getText, getAttribute, screenshot | 只读操作，最低权限 |
| L2   | L1 + click, select                                     | 交互操作，默认级别 |
| L3   | L2 + input                                             | 可输入内容         |
| L4   | 所有操作                                               | 完全权限，仅管理员 |

---

## Agent 配置

### UIAgentConfig

| 参数                   | 类型            | 默认值       | 说明                 |
| ---------------------- | --------------- | ------------ | -------------------- |
| `agentId`              | `string`        | `'ui-agent'` | Agent 唯一标识       |
| `name`                 | `string`        | `'UIAgent'`  | Agent 显示名称       |
| `defaultTimeout`       | `number`        | `30000`      | 操作默认超时（毫秒） |
| `defaultRetryCount`    | `number`        | `3`          | 失败重试次数         |
| `autoConfirmSensitive` | `boolean`       | `false`      | 是否自动确认敏感操作 |
| `sandbox`              | `SandboxConfig` | 默认配置     | 沙箱配置             |

---

## CLI 配置

### CLIConfig

| 参数          | 类型      | 默认值                    | 说明             |
| ------------- | --------- | ------------------------- | ---------------- |
| `name`        | `string`  | `'organic-cli'`           | CLI 名称         |
| `version`     | `string`  | `'0.1.0'`                 | CLI 版本         |
| `description` | `string`  | `'Organic Interface CLI'` | CLI 描述         |
| `interactive` | `boolean` | `false`                   | 是否启用交互模式 |
| `historyPath` | `string`  | —                         | 命令历史文件路径 |

---

## 终端配置

### FeatureConfig

终端功能配置，控制 TUI 各项特性的启用/禁用。

| 参数              | 类型                                                      | 默认值   | 说明         |
| ----------------- | --------------------------------------------------------- | -------- | ------------ |
| `mouse`           | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 鼠标支持     |
| `unicode`         | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | Unicode 字符 |
| `emoji`           | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | Emoji 支持   |
| `trueColor`       | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 真彩色       |
| `colors256`       | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 256 色       |
| `alternateScreen` | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 交替屏幕     |
| `bracketedPaste`  | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 粘贴括号     |
| `focusEvents`     | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 焦点事件     |
| `cursorControl`   | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 光标控制     |
| `resizeEvents`    | `'auto' \| 'on' \| 'off'`                                 | `'auto'` | 尺寸变化事件 |
| `colorDepth`      | `'auto' \| 'truecolor' \| '256' \| '16' \| '8' \| 'none'` | `'auto'` | 颜色深度     |
| `width`           | `number`                                                  | 自动检测 | 终端宽度     |
| `height`          | `number`                                                  | 自动检测 | 终端高度     |

---

## 进度条配置

### ProgressConfig

| 参数    | 类型                                           | 默认值  | 说明       |
| ------- | ---------------------------------------------- | ------- | ---------- |
| `total` | `number`                                       | `100`   | 总步数     |
| `label` | `string`                                       | —       | 进度条标签 |
| `style` | `'bar' \| 'spinner' \| 'dots' \| 'percentage'` | `'bar'` | 显示样式   |

---

## 表格配置

### TableConfig

| 参数     | 类型      | 默认值 | 说明         |
| -------- | --------- | ------ | ------------ |
| `title`  | `string`  | —      | 表格标题     |
| `border` | `boolean` | `true` | 是否显示边框 |

---

## 提示配置

### PromptConfig

| 参数           | 类型                                                             | 默认值   | 说明                           |
| -------------- | ---------------------------------------------------------------- | -------- | ------------------------------ |
| `type`         | `'text' \| 'password' \| 'confirm' \| 'select' \| 'multiselect'` | `'text'` | 提示类型                       |
| `message`      | `string`                                                         | —        | 提示消息                       |
| `defaultValue` | `any`                                                            | —        | 默认值                         |
| `required`     | `boolean`                                                        | `false`  | 是否必填                       |
| `options`      | `SelectOption[]`                                                 | —        | 选项列表（select/multiselect） |

---

## Banner 配置

### BannerConfig

| 参数          | 类型                                         | 默认值     | 说明     |
| ------------- | -------------------------------------------- | ---------- | -------- |
| `title`       | `string`                                     | —          | 标题     |
| `subtitle`    | `string`                                     | —          | 副标题   |
| `version`     | `string`                                     | —          | 版本号   |
| `description` | `string`                                     | —          | 描述文本 |
| `style`       | `'simple' \| 'box' \| 'double' \| 'rounded'` | `'simple'` | 边框样式 |
| `align`       | `'left' \| 'center'`                         | `'left'`   | 对齐方式 |
| `width`       | `number`                                     | 自动检测   | 宽度     |

---

## Box 配置

### BoxConfig

| 参数      | 类型                                                      | 默认值     | 说明     |
| --------- | --------------------------------------------------------- | ---------- | -------- |
| `title`   | `string`                                                  | —          | 标题     |
| `content` | `string[]`                                                | —          | 内容行   |
| `style`   | `'single' \| 'double' \| 'rounded' \| 'bold' \| 'dashed'` | `'single'` | 边框样式 |
| `align`   | `'left' \| 'center'`                                      | `'left'`   | 对齐方式 |
| `width`   | `number`                                                  | 自动检测   | 宽度     |
| `padding` | `number`                                                  | `1`        | 内边距   |

---

## 环境变量

| 变量                       | 说明         | 默认值                   |
| -------------------------- | ------------ | ------------------------ |
| `ORGANIC_HOME`             | 安装目录     | 自动检测                 |
| `ORGANIC_CONFIG`           | 配置文件路径 | `~/.organic/config.json` |
| `ORGANIC_LOG_LEVEL`        | 日志级别     | `info`                   |
| `ORGANIC_NO_COLOR`         | 禁用颜色输出 | —                        |
| `ORGANIC_PERMISSION_LEVEL` | 默认权限级别 | `L2`                     |

---

## 配置示例

### 完整配置文件

```json
{
  "sandbox": {
    "enabled": true,
    "permissionLevel": "L2",
    "maxOperationsPerSession": 500,
    "requireConfirmation": true,
    "enableRecording": true,
    "deniedOperations": [],
    "deniedPaths": ["/etc", "/root"]
  },
  "agent": {
    "defaultTimeout": 30000,
    "defaultRetryCount": 3,
    "autoConfirmSensitive": false
  },
  "cli": {
    "name": "organic-cli",
    "interactive": true,
    "historyPath": "~/.organic/history"
  },
  "terminal": {
    "mouse": "auto",
    "unicode": "on",
    "colorDepth": "auto"
  }
}
```

---

## 相关文档

- [CLI 参考](./cli-reference.md) — 命令行接口
- [安全模型](./security-model.md) — 权限和安全配置
- [架构设计](./architecture.md) — 系统架构
