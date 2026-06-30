/**
 * ============================================================
 * demo-basic.ts
 * 基础用法演示
 * ============================================================
 */

import { Kernel } from '@devtools/micro-kernel';
import { printSection, printResult, printSubSection } from './utils.js';

export async function runBasicDemo(): Promise<void> {
  printSection('📘 基础用法演示');

  // 1. 创建内核
  const kernel = new Kernel({
    version: '1.0.0',
    strictMode: true,
    debug: false,
    defaultFallback: 'null',
  });

  console.log('✅ 内核已创建，版本:', kernel.version);

  // 2. 注册扩展
  printSubSection('注册 4 个计算器扩展');

  kernel.add('calculator.add', {
    id: 'add-impl',
    pointId: 'calculator.add',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx, a: number, b: number) => {
      console.log(`   [add] ${a} + ${b}`);
      return a + b;
    },
  });

  kernel.add('calculator.subtract', {
    id: 'subtract-impl',
    pointId: 'calculator.subtract',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx, a: number, b: number) => {
      console.log(`   [subtract] ${a} - ${b}`);
      return a - b;
    },
  });

  kernel.add('calculator.multiply', {
    id: 'multiply-impl',
    pointId: 'calculator.multiply',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx, a: number, b: number) => {
      console.log(`   [multiply] ${a} × ${b}`);
      return a * b;
    },
  });

  kernel.add('calculator.divide', {
    id: 'divide-impl',
    pointId: 'calculator.divide',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx, a: number, b: number) => {
      if (b === 0) throw new Error('除数不能为 0');
      console.log(`   [divide] ${a} ÷ ${b}`);
      return a / b;
    },
  });

  console.log('✅ 已注册 4 个计算器扩展');

  // 3. 执行扩展
  printSubSection('执行计算器扩展');

  const testCases: Array<{ pointId: string; a: number; b: number; label: string }> = [
    { pointId: 'calculator.add', a: 10, b: 20, label: '10 + 20' },
    { pointId: 'calculator.subtract', a: 20, b: 5, label: '20 - 5' },
    { pointId: 'calculator.multiply', a: 6, b: 7, label: '6 × 7' },
    { pointId: 'calculator.divide', a: 10, b: 2, label: '10 ÷ 2' },
  ];

  for (const tc of testCases) {
    const result = await kernel.execute(tc.pointId, tc.a, tc.b);
    printResult(tc.label, result);
  }

  // 4. 除法除以零（降级返回 null）
  printSubSection('错误处理（降级策略为 null）');
  const errorResult = await kernel.execute('calculator.divide', 10, 0);
  printResult('10 ÷ 0', errorResult ?? 'null（降级返回）');

  // 5. 查看状态
  printSubSection('内核状态');
  const state = kernel.getState();
  console.log(`  版本: ${state.version}`);
  console.log(`  严格模式: ${state.strictMode}`);
  console.log(`  已注册扩展点: ${state.points.length}`);

  await kernel.destroy();
  console.log('\n✅ 内核已销毁');
}