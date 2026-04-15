# 功能文档：Security安全系统架构

## 基本信息

**文档编号**: DOC-011
**所属模块**: 核心架构
**优先级**: P1
**创建日期**: 2026-04-15
**对应需求章节**: 3.4 安全需求

---

## 功能概述

Security安全系统是Organic-Interface的核心安全保障机制，为所有系统操作提供权限控制和操作审计功能。系统采用RBAC（基于角色的访问控制）模型实现细粒度的权限管理，同时记录完整的操作审计日志，支持安全事件的追溯和分析。

---

## 设计理念

### 安全设计原则

**最小权限原则**：每个用户和角色仅被授予完成其工作所必需的最小权限集合，避免权限过度授予带来的安全风险。

**职责分离原则**：通过角色划分实现职责分离，关键操作需要多个角色或用户协同完成，防止单点权限滥用。

**可审计原则**：所有敏感操作必须记录详细的审计日志，支持事后追溯和安全分析，确保操作行为可追溯。

**纵深防御原则**：在系统多个层级部署安全控制措施，即使某一层被突破，其他层仍能提供保护。

### 核心安全目标

1. **身份认证**：验证用户身份的真实性和合法性
2. **权限控制**：基于RBAC模型控制用户对系统资源的访问
3. **操作审计**：记录所有敏感操作，支持安全追溯
4. **安全策略**：定义和执行安全策略，保障系统安全运行

---

## 权限模型

### 核心概念定义

**主体**：权限模型中的主动方，是权限的持有者和操作者。系统中的主体包括用户（User）和角色（Role）。

**客体**：权限模型中的被动方，是被访问和操作的资源。系统中的客体包括文件（File）、目录（Directory）、工具（Tool）、API（Api）和数据（Data）。

**权限**：主体对客体执行特定操作的能力。权限定义了"谁可以对什么做什么"的问题。

### 主体模型

```typescript
interface Subject {
  id: string;
  type: SubjectType;
  name: string;
  description?: string;
}

enum SubjectType {
  USER = "user",
  ROLE = "role"
}
```

### 客体模型

```typescript
interface Object {
  id: string;
  type: ObjectType;
  name: string;
  path?: string;
  attributes?: Record<string, any>;
}

enum ObjectType {
  FILE = "file",
  DIRECTORY = "directory",
  TOOL = "tool",
  API = "api",
  DATA = "data"
}
```

### 权限类型定义

```typescript
enum PermissionType {
  // 文件权限
  FILE_READ = "file:read",
  FILE_WRITE = "file:write",
  FILE_DELETE = "file:delete",
  FILE_EXECUTE = "file:execute",

  // 目录权限
  DIR_READ = "dir:read",
  DIR_WRITE = "dir:write",
  DIR_DELETE = "dir:delete",
  DIR_LIST = "dir:list",

  // 工具权限
  TOOL_INVOKE = "tool:invoke",
  TOOL_MANAGE = "tool:manage",

  // API权限
  API_CALL = "api:call",
  API_MANAGE = "api:manage",

  // 数据权限
  DATA_READ = "data:read",
  DATA_WRITE = "data:write",
  DATA_DELETE = "data:delete",
  DATA_EXPORT = "data:export",

  // 管理权限
  ADMIN = "admin:all",
  USER_MANAGE = "user:manage",
  ROLE_MANAGE = "role:manage",
  AUDIT_VIEW = "audit:view"
}
```

---

## 访问控制机制

### RBAC模型定义

系统采用基于角色的访问控制（RBAC）模型，包含以下核心组件：

**用户（User）**：系统中的实际操作者，可以被分配一个或多个角色。

**角色（Role）**：一组权限的集合，代表了特定的工作职能或责任。

**权限（Permission）**：对特定客体执行特定操作的许可。

**角色-权限关联（RolePermission）**：定义角色与权限之间的关系。

**用户-角色关联（UserRole）**：定义用户与角色之间的关系。

### 角色层次结构

```typescript
interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  parent_id?: string;
  level: RoleLevel;
  permissions: Permission[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

enum RoleLevel {
  SYSTEM = "system",
  ADMIN = "admin",
  MANAGER = "manager",
  USER = "user",
  GUEST = "guest"
}
```

### 预定义角色

系统预定义以下标准角色：

**system_admin（系统管理员）**：SYSTEM级别，拥有所有权限

**security_admin（安全管理员）**：ADMIN级别，负责安全配置、审计查看

**user_admin（用户管理员）**：ADMIN级别，负责用户管理、角色管理

**project_manager（项目经理）**：MANAGER级别，负责项目管理、团队成员管理

