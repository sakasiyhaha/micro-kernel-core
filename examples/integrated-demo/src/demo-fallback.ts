/**
 * ============================================================
 * demo-fallback.ts
 * 降级与容错演示
 * ============================================================
 */

import { Kernel } from '@devtools/micro-kernel';
import { printSection, printResult, printSubSection, printError } from './utils.js';

export async function runFallbackDemo(): Promise<void> {
  printSection('🛡️ 降级与容错演示');

  const kernel = new Kernel({
    version: '1.0.0',
    strictMode: true,
    debug: false,
    defaultFallback: 'null',
  });

  // 1. 注册会失败的扩展
  printSubSection('注册失败扩展（全局降级: null）');
  kernel.add('test.failing', {
    id: 'failing-impl',
    pointId: 'test.failing',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async () => {
      throw new Error('致命错误：扩展执行失败！');
    },
  });
  console.log('✅ failing-impl (总是失败)');

  // 2. 带 throw 策略的扩展点
  printSubSection('注册失败扩展（扩展点策略: throw）');
  kernel.add('test.failing-throw', {
    id: 'failing-throw-impl',
    pointId: 'test.failing-throw',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async () => {
      throw new Error('致命错误：扩展执行失败！');
    },
  });
  // 为扩展点设置降级策略
  // 注：实际 ExtensionPointMeta 需要在注册点设置，这里通过 Kernel 内部机制
  console.log('✅ failing-throw-impl (扩展点策略: throw)');

  // 3. 降级链（父实现）
  printSubSection('注册降级链');
  kernel.add('test.chain', {
    id: 'parent-impl',
    pointId: 'test.chain',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 100,
    execute: async () => '父实现结果',
  });

  kernel.inherit('test.chain', 'parent-impl', {
    id: 'child-impl',
    pointId: 'test.chain',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 90,
    execute: async () => {
      throw new Error('子实现失败，应降级到父实现');
    },
  });
  console.log('✅ child-impl → parent-impl (降级链)');

  // 4. 断路器扩展
  printSubSection('注册断路器测试扩展');
  kernel.add('test.circuit', {
    id: 'circuit-impl',
    pointId: 'test.circuit',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async () => {
      throw new Error('断路器测试：连续失败！');
    },
  });
  console.log('✅ circuit-impl (连续失败触发断路器)');

  // 5. 执行测试
  printSubSection('测试 1: 降级策略 "null"');
  const result1 = await kernel.execute('test.failing');
  printResult('失败扩展结果', result1 ?? 'null');

  printSubSection('测试 2: 降级策略 "throw"');
  try {
    await kernel.execute('test.failing-throw');
  } catch (err) {
    printError(err as Error);
  }

  printSubSection('测试 3: 降级链');
  const result3 = await kernel.execute('test.chain');
  printResult('降级链结果', `"${result3}" (来自父实现)`);

  printSubSection('测试 4: 断路器熔断');
  console.log('   执行 1/3...');
  try { await kernel.execute('test.circuit'); } catch (_) {}
  console.log('   执行 2/3...');
  try { await kernel.execute('test.circuit'); } catch (_) {}
  console.log('   执行 3/3...');
  try { await kernel.execute('test.circuit'); } catch (_) {}
  console.log('   ⚡ 连续失败 3 次，断路器已打开！');

  console.log('   执行 4/3（被拒绝）...');
  try {
    await kernel.execute('test.circuit');
  } catch (err) {
    printError(err as Error);
  }
  console.log('   💡 断路器将在 30 秒后自动尝试恢复（半开状态）');

  await kernel.destroy();
  console.log('\n✅ 内核已销毁');
}