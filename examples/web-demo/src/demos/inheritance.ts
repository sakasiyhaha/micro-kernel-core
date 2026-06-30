/**
 * ============================================================
 * demos/inheritance.ts - 继承与覆盖演示
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector } from '@devtools/micro-kernel';

export async function runInheritanceDemo(
  kernel: Kernel,
  logger: Logger,
  _tracer: Tracer,
  metrics: MetricsCollector
): Promise<void> {
  logger.info('🌳 继承与覆盖演示开始');

  // 1. 注册父实现
  kernel.add('greeting', {
    id: 'base-greeting',
    pointId: 'greeting',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 100,
    execute: async (_ctx, name: string) => `Hello, ${name}!`,
  });
  logger.debug('已注册: base-greeting');

  // 2. 继承：正式问候
  kernel.inherit('greeting', 'base-greeting', {
    id: 'formal-greeting',
    pointId: 'greeting',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 90,
    execute: async (ctx, name: string) => {
      const base = await ctx.super(name);
      return `Dear ${base.slice(7)}`;
    },
  });
  logger.debug('已注册: formal-greeting (继承自 base-greeting)');

  // 3. 多层继承：热情问候
  kernel.inherit('greeting', 'formal-greeting', {
    id: 'enthusiastic-greeting',
    pointId: 'greeting',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 80,
    execute: async (ctx, name: string) => {
      const formal = await ctx.super(name);
      return `${formal} Welcome!`;
    },
  });
  logger.debug('已注册: enthusiastic-greeting (继承自 formal-greeting)');

  // 4. 覆盖：中文问候
  kernel.override('greeting', 'base-greeting', {
    id: 'chinese-greeting',
    pointId: 'greeting',
    version: '2.0.0',
    apiVersion: '1.0.0',
    priority: 70,
    execute: async (_ctx, name: string) => `你好，${name}！`,
  });
  logger.debug('已注册: chinese-greeting (覆盖 base-greeting)');

  metrics.incrementCounter('demo.inheritance.registered', 4);

  // 5. 执行测试
  const result = await kernel.execute('greeting', 'John');
  logger.info(`执行结果: "${result}"`);

  // 6. 显示继承链
  const state = kernel.getState();
  const impls = state.implementations['greeting'];
  logger.info(`📊 所有实现 (${impls.length} 个):`);
  impls.forEach((impl: any) => {
    logger.debug(`  - ${impl.id} (优先级: ${impl.priority})${impl.parentId ? ` ← 继承自 ${impl.parentId}` : ''}`);
  });

  metrics.recordTimer('demo.inheritance.execution', 3);
  logger.info('✅ 继承与覆盖演示完成');
}