**developer（开发人员）**：USER级别，拥有代码操作、工具使用权限

**viewer（查看者）**：GUEST级别，仅拥有只读权限

### 权限验证流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  REQUEST    │ → │  AUTH       │ → │  PERMISSION  │ → │  EXECUTE    │
│  RECEIVED   │    │  CHECK      │    │  CHECK       │    │  OPERATION  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                        │                   │
                        ↓                   ↓
                   ┌─────────────┐    ┌─────────────┐
                   │  INVALID    │    │  DENIED     │
                   │  AUTH       │    │  ACCESS     │
                   └─────────────┘    └─────────────┘
```

**步骤1 - 认证检查**：验证请求者的身份是否合法，检查认证令牌是否有效。

**步骤2 - 权限检查**：验证请求者是否具有执行操作所需的权限，包括直接权限和通过角色继承的权限。

**步骤3 - 客体检查**：验证请求者是否有权访问目标客体，包括客体是否存在、是否属于请求者的作用域。

**步骤4 - 上下文检查**：检查操作的时间、地点、设备等上下文是否符合安全策略。

**步骤5 - 执行操作**：权限验证全部通过后，执行实际操作。

---

## 操作审计机制

### 审计日志概述

审计日志是系统安全的核心组件，记录所有敏感操作的全量信息，支持安全事件的追溯、分析和合规审计。

### 审计日志结构

```typescript
interface AuditLog {
  id: string;
  timestamp: string;
  request_id: string;

  // 操作者信息
  operator: {
    user_id: string;
    username: string;
    role_ids: string[];
    ip_address: string;
    user_agent: string;
  };

  // 操作信息
  operation: {
    action: string;
    resource_type: string;
    resource_id: string;
    resource_path?: string;
  };

  // 请求信息
  request: {
    method: string;
    path: string;
    params?: Record<string, any>;
    body?: Record<string, any>;
  };

  // 响应信息
  response: {
    status: number;
    success: boolean;
    error?: string;
    duration: number;
  };

  // 上下文信息
  context: {
    session_id?: string;
    transaction_id?: string;
    parent_request_id?: string;
  };

  // 安全信息
  security: {
    auth_method: string;
    risk_level: RiskLevel;
    risk_factors?: string[];
  };
}

enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}
```

### 审计操作类型

```typescript
enum AuditAction {
  // 认证相关
  AUTH_LOGIN = "auth:login",
  AUTH_LOGOUT = "auth:logout",
  AUTH_FAILED = "auth:failed",
  AUTH_TOKEN_REFRESH = "auth:token:refresh",

  // 用户管理
  USER_CREATE = "user:create",
  USER_UPDATE = "user:update",
  USER_DELETE = "user:delete",
  USER_DISABLE = "user:disable",
  USER_PASSWORD_CHANGE = "user:password:change",

  // 角色管理
  ROLE_CREATE = "role:create",
  ROLE_UPDATE = "role:update",
  ROLE_DELETE = "role:delete",
  ROLE_ASSIGN = "role:assign",
  ROLE_REVOKE = "role:revoke",

  // 权限管理
  PERMISSION_GRANT = "permission:grant",
  PERMISSION_REVOKE = "permission:revoke",

  // 文件操作
  FILE_READ = "file:read",
  FILE_WRITE = "file:write",
  FILE_DELETE = "file:delete",
  FILE_DOWNLOAD = "file:download",
  FILE_UPLOAD = "file:upload",

  // 工具操作
  TOOL_INVOKE = "tool:invoke",
  TOOL_CONFIG_CHANGE = "tool:config:change",

  // 配置操作
  CONFIG_VIEW = "config:view",
  CONFIG_CHANGE = "config:change",

  // 数据导出
  DATA_EXPORT = "data:export",
  DATA_IMPORT = "data:import"
}
```

### 审计查询接口

```typescript
interface AuditQueryParams {
  // 时间范围
  start_time?: string;
  end_time?: string;

  // 操作者过滤
  user_id?: string;
  username?: string;
  role_id?: string;

  // 操作过滤
  action?: AuditAction;
  resource_type?: string;
  resource_id?: string;

  // 结果过滤
  success?: boolean;
  risk_level?: RiskLevel;

  // 分页
  page?: number;
  page_size?: number;

  // 排序
  order_by?: string;
  order_dir?: "asc" | "desc";
}

