/**
 * ============================================================
 * demos/observability.ts - 可观测性演示
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector } from '@devtools/micro-kernel';

export async function runObservabilityDemo(
  kernel: Kernel,
  logger: Logger,
  tracer: Tracer,
  metrics: MetricsCollector
): Promise<void> {
  logger.info('📊 可观测性演示开始');

  // 注册带可观测性的扩展
  kernel.add('obs.hello', {
    id: 'hello-impl',
    pointId: 'obs.hello',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx, name: string) => {
      const span = tracer.startSpan('hello-execute', undefined, { name });
      metrics.incrementCounter('obs.hello.calls');

      logger.debug(`执行 hello 扩展`, { name }, ctx.traceId);

      await new Promise(resolve => setTimeout(resolve, 10));
      metrics.recordTimer('obs.hello.duration', 10);

      tracer.endSpan(span, { result: 'success' });
      return `Hello, ${name}!`;
    },
  });
  logger.debug('已注册: hello-impl');

  kernel.add('obs.slow', {
    id: 'slow-impl',
    pointId: 'obs.slow',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx) => {
      const span = tracer.startSpan('slow-execute', undefined, { type: 'slow' });
      metrics.incrementCounter('obs.slow.calls');

      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 150));
      const duration = Date.now() - start;

      metrics.recordTimer('obs.slow.duration', duration);
      logger.warn(`慢速操作耗时 ${duration}ms`, { duration }, ctx.traceId);
      tracer.endSpan(span, { duration });

      return '慢速操作完成';
    },
  });
  logger.debug('已注册: slow-impl');

  // 执行扩展
  await kernel.execute('obs.hello', 'World');
  await kernel.execute('obs.slow');

  // 显示可观测性数据
  const logs = logger.getMemoryLogs();
  const spans = tracer.getSpans();
  const snapshot = metrics.snapshot();

  logger.info(`📊 日志: ${logs.length} 条`);
  logger.info(`📊 追踪: ${spans.length} 个 Span`);
  logger.info(`📊 指标: ${snapshot.counters.length} 个计数器, ${snapshot.timers.length} 个计时器`);

  // 显示最近日志
  logs.slice(-3).forEach((log: any) => {
    logger.debug(`  [${log.level}] ${log.message}`);
  });

  logger.info('✅ 可观测性演示完成');
}