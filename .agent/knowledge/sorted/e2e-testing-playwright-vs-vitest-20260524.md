# E2E Testing: Playwright vs Vitest for Library/Package Systems

## 知识分类

- **主题**: 测试框架选择
- **适用场景**: 库/包系统(Library/Package System)的端到端测试
- **创建时间**: 2026-05-24
- **来源任务**: task-E2E-FIX-20260524

---

## 背景

Organic-Interface 项目是一个 monorepo 结构，包含 kernel、plugins、agent、storage 等多个包，最初使用 Playwright 进行 E2E 测试。

## 问题分析

### 为什么 Playwright 不适合库系统

| 问题 | 说明 |
|------|------|
| 架构不匹配 | Playwright 用于浏览器自动化测试，适合 Web 应用；库系统没有 HTTP 服务器 |
| 测试目标错误 | 需要测试的是包之间的接口调用，不是 UI 交互 |
| 依赖不必要服务 | Playwright 需要启动 dev 服务器，增加了测试复杂度 |
| 跨包集成无法验证 | Playwright 只能测试 UI 层面，无法直接验证包之间的 import 集成 |

### Playwright 的适用场景

- Web 应用（需要 HTTP 服务器）
- 需要浏览器环境测试
- UI 交互测试
- 端到端用户流程测试

## 正确方案：Vitest 直接 Import 测试

### 核心思想

对于库/包系统，应该使用单元测试方式验证包之间的接口调用，通过直接 import 测试跨包集成。

### 重构方案

| 原 Playwright 测试 | 目标 Vitest 测试 | 测试方式 |
|-------------------|-----------------|----------|
| agent-scheduling.spec.ts | 导入 kernel/agent 包测试调度逻辑 | 直接 import + 函数调用 |
| kernel-lifecycle.spec.ts | 导入 kernel 包测试生命周期 | 直接 import + 状态验证 |
| plugin-system.spec.ts | 导入 plugins 包测试插件系统 | 直接 import + 插件注册验证 |

### 优势

1. **无需 HTTP 服务器**：直接测试包 API
2. **跨包集成验证**：通过直接 import 测试包之间接口
3. **环境简单**：只需 Node.js 环境，无需浏览器
4. **测试速度快**：无浏览器启动开销
5. **更符合测试目标**：测试包之间的接口调用，而非 UI 交互

### 实施步骤

1. 删除 `playwright.config.ts`
2. 将 `e2e/*.spec.ts` 从 Playwright 格式改为 vitest 格式
3. 更新 `vitest.config.ts` 的 include 配置
4. 从 `package.json` 中移除 `@playwright/test` 依赖

---

## 总结

对于**库/包系统**（monorepo 结构，包含多个独立包），正确的 E2E 测试方案是：

- **使用 Vitest 直接 import 测试**
- **而非 Playwright Web UI 测试**

这遵循了测试金字塔原则：底层单元测试多、中层集成测试适量、顶层 E2E 测试少。对于库系统，"E2E" 更多指的是跨包集成测试，而非传统意义上的浏览器端到端测试。

---

*文档生成时间: 2026-05-24*
*来源: Organic-Interface E2E 测试重构经验*