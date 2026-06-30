/**
 * ============================================================
 * demo-inheritance.ts
 * 继承与覆盖演示
 * ============================================================
 */

import { Kernel } from '@devtools/micro-kernel';
import { printSection, printResult, printSubSection } from './utils.js';

export async function runInheritanceDemo(): Promise<void> {
  printSection('🌳 继承与覆盖演示');

  const kernel = new Kernel({
    version: '1.0.0',
    strictMode: true,
    debug: false,
  });

  // 1. 基础实现（父扩展）
  printSubSection('注册基础问候扩展 (父)');
  kernel.add('greeting.generate', {
    id: 'greeting-base',
    pointId: 'greeting.generate',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 100,
    execute: async (ctx, name: string) => {
      return `Hello, ${name}!`;
    },
  });
  console.log('✅ greeting-base (优先级 100)');

  // 2. 继承实现（子扩展）
  printSubSection('继承创建正式问候扩展 (子)');
  kernel.inherit('greeting.generate', 'greeting-base', {
    id: 'greeting-formal',
    pointId: 'greeting.generate',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 90,
    execute: async (ctx, name: string) => {
      const base = await ctx.super(name);
      return `Dear ${base.slice(7)}`; // "Hello, John!" -> "Dear John!"
    },
  });
  console.log('✅ greeting-formal (优先级 90, 继承自 greeting-base)');

  // 3. 多层继承
  printSubSection('多层继承 (热情问候)');
  kernel.inherit('greeting.generate', 'greeting-formal', {
    id: 'greeting-enthusiastic',
    pointId: 'greeting.generate',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 80,
    execute: async (ctx, name: string) => {
      const formal = await ctx.super(name);
      return `${formal} Welcome to Micro-Kernel!`;
    },
  });
  console.log('✅ greeting-enthusiastic (优先级 80, 继承自 greeting-formal)');

  // 4. 覆盖实现
  printSubSection('覆盖基础实现 (中文问候)');
  kernel.override('greeting.generate', 'greeting-base', {
    id: 'greeting-chinese',
    pointId: 'greeting.generate',
    version: '2.0.0',
    apiVersion: '1.0.0',
    priority: 70,
    execute: async (ctx, name: string) => {
      return `你好，${name}！`;
    },
  });
  console.log('✅ greeting-chinese (优先级 70, 覆盖 greeting-base)');

  // 5. 执行测试
  printSubSection('执行问候链');

  console.log('📊 所有实现（按优先级排序）:');
  const impls = kernel.getState().implementations['greeting.generate'];
  impls.forEach((impl, i) => {
    console.log(`   ${i + 1}. ${impl.id} (优先级: ${impl.priority})`);
  });

  console.log('\n📊 继承链:');
  console.log('  greeting-enthusiastic (80) → greeting-formal (90) → greeting-base (100)');
  console.log('  greeting-chinese (70) 覆盖了 greeting-base');
  console.log('  ✅ 实际调用: greeting-enthusiastic → greeting-formal → greeting-base\n');

  const result = await kernel.execute('greeting.generate', 'John');
  printResult('执行结果', `"${result}"`);

  await kernel.destroy();
  console.log('\n✅ 内核已销毁');
}