# 模块依赖关系

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 创建日期 | 2026-04-21 |
| 作者 | Learner |
| 描述 | Organic-Interface 项目各模块依赖关系图 |

---

## 1. 依赖关系概览

```
                    ┌─────────────────┐
                    │  @organic/ui    │
                    │  (展示层)        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  @organic/agent  │
                    │  (业务层)        │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│  @organic/tools  │ │   @organic/    │ │  @organic/      │
│  (工具层)        │ │   plugins       │ │  storage        │
│                  │ │  (插件层)       │ │  (存储层)        │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │  @organic/kernel │
                    │  (内核层)        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  @organic/utils  │
                    │  (基础层)        │
                    └─────────────────┘
```

---

## 2. 依赖详情

### 2.1 @organic/utils (基础层)

**依赖**: 无

**被依赖**:
- @organic/kernel
- @organic/plugins
- @organic/storage
- @organic/tools
- @organic/agent
- @organic/ui

**说明**: 所有模块都依赖 utils，作为基础类型和工具的提供方。

---

### 2.2 @organic/kernel (内核层)

**依赖**:
- @organic/utils

**被依赖**:
- @organic/plugins
- @organic/storage
- @organic/tools
- @organic/agent
- @organic/ui

**说明**: Kernel 是核心运行时，提供插件管理、生命周期管理、事件总线等核心功能。

---

### 2.3 @organic/plugins (插件层)

**依赖**:
- @organic/utils
- @organic/kernel

**被依赖**:
- @organic/agent
- @organic/ui

**说明**: 插件系统依赖 Kernel 的核心功能，扩展插件加载、注册、生命周期管理。

---

### 2.4 @organic/storage (存储层)

**依赖**:
- @organic/utils
- @organic/kernel

**被依赖**:
- @organic/agent
- @organic/ui

**说明**: 存储系统依赖 Kernel 的事件和日志功能，支持多种存储后端。

---

### 2.5 @organic/tools (工具层)

**依赖**:
- @organic/utils
- @organic/kernel

**被依赖**:
- @organic/agent
- @organic/ui

**说明**: 工具系统依赖 Kernel 的工具执行和插件管理功能。

---

### 2.6 @organic/agent (业务层)

**依赖**:
- @organic/utils
- @organic/kernel
- @organic/plugins
- @organic/tools

**被依赖**:
- @organic/ui

**说明**: Agent 模块整合所有底层功能，提供高级业务逻辑。

---

### 2.7 @organic/ui (展示层)

**依赖**:
- @organic/utils
- @organic/kernel
- @organic/plugins
- @organic/tools
- @organic/agent

**被依赖**: 无

**说明**: UI 模块依赖所有其他模块，是应用层展示。

---

## 3. package.json 依赖配置

### 3.1 @organic/utils

```json
{
  "name": "@organic/utils",
  "dependencies": {}
}
```

---

### 3.2 @organic/kernel

```json
{
  "name": "@organic/kernel",
  "dependencies": {
    "@organic/utils": "workspace:*"
  }
}
```

---

### 3.3 @organic/plugins

```json
{
  "name": "@organic/plugins",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*"
  }
}
```

---

### 3.4 @organic/storage

```json
{
  "name": "@organic/storage",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*"
  }
}
```

---

### 3.5 @organic/tools

```json
{
  "name": "@organic/tools",
  "dependencies": {
    "@organic/kernel": "workspace:*",
    "@organic/utils": "workspace:*"
  }
}
```

---

### 3.6 @organic/agent

```json
{
  "name": "@organic/agent",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*",
    "@organic/plugins": "workspace:*",
    "@organic/tools": "workspace:*"
  }
}
```

---

### 3.7 @organic/ui

```json
{
  "name": "@organic/ui",
  "dependencies": {
    "@organic/utils": "workspace:*",
    "@organic/kernel": "workspace:*",
    "@organic/plugins": "workspace:*",
    "@organic/tools": "workspace:*",
    "@organic/agent": "workspace:*"
  }
}
```

---

## 4. 依赖管理注意事项

### 4.1 循环依赖检查

当前架构无循环依赖，层级关系清晰：
```
utils → kernel → plugins/storage/tools → agent → ui
```

### 4.2 工作区依赖版本

所有内部包使用 `workspace:*` 协议，确保使用最新版本。

### 4.3 构建顺序

根据 Turbo 配置 (`turbo.json`):

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

**构建顺序**:
1. @organic/utils (无依赖)
2. @organic/kernel (依赖 utils)
3. @organic/plugins, @organic/storage, @organic/tools (依赖 kernel)
4. @organic/agent (依赖上面所有)
5. @organic/ui (依赖上面所有)

---

## 5. 依赖层数统计

| 模块 | 依赖数量 | 被依赖数量 | 层级 |
|------|----------|------------|------|
| @organic/utils | 0 | 6 | 基础层 |
| @organic/kernel | 1 | 5 | 内核层 |
| @organic/plugins | 2 | 2 | 功能层 |
| @organic/storage | 2 | 2 | 功能层 |
| @organic/tools | 2 | 2 | 功能层 |
| @organic/agent | 4 | 1 | 业务层 |
| @organic/ui | 5 | 0 | 展示层 |

---

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-21 | 1.0.0 | 初始版本，记录模块依赖关系 |