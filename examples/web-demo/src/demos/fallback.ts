/**
 * ============================================================
 * demos/fallback.ts - 降级与容错演示（修正版）
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector } from '@devtools/micro-kernel';

export async function runFallbackDemo(
  kernel: Kernel,
  logger: Logger,
  _tracer: Tracer,
  metrics: MetricsCollector
): Promise<void> {
  logger.info('🛡️ 降级与容错演示开始');

  // 1. 注册失败扩展（默认降级为 null）
  kernel.add('failing.null', {
    id: 'failing-null',
    pointId: 'failing.null',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async () => {
      throw new Error('故意失败');
    },
  });
  logger.debug('已注册: failing-null (降级策略: null)');

  // 2. 执行失败扩展
  const result1 = await kernel.execute('failing.null');
  logger.info(`失败扩展返回: ${result1} (null)`);

  // 3. 注册降级链（修正：父实现注册到 chain 扩展点）
  kernel.add('chain', {
    id: 'parent-impl',
    pointId: 'chain',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 100,
    execute: async () => '父实现结果',
  });
  logger.debug('已注册: parent-impl (注册到 chain)');

  kernel.inherit('chain', 'parent-impl', {
    id: 'child-impl',
    pointId: 'chain',
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 90,
    execute: async () => {
      throw new Error('子实现失败');
    },
  });
  logger.debug('已注册: child-impl (继承自 parent-impl)');

  const result2 = await kernel.execute('chain');
  logger.info(`降级链结果: "${result2}" (来自父实现)`);

  // 4. 断路器演示
  kernel.add('circuit.test', {
    id: 'circuit-impl',
    pointId: 'circuit.test',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async () => {
      throw new Error('断路器测试失败');
    },
  });
  logger.debug('已注册: circuit-impl');

  let failures = 0;
  for (let i = 0; i < 4; i++) {
    try {
      await kernel.execute('circuit.test');
    } catch (_) {
      failures++;
      logger.warn(`第 ${i+1} 次执行失败 (累计 ${failures} 次)`);
    }
  }

  if (failures >= 3) {
    logger.warn('⚡ 连续失败 3 次，断路器已打开！');
    metrics.incrementCounter('demo.fallback.circuit_open', 1);
  }

  logger.info('✅ 降级与容错演示完成');
}