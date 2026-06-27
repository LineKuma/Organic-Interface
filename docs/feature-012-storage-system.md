# 功能文档：Storage存储系统架构

## 基本信息

**文档编号**: DOC-012
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.4 数据持久化需求

---

## 功能概述

Storage存储系统是Organic-Interface的数据持久化核心模块，为上下文管理和会话状态提供可靠的存储支持。系统采用统一的存储抽象层设计，支持多种存储类型（内存、文件、数据库），确保数据在不同场景下的持久化和快速访问。存储系统与上下文管理模块紧密协作，为AI Agent提供稳定的状态保持能力。

---

## 设计原则

### 核心设计原则

**统一抽象**：通过StorageService统一接口屏蔽底层存储差异，上层模块无需关心具体存储实现。

**分层架构**：分为存储接口层、存储引擎层、数据访问层，各层职责明确，便于维护和扩展。

**事务安全**：支持事务边界控制，确保批量操作的原子性和数据一致性。

**性能优先**：采用缓存、批量操作、懒加载等策略优化访问性能。

### 存储类型分类

- **内存存储**：适用场景为临时数据、会话缓存，特点为高速读写、断电丢失
- **文件存储**：适用场景为配置文件、用户数据，特点为持久化、结构灵活
- **数据库存储**：适用场景为业务数据、查询需求，特点为结构化、事务支持

---

## 存储模型设计

### 数据实体定义

```typescript
// 基础存储实体
interface StorageEntity {
  id: string; // 唯一标识符
  type: string; // 实体类型
  data: Record<string, any>; // 实体数据
  metadata: EntityMetadata; // 元数据
  created_at: number; // 创建时间戳
  updated_at: number; // 更新时间戳
  version: number; // 版本号，用于冲突检测
}

// 实体元数据
interface EntityMetadata {
  created_by?: string; // 创建者
  updated_by?: string; // 更新者
  tags?: string[]; // 标签
  expires_at?: number; // 过期时间
  source?: string; // 数据来源
}
```

### 存储索引机制

```typescript
// 索引定义
interface StorageIndex {
  name: string; // 索引名称
  fields: string[]; // 索引字段
  unique: boolean; // 是否唯一索引
  type: IndexType; // 索引类型
}

// 索引类型枚举
enum IndexType {
  PRIMARY = 'primary', // 主键索引
  UNIQUE = 'unique', // 唯一索引
  MULTI = 'multi', // 多值索引
  TEXT = 'text', // 全文索引
}
```

---

## 数据访问接口

### StorageService核心接口

```typescript
interface StorageService {
  // 基础CRUD操作
  create(entity: StorageEntity): Promise<CreateResult>;
  read(id: string): Promise<StorageEntity | null>;
  update(id: string, data: Partial<StorageEntity>): Promise<UpdateResult>;
  delete(id: string): Promise<DeleteResult>;

  // 批量操作
  batch_create(entities: StorageEntity[]): Promise<BatchCreateResult>;
  batch_update(updates: UpdateOperation[]): Promise<BatchUpdateResult>;
  batch_delete(ids: string[]): Promise<BatchDeleteResult>;

  // 查询接口
  query(filter: QueryFilter): Promise<QueryResult>;
  find_by_type(type: string): Promise<StorageEntity[]>;
  find_by_tags(tags: string[]): Promise<StorageEntity[]>;

  // 事务支持
  begin_transaction(options?: TransactionOptions): Promise<Transaction>;
  commit_transaction(tx: Transaction): Promise<void>;
  rollback_transaction(tx: Transaction): Promise<void>;

  // 管理操作
  get_storage_info(): StorageInfo;
  clear_expired(): Promise<ClearResult>;
}
```

### 查询过滤器定义

```typescript
interface QueryFilter {
  // 条件组合
  where?: Record<string, any>; // AND条件
  or_where?: Record<string, any>; // OR条件

  // 排序分页
  order_by?: OrderSpec[]; // 排序规则
  limit?: number; // 限制数量
  offset?: number; // 偏移量

  // 包含排除
  include?: string[]; // 包含字段
  exclude?: string[]; // 排除字段

  // 时间范围
  created_after?: number; // 创建时间下限
  created_before?: number; // 创建时间上限
  updated_after?: number; // 更新时间下限
  updated_before?: number; // 更新时间上限
}

// 排序规则
interface OrderSpec {
  field: string;
  direction: 'asc' | 'desc';
}
```

### 批量操作定义

```typescript
interface UpdateOperation {
  id: string;
  data: Partial<StorageEntity>;
}

// 批量操作结果
interface BatchCreateResult {
  success: boolean;
  created: StorageEntity[];
  failed: { entity: StorageEntity; error: string }[];
}

interface BatchUpdateResult {
  success: boolean;
  updated: number;
  failed: { id: string; error: string }[];
}

interface BatchDeleteResult {
  success: boolean;
  deleted: number;
  failed: { id: string; error: string }[];
}
```

---

## 事务管理机制

### 事务配置选项

