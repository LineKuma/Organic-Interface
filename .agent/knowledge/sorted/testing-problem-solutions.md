# 测试问题与解决方案

## 文档信息

| 字段 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 创建日期 | 2026-04-21 |
| 作者 | Learner |
| 描述 | Vitest 测试框架在 TypeScript Monorepo 项目中遇到的问题及解决方案 |

---

## 1. 可选方法调用问题

### 1.1 问题描述

测试运行时出现错误：
```
TypeError: this.getConfigSchema is not a function
```

### 1.2 根因分析

在 TypeScript 中，使用可选链操作符 `?` 定义的类方法可能是 `undefined`，但代码中直接调用而未做判断。

### 1.3 问题代码

```typescript
// BasePlugin.ts - 问题代码
protected getConfigSchema?(): Record<string, any> {
  // 可选方法，使用 ? 修饰
}

async validateConfig(config: Record<string, unknown>): Promise<ValidateResult> {
  const schema = this.getConfigSchema();  // 错误：直接调用
  // ...
}
```

### 1.4 修复方案

使用可选链操作符 `?.()`：

```typescript
// BasePlugin.ts - 修复后
async validateConfig(config: Record<string, unknown>): Promise<ValidateResult> {
  const schema = this.getConfigSchema?.();  // 使用可选链
  // ...
}
```

### 1.5 预防措施

- 定义可选方法时，调用方必须使用可选链
- 在 IDE 中添加类型检查警告
- 编写单元测试覆盖可选方法不存在的情况

---

## 2. 模块依赖解析问题

### 2.1 问题描述

测试运行时出现：
```
Error: Cannot find module '@organic/utils'
```

### 2.2 根因分析

在 monorepo 中，workspace 包的源码位于 `packages/*/src/`，但直接引用时可能解析到错误的路径。

### 2.3 解决方案

在 `vitest.config.ts` 中配置路径别名：

```typescript
resolve: {
  alias: {
    '@organic/utils': path.resolve(__dirname, './packages/utils/src'),
    '@organic/kernel': path.resolve(__dirname, './packages/kernel/src'),
    '@organic/plugins': path.resolve(__dirname, './packages/plugins/src'),
  },
}
```

### 2.4 注意事项

- 路径必须使用绝对路径（通过 `__dirname`）
- 确保测试文件扩展名匹配配置
- 检查 tsconfig.json 中的 path 配置是否一致

---

## 3. 异步测试超时问题

### 3.1 问题描述

异步测试失败，错误信息：
```
Timeout - Async callback was not called within the 5000ms timeout
```

### 3.2 根因分析

异步操作（如事件分发）在测试完成前未执行，导致超时。

### 3.3 解决方案

#### 方案 A：使用 setImmediate

```typescript
it('should emit event', async () => {
  const eventListener = vi.fn();
  eventBus.on('testEvent', eventListener);

  eventBus.emit('testEvent', { data: 'test' });

  // 等待异步事件分发完成
  await new Promise(resolve => setImmediate(resolve));

  expect(eventListener).toHaveBeenCalled();
});
```

#### 方案 B：增加超时配置

```typescript
// vitest.config.ts
testTimeout: 10000,   // 10秒
hookTimeout: 10000,
```

#### 方案 C：使用 vi.useFakeTimers（特定场景）

```typescript
it('should debounce calls', async () => {
  vi.useFakeTimers();
  
  const fn = vi.fn();
  debouncedFn();
  debouncedFn();
  debouncedFn();

  await vi.runAllTimersAsync();

  expect(fn).toHaveBeenCalledTimes(1);
  
  vi.useRealTimers();
});
```

### 3.4 最佳实践

| 场景 | 推荐方案 |
|------|----------|
| 事件监听器测试 | `setImmediate` |
| 长时间异步操作 | 增加 `testTimeout` |
| 定时器相关 | `vi.useFakeTimers` |
| Promise 链 | 直接 `await` |

---

## 4. Mock 函数未重置问题

### 4.1 问题描述

多个测试复用同一个 mock，后续测试看到前面测试的调用记录。

### 4.2 根因分析

`vi.fn()` 创建的 mock 函数状态在测试间共享，未清理。

### 4.3 解决方案

使用 `beforeEach` 重置 mock：

```typescript
describe('PluginManager', () => {
  let mockPlugin: PluginInterface;

  beforeEach(() => {
    // 每次测试前创建新的 mock
    mockPlugin = createMockPlugin('test-plugin', '1.0.0');
  });

  afterEach(() => {
    // 清理所有 mock 的调用记录
    vi.clearAllMocks();
  });
});
```

### 4.4 Mock 清理方法

| 方法 | 用途 |
|------|------|
| `vi.fn().mockReset()` | 重置单个 mock |
| `vi.clearAllMocks()` | 清除所有 mock 的调用记录 |
| `vi.restoreAllMocks()` | 恢复所有 mock 到原始状态 |
| `vi.useRealTimers()` | 恢复真实定时器 |

---

## 5. 生命周期清理问题

### 5.1 问题描述

测试修改了全局状态（如 `process.env`），影响后续测试。

### 5.2 解决方案

```typescript
describe('Config tests', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // 恢复原始环境
    process.env = { ...originalEnv };
  });

  it('should use custom env', () => {
    process.env.NODE_ENV = 'test';
    // 测试代码...
  });
});
```

---

## 6. 测试隔离问题

### 6.1 问题描述

测试 A 修改了共享资源，导致测试 B 失败。

### 6.2 解决方案

#### 单例模式处理

```typescript
describe('Singleton test', () => {
  let instance: SingletonClass;

  beforeEach(() => {
    // 强制重置单例
    SingletonClass['_instance'] = null as any;
    instance = SingletonClass.getInstance();
  });
});
```

#### 文件系统隔离

```typescript
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'path';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});
```

---

## 7. 类型定义缺失问题

### 7.1 问题描述

测试代码中访问私有属性时类型错误：
```
Property 'config' is private and not accessible
```

### 7.2 解决方案

使用类型断言（仅限测试代码）：

```typescript
// 获取私有属性
const config = (plugin as any).config;

// 调用私有方法
await (plugin as any).privateMethod();

// 修改私有属性
(plugin as any).initialized = true;
```

### 7.3 注意事项

- 类型断言仅在测试代码中使用
- 生产代码中保持良好的接口设计
- 考虑添加 `testOnly` 内部方法

---

## 8. 常见错误对照表

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| `Cannot find module '@org/package'` | 路径别名未配置 | 配置 `resolve.alias` |
| `Timeout - Async callback was not called` | 异步未完成 | 使用 `setImmediate` |
| `this.getConfigSchema is not a function` | 可选方法未判空 | 使用 `?.()` |
| `Expected spy to have been called` | Mock 未触发 | 检查调用时机、清理 mock |
| `Module not found: Error: Cannot resolve` | 包名错误 | 检查 import 路径 |
| `ENOENT: no such file or directory` | 文件不存在 | 检查文件路径 |

---

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-21 | 1.0.0 | 初始版本，记录测试问题与解决方案 |
