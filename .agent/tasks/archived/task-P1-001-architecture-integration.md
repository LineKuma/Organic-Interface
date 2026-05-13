# Task: Architecture Integration - 三层架构整合到核心文档

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P1-001-architecture-integration |
| **优先级** | P1 |
| **标题** | 三层架构设计整合到项目核心文档 |
| **描述** | 将用户提供的"内核层+外围模块化交互层+自定义层"三层架构设计严谨分析后整合到项目核心文档，建立架构与7个包的映射关系，创建项目首个架构设计核心文档 |
| **依赖任务** | 无 |
| **可并行** | 否（项目首个核心文档，后续任务依赖此文档） |
| **创建时间** | 2026-05-09 |
| **执行分支** | agent-develop |
| **项目路径** | projects/Organic-Interface |
| **Worktree路径** | worktrees/Organic-Interface/Organic-Interface-P1-001-architecture |

---

## 搜索摘要

### 初始关键词列表

- 三层架构：用户原始需求核心概念
- kernel/agent/plugins：项目包名与架构层对应
- 架构设计文档：目标输出文档类型

### 关键词扩展路径

- 扩展：三层架构 -> 内核层/外围层/自定义层（从用户描述提取）
- 扩展：kernel -> screenshot/ADB/mouse-keyboard（从架构功能列表提取）
- 扩展：agent -> AI Router/provider（从架构功能列表提取）

### 执行的搜索层级和类型

- [x] L1 直接搜索：项目目录结构、现有任务文件
- [x] L2 语义扩展搜索：架构相关文档、包职责定义
- [x] L3 关联搜索：包间依赖关系、现有任务对架构的引用
- [ ] L4 上下文搜索：相似项目架构参考
- [ ] L5 元数据搜索：版本历史

### 关联搜索覆盖

- [x] 代码层面关联：packages目录结构
- [x] 文档层面关联：现有任务文件中的架构描述
- [ ] 业务层面关联：无业务代码

### 发现的关键文件列表

- `.agent/tasks/pending/task-P2-002-readme-improvement.md`：README完善任务，包含模块列表及职责定义
- `.agent/tasks/pending/task-P2-003-api-documentation.md`：插件系统API文档任务，包含PluginInterface定义
- `.agent/tasks/pending/task-P2-004-dependency-check.md`：依赖检查任务

### 搜索终止条件和收敛原因

- 终止条件：项目尚无核心文档和源代码，搜索已覆盖所有现有文件
- 收敛原因：项目处于初始阶段，仅有3个待办任务文件，无更多可搜索内容

### 最终结果质量评估

- 覆盖度：100%（项目现有文件已全部检索）
- 准确度：高（现有任务文件提供了包职责的初步定义）
- 时效性：高（所有文件均为最新）
- 完整性：中（项目尚无源代码和核心文档，信息有限）

---

## 任务背景

### 项目现状

Organic-Interface 是一个多包 Monorepo 项目，包含7个包（agent, kernel, plugins, storage, tools, ui, utils），当前项目目录仅有 `.agent/tasks/pending/` 下的3个待办任务文件，尚无核心文档、README或源代码。

### 用户架构内容

用户提供了一套完整的三层架构设计思路：

1. **内核层（Kernel Layer）**：提供稳定、可靠、低延迟的底层功能（截图、鼠标键盘控制、ADB调用、模块执行管理、日志、状态反馈、高频操作接口）
2. **外围模块化交互层（Peripheral/Agent Layer）**：提供灵活、多样、可自定义的交互（AI Router调度、多视觉模型provider调用、脚本任务组合、CLI扩展、高层策略、任务序列、异常处理）
3. **自定义层（Customization Layer）**：用户/开发者可添加新模块、定义AI Router策略、接入新视觉LLM provider、定义CLI命令和管道式组合任务

### 架构优势

| 优势 | 说明 |
|------|------|
| 稳定性 | 核心内核层独立运行，高频操作不依赖AI推理，减少延迟和错误 |
| 灵活性 | 外围模块化层可替换/扩展AI Router、视觉模型provider或任务逻辑 |
| 可扩展性 | 新模块、新provider或新任务可直接插入外围层，不影响核心功能 |
| 自定义便捷 | CLI用户可通过组合模块或定义任务模板快速实现复杂自动化 |
| 符合Unix/Linux哲学 | "内核稳定+外围灵活+一切皆可组合"，易于管道式和流式操作 |

### 架构挑战与解决思路

