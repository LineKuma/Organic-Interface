# Task: UI Package Test Coverage Improvement

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P1-003-ui-test-coverage |
| **优先级** | P1 |
| **标题** | 提升UI包测试覆盖 |
| **描述** | 为@organic/ui包增加单元测试，提高测试覆盖率，解决测试不均衡问题 |
| **任务类型** | code-modification |
| **依赖任务** | 无 |
| **可并行** | 否 |
| **创建时间** | 2026-05-12 |
| **执行分支** | agent-develop |
| **项目路径** | projects/Organic-Interface |

---

## 任务背景

### 问题说明

根据项目分析（来源：`organic-interface-analysis-summary.md`）：

| 问题 | 优先级 | 证据 |
|------|--------|------|
| ui包测试覆盖不足 | P1 | vitest.config.ts:17 显示ui包测试较少 |
| 部分包缺少测试配置 | P1 | agent, storage, tools, ui, utils的package.json中test脚本显示"No tests configured" |

### 当前状态

- ui包位于 `packages/ui/`
- 已有的测试文件数量较少
- 需要增加测试用例覆盖核心功能

### 目标

将ui包的测试覆盖率提升至与项目中其他包（如kernel、agent）相当的水平

---

## 任务内容

### 步骤1：分析ui包结构和测试现状

**分析内容**:
- 列出 `packages/ui/src/` 下的所有源文件
- 列出 `packages/ui/` 下的现有测试文件
- 识别需要测试的核心模块

**关键文件**:
- `packages/ui/src/index.ts` - 包入口
- `packages/ui/src/` 下的主要模块文件

### 步骤2：识别需要测试的核心功能

**测试优先级**:
1. 核心导出函数/类
2. CLI命令处理
3. 界面渲染逻辑
4. 用户交互处理

### 步骤3：编写单元测试

**测试文件位置**: `packages/ui/src/__tests__/` 或 `packages/ui/src/**/*.test.ts`

**测试要求**:
- 使用Vitest测试框架
- 遵循项目现有测试风格
- 每个测试文件对应一个源文件
- 测试覆盖：正常路径、边界条件、错误处理

### 步骤4：运行测试验证

**验证步骤**:
1. 运行 `pnpm test --filter=@organic/ui` 运行ui包测试
2. 检查测试是否全部通过
3. 检查测试覆盖率报告

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `projects/Organic-Interface/packages/ui/src/*.ts` | 源代码文件 |
| `projects/Organic-Interface/packages/ui/package.json` | 包配置 |
| `projects/Organic-Interface/vitest.config.ts` | Vitest配置 |
| `projects/Organic-Interface/packages/*/src/**/*.test.ts` | 其他包的测试参考 |

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `packages/ui/src/**/*.test.ts` | 新增测试文件 |

---

## 验收标准

### 测试文件

- [ ] 新增测试文件已创建
- [ ] 测试文件数量与源文件数量匹配
- [ ] 测试文件遵循项目命名规范

### 测试覆盖

- [ ] 核心导出函数/类已测试
- [ ] CLI命令处理已测试
- [ ] 错误处理已测试
- [ ] 边界条件已测试

### 测试执行

- [ ] `pnpm test --filter=@organic/ui` 执行成功
- [ ] 所有测试通过
- [ ] 覆盖率报告生成

---

## 失败处理

1. **测试失败**: 分析失败原因，修复测试或修复代码
2. **覆盖率不足**: 增加更多测试用例
3. **依赖问题**: 检查import路径是否正确

---

## 回滚方案

1. 删除新增的测试文件
2. 使用 `git checkout -- <file>` 恢复

---

## 后置任务

- 更新知识库，记录测试编写经验
- 检查其他包的测试覆盖是否需要补充