interface AuditQueryResult {
  total: number;
  page: number;
  page_size: number;
  data: AuditLog[];
}
```

---

## 安全策略定义

### 密码策略

```typescript
interface PasswordPolicy {
  min_length: number;          // 最小长度（默认12位）
  require_uppercase: boolean;   // 必须包含大写字母
  require_lowercase: boolean;   // 必须包含小写字母
  require_digit: boolean;       // 必须包含数字
  require_special: boolean;     // 必须包含特殊字符
  max_age_days: number;        // 密码最大有效期（天）
  history_count: number;       // 历史密码不可重复数量
  lockout_threshold: number;   // 锁定阈值（失败次数）
  lockout_duration: number;    // 锁定时长（分钟）
}
```

### 会话安全策略

```typescript
interface SessionPolicy {
  timeout_minutes: number;        // 会话超时时间
  max_concurrent: number;         // 最大并发会话数
  require_reauth_for_sensitive: boolean;  // 敏感操作需要重新认证
  reauth_timeout_seconds: number; // 重新认证超时时间
  secure_cookie: boolean;         // Cookie安全标志
  http_only_cookie: boolean;      // Cookie HttpOnly标志
  same_site: "strict" | "lax" | "none";  // Cookie SameSite策略
}
```

### 访问控制策略

```typescript
interface AccessControlPolicy {
  // IP白名单/黑名单
  allowed_ips?: string[];
  denied_ips?: string[];

  // 时间限制
  allowed_time_ranges?: TimeRange[];
  denied_time_ranges?: TimeRange[];

  // 设备限制
  allowed_user_agents?: string[];
  denied_user_agents?: string[];

  // 速率限制
  rate_limit: {
    enabled: boolean;
    max_requests: number;
    window_seconds: number;
  };
}
```

### 敏感操作策略

```typescript
interface SensitiveOperationPolicy {
  // 需要确认的操作
  require_confirmation: AuditAction[];

  // 需要二次认证的操作
  require_reauth: AuditAction[];

  // 需要审批的操作
  require_approval: {
    actions: AuditAction[];
    approver_roles: string[];
    auto_expire_hours: number;
  };

  // 紧急访问策略
  emergency_access: {
    enabled: boolean;
    max_duration_hours: number;
    notify_roles: string[];
  };
}
```

---

## SecurityService API接口

### 服务接口定义

```typescript
interface SecurityService {
  // ========== 认证接口 ==========

  // 用户登录
  login(credentials: LoginCredentials): Promise<LoginResult>;

  // 用户登出
  logout(token: string): Promise<void>;

  // 令牌刷新
  refresh_token(refresh_token: string): Promise<TokenResult>;

  // 令牌验证
  validate_token(token: string): Promise<TokenValidationResult>;

  // ========== 权限接口 ==========

  // 检查权限
  check_permission(params: PermissionCheckParams): Promise<PermissionCheckResult>;

  // 获取用户权限列表
  get_user_permissions(user_id: string): Promise<Permission[]>;

  // 获取用户角色列表
  get_user_roles(user_id: string): Promise<Role[]>;

  // 分配角色
  assign_role(params: RoleAssignParams): Promise<void>;

  // 撤销角色
  revoke_role(params: RoleRevokeParams): Promise<void>;

  // 授予权限
  grant_permission(params: PermissionGrantParams): Promise<void>;

  // 撤销权限
  revoke_permission(params: PermissionRevokeParams): Promise<void>;

  // ========== 用户管理接口 ==========

  // 创建用户
  create_user(params: CreateUserParams): Promise<User>;

  // 更新用户
  update_user(params: UpdateUserParams): Promise<User>;

  // 删除用户
  delete_user(user_id: string): Promise<void>;

  // 获取用户信息
  get_user(user_id: string): Promise<User>;

  // 获取用户列表
  list_users(params: UserListParams): Promise<UserListResult>;

  // ========== 角色管理接口 ==========

  // 创建角色
  create_role(params: CreateRoleParams): Promise<Role>;

  // 更新角色
  update_role(params: UpdateRoleParams): Promise<Role>;

  // 删除角色
  delete_role(role_id: string): Promise<void>;

  // 获取角色信息
  get_role(role_id: string): Promise<Role>;

  // 获取角色列表
  list_roles(): Promise<Role[]>;

  // ========== 审计接口 ==========

  // 记录审计日志
  log_operation(params: AuditLogParams): Promise<void>;

  // 查询审计日志
  query_audit_logs(params: AuditQueryParams): Promise<AuditQueryResult>;

  // 获取审计统计
  get_audit_statistics(params: AuditStatParams): Promise<AuditStatistics>;

  // ========== 安全策略接口 ==========

  // 获取安全策略
  get_security_policy(): Promise<SecurityPolicy>;

  // 更新安全策略
  update_security_policy(params: SecurityPolicyUpdateParams): Promise<void>;

