#!/usr/bin/env bash
#
# Organic-Interface 安装脚本
# 用于从 GitHub Release 下载并安装
#
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash
#   或
#   curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- --version v0.1.0
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
REPO_OWNER="LineKuma"
REPO_NAME="Organic-Interface"
DEFAULT_VERSION="latest"
INSTALL_DIR="${HOME}/.organic"
BIN_DIR="${INSTALL_DIR}/bin"
DIST_DIR="${INSTALL_DIR}/dist"

# 帮助信息
print_help() {
    cat << EOF
Organic-Interface 安装脚本

用法:
    curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash
    curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash -s -- [选项]

选项:
    -v, --version VERSION   指定安装版本 (默认: latest)
    -d, --dir DIRECTORY     指定安装目录 (默认: ~/.organic)
    -u, --uninstall         卸载 Organic-Interface
    -h, --help              显示帮助信息

示例:
    # 安装最新版本
    curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash

    # 安装指定版本
    curl -fsSL ... | bash -s -- --version v0.1.0

    # 安装到指定目录
    curl -fsSL ... | bash -s -- --dir /opt/organic

    # 卸载
    curl -fsSL ... | bash -s -- --uninstall

EOF
}

# 打印消息
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 检查依赖
check_dependencies() {
    info "检查依赖..."

    local missing=()

    # 检查 curl 或 wget
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        missing+=("curl 或 wget")
    fi

    # 检查 tar
    if ! command -v tar &> /dev/null; then
        missing+=("tar")
    fi

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing+=("node (Node.js 18+)")
    fi

    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        missing+=("pnpm (运行: npm install -g pnpm)")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        error "缺少以下依赖: ${missing[*]}\n请先安装这些依赖后再运行安装脚本。"
    fi

    success "所有依赖已满足"
}

# 获取最新版本号
get_latest_version() {
    local api_url="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"

    if command -v curl &> /dev/null; then
        curl -fsSL "$api_url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
    else
        wget -qO- "$api_url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
    fi
}

# 下载文件
download_file() {
    local url="$1"
    local output="$2"

    if command -v curl &> /dev/null; then
        curl -fsSL -o "$output" "$url"
    else
        wget -q -O "$output" "$url"
    fi
}

# 安装函数
install() {
    local version="$1"
    local install_dir="$2"

    info "开始安装 Organic-Interface ${version}..."

    # 检查依赖
    check_dependencies

    # 解析版本
    if [ "$version" = "latest" ]; then
        version=$(get_latest_version)
        info "最新版本: ${version}"
    fi

    # 确定下载 URL
    local download_url
    case "$(uname -s)" in
        Linux*)
            download_url="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/organic-linux-x64.tar.gz"
            ;;
        Darwin*)
            download_url="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/organic-darwin-x64.tar.gz"
            ;;
        *)
            error "不支持的操作系统: $(uname -s)"
            ;;
    esac

    # 创建临时目录
    local temp_dir
    temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # 下载
    info "正在下载 ${download_url}..."
    local tarball="${temp_dir}/organic.tar.gz"
    download_file "$download_url" "$tarball"

    # 创建安装目录
    mkdir -p "$install_dir"
    mkdir -p "${install_dir}/bin"
    mkdir -p "${install_dir}/dist"

    # 解压
    info "正在解压..."
    tar -xzf "$tarball" -C "${install_dir}/dist"

    # 创建可执行文件
    local bin_file="${install_dir}/bin/organic"
    cat > "$bin_file" << 'BIN_EOF'
#!/usr/bin/env bash
# Organic-Interface 启动脚本

ORGANIC_HOME="${ORGANIC_HOME:-$HOME/.organic}"
DIST_DIR="${ORGANIC_HOME}/dist"

if [ ! -d "$DIST_DIR" ]; then
    echo "Error: Organic-Interface not installed properly"
    echo "Please reinstall: curl -fsSL https://raw.githubusercontent.com/LineKuma/Organic-Interface/master/scripts/install.sh | bash"
    exit 1
fi

cd "$DIST_DIR"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install --prod
fi

# 运行 CLI
node packages/ui/cli.js "$@"
BIN_EOF

    chmod +x "$bin_file"

    # 添加到 PATH
    local profile=""
    if [ -f "$HOME/.bashrc" ]; then
        profile="$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then
        profile="$HOME/.zshrc"
    fi

    if [ -n "$profile" ]; then
        if ! grep -q 'ORGANIC_HOME' "$profile" 2>/dev/null; then
            echo "" >> "$profile"
            echo "# Organic-Interface" >> "$profile"
            echo "export ORGANIC_HOME=\"${install_dir}\"" >> "$profile"
            echo "export PATH=\"\${ORGANIC_HOME}/bin:\$PATH\"" >> "$profile"
            success "已添加到 PATH (请运行 'source $profile' 或重新打开终端)"
        fi
    fi

    success "安装完成！"
    echo ""
    echo "安装路径: ${install_dir}"
    echo "可执行文件: ${install_dir}/bin/organic"
    echo "版本: ${version}"
    echo ""
    echo "请运行以下命令使环境变量生效:"
    echo "  source $profile"
    echo ""
    echo "然后运行:"
    echo "  organic --help"
}

# 卸载函数
uninstall() {
    local install_dir="$1"

    if [ ! -d "$install_dir" ]; then
        warn "Organic-Interface 未安装在 ${install_dir}"
        return
    fi

    info "正在卸载 Organic-Interface..."
    rm -rf "$install_dir"
    success "已卸载 ${install_dir}"

    # 提示用户手动清理 PATH
    warn "请手动从你的 shell 配置文件 (~/.bashrc 或 ~/.zshrc) 中删除以下内容:"
    echo "  export ORGANIC_HOME=\"${install_dir}\""
    echo "  export PATH=\"\${ORGANIC_HOME}/bin:\$PATH\""
}

# 主函数
main() {
    local version="$DEFAULT_VERSION"
    local install_dir="$INSTALL_DIR"
    local action="install"

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                version="$2"
                shift 2
                ;;
            -d|--dir)
                install_dir="$2"
                shift 2
                ;;
            -u|--uninstall)
                action="uninstall"
                shift
                ;;
            -h|--help)
                print_help
                exit 0
                ;;
            *)
                error "未知选项: $1\n使用 --help 查看帮助信息"
                ;;
        esac
    done

    case "$action" in
        install)
            install "$version" "$install_dir"
            ;;
        uninstall)
            uninstall "$install_dir"
            ;;
    esac
}

main "$@"