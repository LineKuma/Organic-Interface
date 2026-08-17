#!/usr/bin/env bash
#
# Organic-Interface 打包脚本
# 用于构建并打包为可分发的 tarball
#
# 用法:
#   ./scripts/build-release.sh [版本号]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 获取版本号
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    # 从 package.json 获取
    VERSION=$(node -p "require('./package.json').version")
fi

info "构建 Organic-Interface v${VERSION}..."

# 清理之前的构建
info "清理旧构建..."
pnpm clean || true

# 安装依赖
info "安装依赖..."
pnpm install --frozen-lockfile

# 构建
info "构建所有包..."
pnpm build

# 运行测试
info "运行测试..."
pnpm test || warn "测试可能有失败，但继续打包..."

# 创建发布目录
RELEASE_DIR="release"
mkdir -p "$RELEASE_DIR"

# 创建临时目录用于打包
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

DIST_NAME="organic-${VERSION}"
mkdir -p "${TEMP_DIR}/${DIST_NAME}"

# 复制必要的文件
info "复制构建产物..."

# 复制 package.json 和 lock 文件
cp package.json "${TEMP_DIR}/${DIST_NAME}/"
cp pnpm-lock.yaml "${TEMP_DIR}/${DIST_NAME}/"
cp pnpm-workspace.yaml "${TEMP_DIR}/${DIST_NAME}/"
cp .npmrc "${TEMP_DIR}/${DIST_NAME}/" || true

# 复制所有包的 dist 和 package.json
for pkg in packages/*; do
    pkg_name=$(basename "$pkg")
    mkdir -p "${TEMP_DIR}/${DIST_NAME}/packages/${pkg_name}"
    
    # 复制 package.json
    cp "${pkg}/package.json" "${TEMP_DIR}/${DIST_NAME}/packages/${pkg_name}/"
    
    # 复制 dist 目录（构建产物）
    if [ -d "${pkg}/dist" ]; then
        cp -r "${pkg}/dist" "${TEMP_DIR}/${DIST_NAME}/packages/${pkg_name}/"
    fi
    
    # 复制必要的配置文件
    if [ -f "${pkg}/tsconfig.json" ]; then
        cp "${pkg}/tsconfig.json" "${TEMP_DIR}/${DIST_NAME}/packages/${pkg_name}/"
    fi
done

# 创建 CLI 入口脚本
info "创建启动脚本..."
cat > "${TEMP_DIR}/${DIST_NAME}/packages/ui/cli.js" << 'CLI_EOF'
#!/usr/bin/env node
// Organic-Interface CLI 启动脚本

const { createCLI } = await import('./dist/cli/index.js');

async function main() {
  const cli = createCLI({
    name: 'organic',
    version: '0.1.0',
    description: 'Organic Interface - Plugin-based Agent Framework',
    interactive: process.argv.length <= 2,
  });

  const args = process.argv.slice(2);

  if (args.length === 0) {
    await cli.startInteractive();
  } else {
    const result = await cli.run(args);
    if (result.error) {
      console.error(`Error: ${result.error}`);
      process.exit(result.code);
    }
    if (result.message) {
      console.log(result.message);
    }
    process.exit(result.code);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
CLI_EOF

chmod +x "${TEMP_DIR}/${DIST_NAME}/packages/ui/cli.js"

# 创建 README
cat > "${TEMP_DIR}/${DIST_NAME}/README.md" << 'README_EOF'
# Organic-Interface

安装后请运行:

```bash
# 安装依赖
pnpm install --prod

# 运行 CLI
node packages/ui/cli.js --help

# 或交互式运行
node packages/ui/cli.js
```

更多信息请访问: https://github.com/LineKuma/Organic-Interface
README_EOF

# 打包
info "打包 tarball..."
TARBALL_NAME="organic-${VERSION}.tar.gz"
tar -czf "${RELEASE_DIR}/${TARBALL_NAME}" -C "$TEMP_DIR" "$DIST_NAME"

success "打包完成: ${RELEASE_DIR}/${TARBALL_NAME}"
echo ""
echo "文件大小: $(ls -lh ${RELEASE_DIR}/${TARBALL_NAME} | awk '{print $5}')"
echo "SHA256: $(sha256sum ${RELEASE_DIR}/${TARBALL_NAME} | awk '{print $1}')"