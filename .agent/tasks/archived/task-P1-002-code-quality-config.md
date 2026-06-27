# Task: Add ESLint and Prettier Configuration

## 元信息

| 字段 | 内容 |
|------|------|
| **任务ID** | task-P1-002-code-quality-config |
| **优先级** | P1 |
| **标题** | 添加ESLint和Prettier配置 |
| **描述** | 为Organic-Interface项目添加ESLint和Prettier配置，确保代码质量和格式统一 |
| **任务类型** | code-modification |
| **依赖任务** | task-P0-001-docker-config（可选，不强制） |
| **可并行** | 否 |
| **创建时间** | 2026-05-12 |
| **执行分支** | agent-develop |
| **项目路径** | projects/Organic-Interface |

---

## 任务背景

### 问题说明

根据项目分析，有以下代码质量问题：

| 问题 | 优先级 | 证据 |
|------|--------|------|
| 缺少ESLint配置 | P1 | 项目根目录不存在eslint.config.js |
| 缺少Prettier配置 | P1 | 项目根目录已有.prettierrc但需要验证配置完整性 |
| 缺少lint脚本 | P2 | package.json中lint脚本显示"No linter configured" |

### 项目技术栈

- 运行时: Node.js 18+
- 语言: TypeScript 5.4+
- 包管理: pnpm 8+

### 已有配置

项目已配置：
- `.prettierrc` 文件存在
- `.npmrc` 文件存在
- package.json中有lint和lint:fix脚本定义（但显示未配置）

---

## 任务内容

### 步骤1：创建ESLint配置文件

**文件路径**: `projects/Organic-Interface/eslint.config.js`

**配置要求**:
- 使用 @typescript-eslint/eslint-plugin 和 @typescript-eslint/parser
- 继承 eslint-config-prettier 禁用冲突规则
- 配置TypeScript特定规则
- 配置测试文件规则

**配置结构**:
```javascript
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript specific rules
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      // Test file specific rules
    },
  },
  prettier,
];
```

**注意**: 需要更新 ESLint 9.x 配置格式（如果项目使用ESLint 9）

### 步骤2：验证.prettierrc配置

**文件路径**: `projects/Organic-Interface/.prettierrc`

**检查内容**:
- 验证已有配置是否完整
- 确保配置与ESLint兼容
- 如有必要，补充缺失配置项

### 步骤3：更新package.json脚本

**文件路径**: `projects/Organic-Interface/package.json`

**更新内容**:
```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx && prettier --check .",
    "lint:fix": "eslint --fix . --ext .ts,.tsx && prettier --write ."
  }
}
```

### 步骤4：验证配置

**验证步骤**:
1. 运行 `pnpm lint` 检查是否有错误
2. 运行 `pnpm lint:fix` 验证自动修复功能
3. 检查格式化后的文件是否正常

---

## 输入文件

| 文件路径 | 用途 |
|---------|------|
| `projects/Organic-Interface/package.json` | 项目配置 |
| `projects/Organic-Interface/.prettierrc` | 已有Prettier配置 |
| `projects/Organic-Interface/tsconfig.base.json` | TypeScript配置 |

## 输出文件

| 文件路径 | 内容 |
|---------|------|
| `projects/Organic-Interface/eslint.config.js` | ESLint配置文件 |

## 预期修改文件

| 文件路径 | 预期修改内容 |
|---------|-------------|
| `projects/Organic-Interface/package.json` | 更新lint脚本 |

---

## 验收标准

### ESLint配置

- [ ] `eslint.config.js` 文件已创建
- [ ] 配置支持TypeScript
- [ ] 配置与Prettier无冲突
- [ ] 配置覆盖所有.ts文件

### 脚本配置

- [ ] `pnpm lint` 命令可用
- [ ] `pnpm lint:fix` 命令可用
- [ ] 脚本正确调用ESLint和Prettier

### 验证通过

- [ ] `pnpm lint` 执行成功
- [ ] 无格式错误输出

---

## 失败处理

1. **ESLint版本问题**: 确认项目ESLint版本，使用对应配置格式
2. **冲突规则**: 确认prettier配置在最后加载
3. **TS配置问题**: 检查tsconfig.json路径配置

---

## 回滚方案

1. 删除 `eslint.config.js`
2. 恢复 `package.json` 中的lint脚本
3. 使用 `git checkout -- <file>` 恢复
