/**
 * ============================================================
 * demos/basic.ts - 基础用法演示
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector } from '@devtools/micro-kernel';
import type { ExecutionContext } from '@devtools/micro-kernel';
export async function runBasicDemo(
  kernel: Kernel,
  logger: Logger,
  tracer: Tracer,
  metrics: MetricsCollector
): Promise<void> {
  logger.info('📘 基础用法演示开始');

  // 1. 注册计算器扩展
  const addSpan = tracer.startSpan('register-add');
  kernel.add('calc.add', {
    id: 'add-impl',
    pointId: 'calc.add',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (_ctx: ExecutionContext, a: number, b: number) => a + b,
  });
  tracer.endSpan(addSpan, { registered: 'add' });
  logger.debug('已注册: calc.add');

  kernel.add('calc.subtract', {
    id: 'subtract-impl',
    pointId: 'calc.subtract',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (_ctx: ExecutionContext, a: number, b: number) => a - b,
  });
  logger.debug('已注册: calc.subtract');

  kernel.add('calc.multiply', {
    id: 'multiply-impl',
    pointId: 'calc.multiply',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (_ctx: ExecutionContext, a: number, b: number) => a * b,
  });
  logger.debug('已注册: calc.multiply');

  kernel.add('calc.divide', {
    id: 'divide-impl',
    pointId: 'calc.divide',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (_ctx: ExecutionContext, a: number, b: number) => {
      if (b === 0) throw new Error('除数不能为 0');
      return a / b;
    },
  });
  logger.debug('已注册: calc.divide');

  metrics.incrementCounter('demo.basic.registered', 4);

  // 2. 执行计算
  const results: Record<string, number> = {};

  const execSpan = tracer.startSpan('execute-calculations');
  results.add = await kernel.execute('calc.add', 10, 20);
  logger.info(`10 + 20 = ${results.add}`);

  results.subtract = await kernel.execute('calc.subtract', 20, 5);
  logger.info(`20 - 5 = ${results.subtract}`);

  results.multiply = await kernel.execute('calc.multiply', 6, 7);
  logger.info(`6 × 7 = ${results.multiply}`);

  results.divide = await kernel.execute('calc.divide', 10, 2);
  logger.info(`10 ÷ 2 = ${results.divide}`);

  metrics.recordTimer('demo.basic.execution', 5);
  tracer.endSpan(execSpan, { results: JSON.stringify(results) });

  // 3. 测试错误处理（除以 0，返回 null）
  const errorResult = await kernel.execute('calc.divide', 10, 0);
  logger.warn(`10 ÷ 0 = ${errorResult} (降级返回 null)`);
  metrics.incrementCounter('demo.basic.errors', 1);

  logger.info('✅ 基础用法演示完成');
}