| 挑战 | 解决思路 |
|------|---------|
| 模块接口规范 | 统一内核模块接口和外围模块通信格式（JSON/file/stdin/stdout） |
| 状态同步 | 核心内核层输出状态需实时供AI Router使用，可能涉及队列或消息总线 |
| 高频任务与AI决策冲突 | 高频操作直接在内核执行，AI Router只做策略决策 |
| 多provider管理 | 外围层需抽象provider接口，保证切换灵活且统一 |

### 任务必要性

项目当前无任何核心架构文档，现有任务文件（task-P2-002、task-P2-003、task-P2-004）均引用了架构概念但缺乏权威的架构定义文档。本任务将用户提供的架构设计整合为项目首个核心文档，为后续所有开发任务提供架构基准。

---

## 任务内容

### 步骤1：创建架构设计核心文档

**前提**：必须通过worktree机制执行

**操作流程**：
1. 创建worktree：`git worktree add worktrees/Organic-Interface/Organic-Interface-P1-001-architecture -b wt/P1-001/architecture docs/architecture.md`
2. 在worktree的`docs/`目录下创建`architecture.md`
3. 如`docs/`目录不存在，先创建目录

#### 1.1 项目架构概述

- 项目定位：多模态自动化 AI CLI 工具
- 核心设计理念：内核稳定 + 外围灵活 + 一切皆可组合
- 架构风格：三层分离架构（内核层 / 外围模块化交互层 / 自定义层）
- 设计哲学：符合 Unix/Linux 哲学，管道式组合，流式操作

#### 1.2 三层架构详细定义

**内核层（Kernel Layer）**

- 职责：提供稳定、可靠、低延迟的底层功能
- 核心功能清单：
  - 截图捕获（Screen Capture）
  - 鼠标键盘控制（Input Control）
  - ADB 调用（Android Debug Bridge）
  - 模块执行管理（Module Execution Manager）
  - 日志系统（Logging System）
  - 状态反馈（Status Feedback）
  - 高频操作接口（High-Frequency Operation Interface）
- 设计原则：高度稳定、接口规范、可复用、低频更新
- 约束：高频操作不依赖 AI 推理，避免延迟和错误

**外围模块化交互层（Peripheral/Agent Layer）**

- 职责：提供灵活、多样、可自定义的交互能力
- 核心功能清单：
  - AI Router 调度模块（AI Router Scheduler）
  - 多视觉模型 Provider 调用（Vision Model Provider）
  - 脚本任务组合（Script Task Composition）
  - CLI 扩展（CLI Extension）
  - 高层策略管理（High-Level Strategy）
  - 任务序列编排（Task Sequence Orchestration）
  - 异常处理（Exception Handling）
- 设计原则：高度灵活、可扩展、可自定义、支持不同场景
- 约束：AI Router 仅做策略决策，不直接执行高频操作

**自定义层（Customization Layer）**

- 职责：用户/开发者扩展和定制能力
- 核心功能清单：
  - 添加新模块（New Module Registration）
  - 定义新 AI Router 策略（Custom Router Strategy）
  - 接入新视觉 LLM Provider（Custom Provider Integration）
  - 定义 CLI 命令（Custom CLI Commands）
  - 管道式组合任务（Pipeline Task Composition）
- 设计原则：插件机制、社区可贡献、配置驱动
- 约束：自定义内容不得破坏内核层稳定性

#### 1.3 层间交互规范

- 内核层 → 外围层：状态反馈、执行结果上报、事件通知
- 外围层 → 内核层：指令下发、参数配置、模块调用
- 外围层 → 自定义层：扩展点暴露、插件接口、配置注入
- 自定义层 → 外围层：策略注册、Provider 注册、命令注册
- 通信格式：统一使用 JSON / 文件 / stdin-stdout
- 状态同步机制：队列或消息总线，确保内核状态实时可供 AI Router 使用

#### 1.4 架构优势与挑战

- 优势：稳定性、灵活性、可扩展性、自定义便捷、符合 Unix/Linux 哲学
- 挑战与解决思路：
  - 模块接口规范 → 统一 I/O 格式（JSON/file/stdin-stdout）
  - 状态同步 → 队列或消息总线
  - 高频任务与 AI 决策冲突 → 内核直接执行高频操作，AI Router 仅做策略决策
  - 多 Provider 管理 → 抽象 Provider 接口，统一切换机制

#### 1.5 实践建议与 MVP 路径

- 分层开发策略：内核层稳定基础（低频更新、单独测试）→ 外围层 AI Router + Provider（频繁迭代）→ 自定义层 CLI 命令和用户任务模板
- 模块化接口：统一 I/O 格式，支持流式管道组合
- 反馈循环：内核执行结果 → 外围层 → AI Router 决策 → 下一个模块 → 外围层更新全局状态
- 可扩展性策略：动态加载、插件机制、社区贡献
- MVP 建议：先开发核心内核 + AI Router 原型，再逐步扩展外围模块和自定义 CLI

