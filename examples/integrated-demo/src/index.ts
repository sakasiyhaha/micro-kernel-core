/**
 * ============================================================
 * index.ts
 * 集成示例 - 通过命令行参数选择运行模块
 * 
 * 用法:
 *   npm start:basic        # 基础用法
 *   npm start:inheritance  # 继承与覆盖
 *   npm start:fallback     # 降级与容错
 *   npm start:permissions  # 权限管理
 *   npm start:observability # 可观测性
 *   npm start:all          # 运行所有演示
 * ============================================================
 */

import { runBasicDemo } from './demo-basic.js';
import { runInheritanceDemo } from './demo-inheritance.js';
import { runFallbackDemo } from './demo-fallback.js';
import { runPermissionsDemo } from './demo-permissions.js';
import { runObservabilityDemo } from './demo-observability.js';

// ============================================================
// 命令行参数解析
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

// ============================================================
// 演示映射
// ============================================================

const demos: Record<string, { name: string; run: () => Promise<void> }> = {
  basic: {
    name: '基础用法 (Basic)',
    run: runBasicDemo,
  },
  inheritance: {
    name: '继承与覆盖 (Inheritance)',
    run: runInheritanceDemo,
  },
  fallback: {
    name: '降级与容错 (Fallback)',
    run: runFallbackDemo,
  },
  permissions: {
    name: '权限管理 (Permissions)',
    run: runPermissionsDemo,
  },
  observability: {
    name: '可观测性 (Observability)',
    run: runObservabilityDemo,
  },
  all: {
    name: '所有演示 (All)',
    run: async () => {
      await runBasicDemo();
      await runInheritanceDemo();
      await runFallbackDemo();
      await runPermissionsDemo();
      await runObservabilityDemo();
    },
  },
};

// ============================================================
// 显示帮助
// ============================================================

function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     Micro-Kernel Core - 集成示例                        ║
╠══════════════════════════════════════════════════════════╣
║  用法: npm run start:<demo>                            ║
║                                                        ║
║  可用演示:                                             ║
║    npm run start:basic         基础用法                 ║
║    npm run start:inheritance   继承与覆盖               ║
║    npm run start:fallback      降级与容错               ║
║    npm run start:permissions   权限管理                 ║
║    npm run start:observability 可观测性                 ║
║    npm run start:all           运行所有演示             ║
╚══════════════════════════════════════════════════════════╝
`);
}

// ============================================================
// 主函数
// ============================================================

async function main(): Promise<void> {
  if (!command || command === 'help') {
    showHelp();
    return;
  }

  const demo = demos[command];
  if (!demo) {
    console.log(`❌ 未知命令: ${command}`);
    console.log('可用命令: basic, inheritance, fallback, permissions, observability, all');
    showHelp();
    return;
  }

  console.log(`\n🚀 运行: ${demo.name}\n`);
  await demo.run();
  console.log('\n✅ 演示完成！');
}

main().catch(console.error);