```typescript
interface TransactionOptions {
  isolation?: IsolationLevel; // 隔离级别
  timeout?: number; // 超时时间(ms)
  retry_on_conflict?: boolean; // 冲突时重试
}

// 隔离级别
enum IsolationLevel {
  READ_UNCOMMITTED = 'read_uncommitted',
  READ_COMMITTED = 'read_committed',
  REPEATABLE_READ = 'repeatable_read',
  SERIALIZABLE = 'serializable',
}
```

### 事务边界控制

```typescript
interface Transaction {
  id: string;
  start_time: number;
  isolation: IsolationLevel;
  operations: TransactionOperation[];
  status: TransactionStatus;
}

// 事务状态
enum TransactionStatus {
  ACTIVE = 'active',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  EXPIRED = 'expired',
}
```

### 回滚策略

- **自动回滚**：事务超时或遇到不可恢复错误时自动回滚
- **手动回滚**：通过显式调用rollback_transaction回滚
- **部分回滚**：支持在事务内设置保存点，实现部分回滚

---

## 数据迁移与版本管理

### 数据迁移策略

```typescript
interface MigrationPlan {
  version: string;
  up(): Promise<void>;
  down(): Promise<void>;
  validate(): Promise<boolean>;
}

// 迁移管理器接口
interface MigrationManager {
  get_current_version(): Promise<string>;
  get_migrations(): MigrationPlan[];
  apply_migration(version: string): Promise<void>;
  rollback_migration(version: string): Promise<void>;
}
```

### 版本兼容策略

- 向后兼容：新版本系统支持旧版本数据格式
- 平滑迁移：支持增量式数据迁移
- 版本回滚：支持降级到历史版本

---

## 存储API接口定义

### RESTful API接口

- **POST /api/v1/storage**：创建实体
- **GET /api/v1/storage/{id}**：读取实体
- **PUT /api/v1/storage/{id}**：更新实体
- **DELETE /api/v1/storage/{id}**：删除实体
- **POST /api/v1/storage/query**：查询实体
- **GET /api/v1/storage/type/{type}**：按类型查询
- **POST /api/v1/storage/batch**：批量操作
- **GET /api/v1/storage/info**：获取存储信息

### API请求响应格式

```typescript
// 通用响应格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  request_id: string;
}
```

---

## 数据模型详细定义

### Entity实体类

```typescript
class StorageEntityImpl implements StorageEntity {
  id: string;
  type: string;
  data: Record<string, any>;
  metadata: EntityMetadata;
  created_at: number;
  updated_at: number;
  version: number;

  constructor(type: string, data: Record<string, any>);
  to_json(): string;
  from_json(json: string): StorageEntityImpl;
  clone(): StorageEntityImpl;
}
```

### Repository仓储类

```typescript
interface StorageRepository {
  // 实体操作
  save(entity: StorageEntity): Promise<StorageEntity>;
  find_by_id(id: string): Promise<StorageEntity | null>;
  find_all(filter?: QueryFilter): Promise<StorageEntity[]>;
  delete_by_id(id: string): Promise<boolean>;

  // 批量操作
  save_many(entities: StorageEntity[]): Promise<StorageEntity[]>;
  delete_many(ids: string[]): Promise<number>;

  // 统计查询
  count(filter?: QueryFilter): Promise<number>;
  exists(id: string): Promise<boolean>;
}
```

---

## 验收条件

1. 存储类型支持：系统支持内存、文件、数据库三种存储类型切换
2. CRUD操作完整性：StorageService提供完整的create、read、update、delete操作
3. 批量操作支持：支持batch_create、batch_update、batch_delete批量操作
4. 查询接口功能：支持条件查询、排序、分页、字段过滤
5. 事务管理机制：支持事务的创建、提交、回滚，设置隔离级别
6. 数据迁移能力：支持数据版本管理和迁移操作
7. 索引机制：支持主键、唯一索引、多值索引和全文索引
8. 过期数据清理：支持设置过期时间，自动清理过期数据
9. RESTful API：提供完整的RESTful API接口供外部调用
10. 错误处理：所有操作都有完善的错误处理和结果反馈

---

## 与现有功能的关系

### 与上下文管理的协作

存储系统为上下文管理提供持久化支持：

- 会话上下文数据存储到Storage
- 上下文恢复时从Storage读取数据
- 支持上下文数据的导出和导入

### 与Agent架构的集成

- Agent可将关键状态数据写入Storage
- 新的Agent实例可恢复历史状态
- 支持Agent间的数据共享

---

## 术语定义

- **StorageService**：存储服务核心接口，封装所有存储操作
- **StorageEntity**：存储实体，数据的统一表示形式
- **StorageRepository**：仓储接口，封装数据访问逻辑
- **Transaction**：事务，一组原子性操作的集合
- **QueryFilter**：查询过滤器，定义数据查询条件
- **IsolationLevel**：隔离级别，控制并发事务间的可见性

---

## 相关文档

- feature-008-context-management（上下文管理）
- feature-001-agent-architecture（Agent架构）
- 配置系统使用指南