  // ========== 安全检查接口 ==========

  // 执行安全检查
  perform_security_check(params: SecurityCheckParams): Promise<SecurityCheckResult>;

  // 获取风险评估
  get_risk_assessment(params: RiskAssessmentParams): Promise<RiskAssessment>;
}
```

### 接口参数定义

```typescript
interface LoginCredentials {
  username: string;
  password: string;
  mfa_code?: string;
  remember_me?: boolean;
}

interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  refresh_token?: string;
  expires_at?: string;
  error?: string;
}

interface TokenResult {
  token: string;
  refresh_token: string;
  expires_at: string;
}

interface PermissionCheckParams {
  user_id: string;
  permission: PermissionType | string;
  resource_id?: string;
  resource_type?: string;
}

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  evaluated_at: string;
}

interface RoleAssignParams {
  user_id: string;
  role_id: string;
  valid_until?: string;
  assigned_by: string;
}

interface AuditLogParams {
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  request_id: string;
  operator_id: string;
  result: "success" | "failure";
  details?: Record<string, any>;
}
```

---

## 数据模型

### Permission权限模型

```typescript
interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  type: PermissionType;
  resource_type: string;
  resource_pattern?: string;
  conditions?: PermissionCondition[];
  created_at: string;
  updated_at: string;
}

interface PermissionCondition {
  field: string;
  operator: "eq" | "neq" | "in" | "not_in" | "contains" | "gt" | "lt";
  value: any;
}
```

### AuditLog审计日志模型

```typescript
interface AuditLog {
  // 主键
  id: string;
  timestamp: string;

  // 操作者
  operator_id: string;
  operator_name: string;
  operator_ip: string;

  // 操作
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;

  // 请求
  request_method: string;
  request_path: string;
  request_params?: Record<string, any>;

  // 响应
  response_status: number;
  response_time: number;
  error_message?: string;

  // 上下文
  session_id?: string;
  user_agent?: string;
  correlation_id?: string;

  // 安全
  auth_method: string;
  risk_level: string;
  additional_data?: Record<string, any>;
}
```

### User用户模型

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar?: string;
  status: UserStatus;
  roles: Role[];
  permissions: Permission[];
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  last_login_ip?: string;
  failed_login_attempts: number;
  locked_until?: string;
}

enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
  LOCKED = "locked",
  DELETED = "deleted"
}
```

---

## 验收条件

1. **RBAC权限模型**：系统实现基于角色的访问控制，支持用户-角色-权限三层关系，支持角色继承

2. **权限验证流程**：权限验证包含认证检查、权限检查、客体检查、上下文检查四个步骤

3. **审计日志结构**：审计日志包含操作者、操作、操作对象、请求响应、上下文、安全信息等完整字段

4. **审计查询接口**：支持按时间、用户、操作类型、风险等级等多维度查询审计日志

5. **SecurityService API**：SecurityService提供完整的认证、权限、用户管理、审计接口

6. **密码策略**：支持最小长度、大小写、数字、特殊字符、历史记录、锁定等密码策略配置

7. **会话安全策略**：支持会话超时、最大并发、重新认证等会话安全策略

8. **数据模型**：Permission和AuditLog数据模型包含所有必要字段定义

---

## 与现有功能的关系

### 与Agent架构的协同

Security系统为Agent提供安全保障：
- Agent执行操作前需要通过权限验证
- Agent的所有敏感操作都会被审计记录
- Agent可以使用SecurityService进行权限查询

### 与Tool系统的对齐

Tool系统使用Security进行权限控制：
- Tool调用需要检查tool:invoke权限
- Tool配置变更需要记录审计日志
- Tool可以集成SecurityService增强安全性

### 与配置系统的对齐

Security配置遵循配置系统设计原则：
- 安全策略支持运行时热更新
- 安全策略支持版本管理和回滚
- 安全策略配置与系统配置保持一致

---

## 术语定义

**RBAC**：基于角色的访问控制（Role-Based Access Control），一种主流的权限管理模型

**权限**：主体对客体执行特定操作的能力

**角色**：一组权限的集合，代表特定的工作职能

**审计日志**：记录系统操作历史的日志，用于安全追溯和分析

**最小权限原则**：只授予用户完成工作所必需的最小权限

**职责分离**：通过角色划分实现职责分离，防止权限滥用

**敏感操作**：可能对系统或数据造成重大影响的操作

---

## 相关文档

- 技术架构设计文档
- Agent通信协议规范
- Tool插件系统规范
- 配置系统使用指南
- feature-002-ui-as-tool.md
- feature-007-tool-system.md