### 步骤2：创建包-架构映射文档

在 `docs/architecture.md` 中追加包映射章节（本步骤5个节点）：

#### 2.1 内核层包映射

| 包名 | 架构层 | 职责 | 架构角色 |
|------|--------|------|---------|
| `@organic/kernel` | 内核层 | 核心稳定功能：截图、鼠标键盘控制、ADB调用、模块执行管理、日志、状态反馈、高频操作接口 | 内核层主体，三层架构的稳定基石 |
| `@organic/utils` | 内核层（支撑） | 共享工具库：日志框架、配置管理、通用辅助函数 | 内核层基础设施，确保内核稳定性和可复用性 |

#### 2.2 外围模块化交互层包映射

| 包名 | 架构层 | 职责 | 架构角色 |
|------|--------|------|---------|
| `@organic/agent` | 外围层 | AI Router调度、任务编排、策略管理、异常处理 | 外围层的"大脑"，负责智能决策和任务编排 |
| `@organic/plugins` | 外围层 | 插件系统：模块注册、生命周期管理、Provider接口 | 外围层的扩展骨架，连接外围层与自定义层 |
| `@organic/tools` | 外围层 | 工具系统：脚本任务组合、CLI扩展、工具注册与调用 | 外围层的执行工具集，提供多样化操作能力 |

#### 2.3 自定义层包映射

| 包名 | 架构层 | 职责 | 架构角色 |
|------|--------|------|---------|
| `@organic/ui` | 自定义层 | CLI界面、用户交互、命令定义、管道式任务组合界面 | 自定义层的用户入口，提供人机交互界面 |
| `@organic/storage` | 自定义层 | 状态持久化、配置存储、数据管理 | 自定义层的数据支撑，确保自定义配置和状态的持久化 |
| `@organic/plugins` | 自定义层（共享） | 插件机制：社区贡献模块、自定义Provider注册 | 自定义层的扩展通道，桥接外围层与自定义层 |

#### 2.4 跨层包说明

- `@organic/plugins` 跨越外围层和自定义层：
  - 在外围层：作为模块注册和生命周期管理的基础设施
  - 在自定义层：作为社区贡献和自定义扩展的通道
  - 设计意图：插件系统是"灵活"与"可扩展"的桥梁

#### 2.5 包间依赖关系

- `@organic/kernel` ← `@organic/agent`（agent调用kernel执行底层操作）
- `@organic/kernel` ← `@organic/tools`（tools调用kernel执行工具操作）
- `@organic/kernel` ← `@organic/utils`（kernel依赖utils的基础设施）
- `@organic/agent` ← `@organic/plugins`（agent通过plugins加载和调度模块）
- `@organic/agent` ← `@organic/storage`（agent通过storage持久化状态）
- `@organic/plugins` ← `@organic/storage`（plugins通过storage持久化配置）
- `@organic/tools` ← `@organic/plugins`（tools通过plugins注册和发现工具）
- `@organic/ui` ← `@organic/agent`（ui通过agent调度任务）
- `@organic/ui` ← `@organic/tools`（ui通过tools执行操作）

### 步骤3：创建接口规范章节

在 `docs/architecture.md` 中追加接口规范章节（本步骤4个节点）：

#### 3.1 内核层接口规范

- KernelInterface：内核层统一入口接口
- OperationResult：操作结果统一格式
- StatusFeedback：状态反馈接口
- HighFrequencyOperation：高频操作接口

#### 3.2 外围层接口规范

- AIRouterInterface：AI Router调度接口
- ProviderInterface：视觉模型Provider统一接口
- TaskSequenceInterface：任务序列编排接口
- ExceptionHandlerInterface：异常处理接口

#### 3.3 自定义层接口规范

- PluginInterface：插件注册与生命周期接口
- CustomCommandInterface：自定义CLI命令接口
- PipelineTaskInterface：管道式任务组合接口
- ConfigProviderInterface：配置提供者接口

#### 3.4 层间通信协议

- 请求-响应模式：同步调用
- 事件通知模式：异步状态反馈
- 流式管道模式：数据流式传输
- 消息格式：JSON Schema 定义

### 步骤4：文档同步与验证

#### 4.1 更新现有任务文件引用

- 在 `task-P2-002-readme-improvement.md` 中添加架构文档引用
- 在 `task-P2-003-api-documentation.md` 中添加架构文档引用

#### 4.2 验证架构文档完整性

