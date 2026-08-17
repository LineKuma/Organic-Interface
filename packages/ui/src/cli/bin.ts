#!/usr/bin/env node
/**
 * Organic-Interface CLI 入口
 *
 * 用于打包发布的启动脚本
 */

import { createCLI } from './index.js';

interface CLIRunResult {
  error?: string;
  message?: string;
  code: number;
}

async function main(): Promise<void> {
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
    const result = (await cli.run(args)) as CLIRunResult;

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

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
