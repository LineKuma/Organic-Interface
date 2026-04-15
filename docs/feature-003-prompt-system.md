# 功能文档：高度自定义提示词系统

## 基本信息

**文档编号**: DOC-003
**所属模块**: 提示词管理
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 2.3

---

## 功能概述

提示词系统是AI助手的核心配置模块，支持用户自定义各类场景的提示词模板。系统提供版本管理功能，支持提示词的版本历史查看、版本对比和一键回滚。模板引擎支持动态变量、条件判断和循环等高级语法。

---

## 用户价值

- **深度定制能力**：赋予用户深度定制AI行为的能力
- **统一代码规范**：用户可根据项目特点定制专属的代码风格和规范
- **团队协作**：团队可统一管理代码审查标准和反馈模板
- **版本管理**：提示词变更支持版本管理，降低误操作风险
- **高度复用**：变量机制使提示词模板具备高度复用性

---

## 技术实现要点

### 系统架构

三大核心模块：

| 模块 | 职责 | 核心能力 |
|------|------|----------|
| 模板引擎 | 模板解析和渲染 | 支持插值、条件块、循环 |
| 版本管理 | 版本存储和追踪 | Git风格的数据存储 |
| 变量解析器 | 运行时上下文替换 | 支持默认值和类型校验 |

### 模板语法

```markdown
# 基础语法示例

## 变量插值
Hello {{name}}, welcome to {{project}}!

## 条件判断
{{#if is_admin}}
您拥有管理员权限。
{{else}}
您是普通用户。
{{/if}}

## 循环遍历
{{#each items}}
- {{this.name}}: {{this.value}}
{{/each}}

## 默认值
User: {{user_name: "Anonymous"}}
```

---

## 功能规格

### 核心功能

1. **模板管理**
   - 创建、编辑、删除提示词模板
   - 模板分类和标签管理
   - 模板预览和即时测试

2. **版本控制**
   - 自动保存每次修改的快照
   - 版本历史查看和时间线展示
   - 版本对比（Diff视图）
   - 一键回滚到指定版本

3. **变量系统**
   - 内置变量和自定义变量
   - 变量类型定义和校验
   - 默认值设置
   - 变量引用嵌套

### 扩展功能

1. **模板市场**
   - 模板导入导出功能
   - 模板分享和收藏
   - 官方推荐模板

2. **智能提示**
   - 变量补全建议
   - 语法错误提示
   - 优化建议

---

## 模板类型分类

| 类型 | 用途 | 示例 |
|------|------|------|
| system_prompt | 系统级提示词 | AI角色定义 |
| user_prompt | 用户提示词 | 代码审查标准 |
| response_template | 响应模板 | 回复格式规范 |
| workflow_prompt | 工作流提示词 | 多步骤任务引导 |

---

## 验收条件

| 序号 | 验收项 | 验收标准 |
|------|--------|----------|
| 1 | CRUD操作 | 支持创建、编辑、删除提示词模板 |
| 2 | 版本历史 | 提供版本历史查看和对比功能 |
| 3 | 版本回滚 | 支持一键回滚到指定版本 |
| 4 | 变量解析 | 模板变量解析正确率不低于99% |
| 5 | 导入导出 | 支持模板导入导出功能 |

---

## 接口设计

### 模板API

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/templates | GET | 获取模板列表 |
| /api/templates | POST | 创建新模板 |
| /api/templates/:id | GET | 获取模板详情 |
| /api/templates/:id | PUT | 更新模板 |
| /api/templates/:id | DELETE | 删除模板 |
| /api/templates/:id/versions | GET | 获取版本历史 |
| /api/templates/:id/rollback | POST | 回滚到指定版本 |
| /api/templates/:id/render | POST | 渲染预览 |

### 请求示例

```json
// 创建模板
POST /api/templates
{
  "name": "code_review_prompt",
  "type": "user_prompt",
  "content": "请审查以下代码:\n{{#each files}}\n- {{this.path}}\n{{/each}}",
  "variables": [
    {"name": "files", "type": "array", "required": true}
  ],
  "tags": ["review", "security"]
}
```

---

## 数据模型

### Template

```typescript
interface Template {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
  variables: Variable[];
  tags: string[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
  version: number;
}
```

### TemplateVersion

```typescript
interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  content: string;
  variables: Variable[];
  change_summary: string;
  created_at: Date;
  created_by: string;
}
```

### Variable

```typescript
interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default_value?: any;
  description?: string;
  validation?: string;
}
```

---

## 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| max_templates | 1000 | 最大模板数量 |
| max_version_history | 50 | 最大版本历史数 |
| auto_save_interval | 30000 | 自动保存间隔(ms) |
| enable_version_control | true | 启用版本控制 |

---

## 相关文档

- 模板语法参考文档
- 变量类型规范
- 版本控制设计说明