- 检查三层架构定义是否完整
- 检查包映射是否覆盖全部7个包
- 检查接口规范是否覆盖各层核心接口
- 检查层间通信协议是否明确

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `.agent/tasks/pending/task-P2-002-readme-improvement.md` | 参考现有模块列表及职责定义 |
| `.agent/tasks/pending/task-P2-003-api-documentation.md` | 参考PluginInterface等接口定义 |
| `.agent/tasks/pending/task-P2-004-dependency-check.md` | 参考包间依赖关系描述 |

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `docs/architecture.md` | 项目核心架构设计文档（三层架构定义、包映射、接口规范、层间通信协议） |

## 预期修改文件

| 文件路径 | 预期修改内容 |
|---------|-------------|
| `.agent/tasks/pending/task-P2-002-readme-improvement.md` | 添加架构文档引用说明 |
| `.agent/tasks/pending/task-P2-003-api-documentation.md` | 添加架构文档引用说明 |

## 参考文件

| 文件路径 | 参考用途 |
|---------|---------|
| 用户提供的架构设计内容 | 三层架构核心理念、优势、挑战、实践建议的权威来源 |

---

## 文档同步内容

### 参考的核心文档

- 用户提供的架构设计内容：三层架构定义、优势分析、挑战与解决思路、实践建议

### 需要同步更新的文档

- `docs/architecture.md`：新建，项目核心架构设计文档
- `.agent/tasks/pending/task-P2-002-readme-improvement.md`：添加架构文档引用
- `.agent/tasks/pending/task-P2-003-api-documentation.md`：添加架构文档引用

---

## 验收标准

### 架构文档完整性

- [ ] `docs/architecture.md` 文件已创建
- [ ] 包含项目架构概述章节（项目定位、设计理念、架构风格、设计哲学）
- [ ] 包含三层架构详细定义章节（内核层、外围层、自定义层各自的职责、功能清单、设计原则、约束）
- [ ] 包含层间交互规范章节（层间数据流向、通信格式、状态同步机制）
- [ ] 包含架构优势与挑战章节（5项优势、4项挑战及解决思路）
- [ ] 包含实践建议与MVP路径章节

### 包映射完整性

- [ ] 包映射覆盖全部7个包（kernel, agent, plugins, storage, tools, ui, utils）
- [ ] 每个包明确标注所属架构层和架构角色
- [ ] `@organic/plugins` 的跨层角色已说明
- [ ] 包间依赖关系已列出

### 接口规范完整性

- [ ] 内核层核心接口已定义（KernelInterface, OperationResult, StatusFeedback, HighFrequencyOperation）
- [ ] 外围层核心接口已定义（AIRouterInterface, ProviderInterface, TaskSequenceInterface, ExceptionHandlerInterface）
- [ ] 自定义层核心接口已定义（PluginInterface, CustomCommandInterface, PipelineTaskInterface, ConfigProviderInterface）
- [ ] 层间通信协议已定义（请求-响应、事件通知、流式管道、消息格式）

### 文档同步

- [ ] task-P2-002 已添加架构文档引用
- [ ] task-P2-003 已添加架构文档引用

### 文档质量

- [ ] 文档使用 Markdown 格式规范
- [ ] 文档总行数不少于150行
- [ ] 所有表格格式正确
- [ ] 无模糊描述，所有概念有明确定义

---

## Docker 环境要求

不需要。本任务仅涉及文档创建和修改，无需构建或测试环境。

---

## 失败处理

1. **文件创建失败**：检查 `docs/` 目录是否存在，不存在则先创建目录
2. **现有任务文件引用更新失败**：记录失败原因，在任务文档中标注需要手动更新引用
3. **架构定义与现有任务文件冲突**：以本任务创建的 `docs/architecture.md` 为权威来源，记录冲突点供后续任务修正
4. **包映射不完整**：标记缺失的映射关系，在文档中标注 TODO 供后续补充

---

## 回滚方案

1. 删除 `docs/architecture.md` 文件
2. 恢复 `task-P2-002-readme-improvement.md` 和 `task-P2-003-api-documentation.md` 的引用修改
3. 使用 `git checkout -- <file>` 恢复被修改的文件

---

## 后置任务

- 命令：git add . && git commit -m "feat: add architecture design document with three-layer architecture and package mapping" && git push origin agent-develop
- 执行目录：projects/Organic-Interface

---

## Coder执行记录

[由Coder更新]

---

## Reviewer审核记录

[由Reviewer更新]

---

## Planner状态更新

- 创建时间：2026-05-09
- Coder完成时间：
- Reviewer通过时间：
- 最终状态：
