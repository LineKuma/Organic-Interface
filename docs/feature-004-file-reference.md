# 功能文档：文件引用功能

## 基本信息

**文档编号**: DOC-004
**所属模块**: 上下文管理
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 2.4

---

## 功能概述

文件引用功能支持在对话中直接引用项目代码文件，AI能够理解引用文件的上下文内容并进行针对性分析。系统自动维护文件与对话的关联关系，支持多文件同时引用和跨文件依赖分析。

---

## 用户价值

- **提升问答准确性**：大幅提升代码问答的准确性，引用特定文件后AI的回答基于实际代码
- **多文件支持**：针对复杂模块可同时引用多个相关文件
- **精确定位**：支持代码片段的直接定位和跳转
- **历史追溯**：历史引用记录便于回溯分析过程

---

## 技术实现要点

### 系统组件

由三个核心组件构成：

| 组件 | 职责 | 核心能力 |
|------|------|----------|
| 解析器 | 读取文件内容并进行预处理 | 支持主流编程语言语法识别 |
| 索引器 | 建立文件符号索引 | 支持快速定位和依赖分析 |
| 上下文管理器 | 管理对话中的引用状态 | 实现增量更新和缓存管理 |

---

## 功能规格

### 核心功能

1. **文件引用**
   - 支持通过路径或选择引用文件
   - 自动识别文件类型和编码
   - 文件内容加载和解析

2. **多文件管理**
   - 支持单个对话同时引用多个文件
   - 文件分组和标签管理
   - 文件引用历史记录

3. **代码解析**
   - 支持常见编程语言的语法识别
   - 提取代码结构信息（函数、类、变量）
   - 依赖关系分析

### 扩展功能

1. **快速跳转**
   - 从对话直接跳转到源文件
   - 支持行号定位
   - 代码片段高亮

2. **变更检测**
   - 文件变更后自动更新引用内容
   - 变更通知和对比
   - 增量解析更新

3. **搜索增强**
   - 引用文件内全文搜索
   - 符号快速定位
   - 搜索历史

---

## 支持的编程语言

| 语言 | 扩展名 | 解析支持 |
|------|--------|----------|
| JavaScript | .js, .jsx | 函数、类、导入导出 |
| TypeScript | .ts, .tsx | 接口、类型、泛型 |
| Python | .py | 函数、类、装饰器 |
| Java | .java | 类、方法、包 |
| Go | .go | 函数、结构体、包 |
| Rust | .rs | 结构体、trait、模块 |
| C/C++ | .c, .cpp, .h | 函数、结构体 |
| HTML | .html, .htm | 标签、属性 |
| CSS | .css, .scss | 选择器、规则 |
| JSON | .json | 键值结构 |
| Markdown | .md | 标题、链接 |

---

## 验收条件

| 序号 | 验收项 | 验收标准 |
|------|--------|----------|
| 1 | 语言支持 | 支持常见编程语言的代码解析 |
| 2 | 并发引用 | 单个对话支持至少20个文件同时引用 |
| 3 | 变更检测 | 文件变更后自动更新引用内容 |
| 4 | 快速跳转 | 支持从对话直接跳转到源文件 |
| 5 | 解析性能 | 引用解析时间控制在1秒以内 |

---

## 引用语法

### 在对话中引用文件

```
@file:src/utils/helper.ts
@file:src/components/Button.tsx:10-20  // 指定行号范围
@file:src/**/*.service.ts  // 通配符匹配
```

### 引用特定符号

```
@symbol:getUserById  // 引用特定函数
@class:UserService  // 引用特定类
```

---

## 接口设计

### 文件引用API

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/references | GET | 获取当前对话的引用列表 |
| /api/references | POST | 添加文件引用 |
| /api/references/:id | DELETE | 移除文件引用 |
| /api/references/:id/content | GET | 获取引用文件内容 |
| /api/references/parse | POST | 解析文件内容 |
| /api/references/symbols | GET | 获取文件符号列表 |

### 请求示例

```json
// 添加文件引用
POST /api/references
{
  "conversation_id": "conv_123",
  "file_path": "src/services/user.ts",
  "line_range": {"start": 1, "end": 50},
  "symbols": ["getUserById", "createUser"]
}
```

---

## 数据模型

### FileReference

```typescript
interface FileReference {
  id: string;
  conversation_id: string;
  file_path: string;
  file_hash: string;
  line_range?: { start: number; end: number };
  symbols: string[];
  added_at: Date;
  last_accessed: Date;
}
```

### ParsedFile

```typescript
interface ParsedFile {
  path: string;
  language: string;
  encoding: string;
  symbols: Symbol[];
  imports: Import[];
  exports: Export[];
  dependencies: string[];
  parsed_at: Date;
}
```

### Symbol

```typescript
interface Symbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'constant';
  line_number: number;
  visibility: 'public' | 'private' | 'protected';
  signature?: string;
  documentation?: string;
}
```

---

## 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| max_files_per_conversation | 50 | 单个对话最大引用数 |
| max_file_size | 1048576 | 最大文件大小(字节) |
| parse_timeout | 5000 | 解析超时(ms) |
| cache_ttl | 3600 | 缓存有效期(秒) |
| watch_file_changes | true | 监听文件变化 |

---

## 相关文档

- 支持语言列表
- 符号解析规范
- 上下文管理设计
