# 部署指南

## 基本信息

**文档类型**: 部署指南
**版本**: 0.1.0
**状态**: 已发布

---

## 概述

本文档提供 Organic-Interface 的生产环境部署指南，涵盖多种部署方式和环境配置。

---

## 部署方式

### 方式一：网络安装脚本（推荐）

一键安装，自动下载最新版本：

```bash
# 安装最新稳定版
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash

# 安装指定版本
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --version v0.1.0

# 安装到指定目录
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --dir /opt/organic

# 安装开发版本
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --branch develop
```

安装后使环境变量生效：

```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### 方式二：GitHub Release

```bash
# 下载
wget https://github.com/LineKuma/Organic-Interface/releases/download/v0.1.0/organic-v0.1.0.tar.gz

# 解压
tar -xzf organic-v0.1.0.tar.gz
cd organic-v0.1.0

# 安装生产依赖
pnpm install --prod

# 运行
node packages/ui/cli.js
```

### 方式三：Docker

```bash
# 构建镜像
docker build -t organic-interface:latest .

# 运行容器
docker run -it organic-interface:latest

# 挂载工作目录
docker run -it -v $(pwd):/workspace organic-interface:latest
```

### 方式四：源码部署

```bash
git clone https://github.com/LineKuma/Organic-Interface.git
cd Organic-Interface
pnpm install --prod
pnpm build
```

---

## 环境要求

### 生产环境

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux (Ubuntu 20.04+ / Debian 11+) |
| Node.js | 18.0.0+（推荐 20 LTS） |
| 内存 | 最少 512MB |
| 磁盘 | 最少 1GB 可用空间 |

### 开发环境

| 项目 | 要求 |
|------|------|
| 操作系统 | macOS / Linux / Windows (WSL2) |
| Node.js | 20 LTS（推荐） |
| pnpm | 8.0.0+ |
| 内存 | 最少 2GB |
| 磁盘 | 最少 1GB 可用空间 |

---

## 配置管理

### 配置文件位置

| 配置 | 路径 | 说明 |
|------|------|------|
| 系统配置 | `/etc/organic/config.json` | 系统级 |
| 项目配置 | `./.organic.json` | 项目级 |
| 用户配置 | `~/.organic/config.json` | 用户级 |

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `ORGANIC_HOME` | 安装目录 | `/opt/organic` |
| `ORGANIC_CONFIG` | 配置文件路径 | `/etc/organic/config.json` |
| `ORGANIC_LOG_LEVEL` | 日志级别 | `info` / `debug` / `warn` / `error` |
| `ORGANIC_PERMISSION_LEVEL` | 默认权限级别 | `L2` |

### 生产配置示例

```json
{
  "sandbox": {
    "enabled": true,
    "permissionLevel": "L2",
    "maxOperationsPerSession": 500,
    "requireConfirmation": true,
    "enableRecording": true
  }
}
```

---

## 卸载

```bash
# 使用安装脚本卸载
curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --uninstall

# 或手动删除
rm -rf ~/.organic
rm -rf /usr/local/lib/organic
```

---

## Docker 部署详细说明

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制项目文件
COPY . .

# 安装依赖
RUN pnpm install --prod --no-frozen-lockfile

# 构建
RUN pnpm build

# 设置环境变量
ENV NODE_ENV=production

ENTRYPOINT ["node", "packages/ui/cli.js"]
```

### 构建和运行

```bash
# 构建
docker build -t organic-interface:latest .

# 运行
docker run -it organic-interface:latest

# 后台运行
docker run -d --name organic organic-interface:latest
```

---

## 性能优化

### 生产环境优化

1. **仅安装生产依赖**:
```bash
pnpm install --prod
```

2. **使用生产模式**:
```bash
NODE_ENV=production organic
```

3. **限制内存使用**:
```bash
NODE_OPTIONS="--max-old-space-size=512" organic
```

### 沙箱性能优化

```typescript
// 限制单会话操作数
sandbox.updateConfig({ maxOperationsPerSession: 100 });

// 关闭操作记录（减少 I/O）
sandbox.updateConfig({ enableRecording: false });
```

---

## 安全加固

### 生产环境安全建议

1. **限制权限级别**: 生产环境使用 L2 或 L3，避免使用 L4
2. **启用敏感操作确认**: `requireConfirmation: true`
3. **限制操作数**: 设置合理的 `maxOperationsPerSession`
4. **配置拒绝路径**: 添加生产环境特定的拒绝路径
5. **启用操作记录**: 保留审计日志

```typescript
sandbox.updateConfig({
  permissionLevel: 'L2',
  maxOperationsPerSession: 200,
  requireConfirmation: true,
  enableRecording: true,
  deniedPaths: ['/etc', '/root', '/proc', '/sys', '/var/log'],
});
```

---

## 监控和日志

### 日志级别

| 级别 | 说明 | 使用场景 |
|------|------|----------|
| `debug` | 调试信息 | 开发环境 |
| `info` | 一般信息 | 生产环境 |
| `warn` | 警告 | 需要关注 |
| `error` | 错误 | 需要立即处理 |

### 设置日志级别

```bash
# 环境变量
export ORGANIC_LOG_LEVEL=info

# 代码中
import { createLogger } from '@organic/utils';
const logger = createLogger('my-module', { level: 'info' });
```

---

## 相关文档

- [配置参考](./configuration.md) — 配置选项
- [安全模型](./security-model.md) — 安全配置
- [故障排除](./troubleshooting.md) — 常见问题
- [开发指南](./development-guide.md) — 开发流程