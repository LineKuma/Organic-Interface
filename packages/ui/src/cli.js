#!/usr/bin/env node
/**
 * Organic-Interface CLI 入口 (构建后)
 *
 * 用于打包发布的启动脚本
 */

// 导入 CLI 模块
const { createCLI } = await import('./dist/cli/index.js');

async function main() {
  // 创建 CLI
  const cli = createCLI({
    name: 'organic',
    version: '0.1.0',
    description: 'Organic Interface - Plugin-based Agent Framework',
    interactive: process.argv.length <= 2,
  });

  // 获取命令行参数
  const args = process.argv.slice(2);

  // 如果是交互式模式
  if (args.length === 0) {
    await cli.startInteractive();
  } else {
    // 执行命令
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
