/**
 * ============================================================
 * demo-observability.ts
 * 可观测性演示
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector } from '@devtools/micro-kernel';
import { printSection, printResult, printSubSection } from './utils.js';

export async function runObservabilityDemo(): Promise<void> {
  printSection('📊 可观测性演示');

  // 1. 创建可观测性组件
  const logger = new Logger({ minLevel: 'DEBUG' });
  const tracer = new Tracer({ enabled: true, sampleRate: 1.0 });
  const metrics = new MetricsCollector();

  console.log('✅ 日志器、追踪器、指标收集器已创建');

  // 2. 创建内核
  const kernel = new Kernel({
    version: '1.0.0',
    strictMode: true,
    debug: false,
  });

  // 3. 注册扩展
  printSubSection('注册 3 个带可观测性的扩展');

  kernel.add('api.hello', {
    id: 'hello-impl',
    pointId: 'api.hello',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx, name: string) => {
      const spanId = tracer.startSpan('hello-execute', undefined, { name });
      metrics.incrementCounter('api.hello.calls');

      logger.debug(`执行 hello 扩展`, { name }, ctx.traceId);

      await new Promise(resolve => setTimeout(resolve, 10));
      metrics.recordTimer('api.hello.duration', 10);

      tracer.endSpan(spanId, { result: 'success' });
      return `Hello, ${name}!`;
    },
  });
  console.log('✅ hello-impl');

  kernel.add('api.slow', {
    id: 'slow-impl',
    pointId: 'api.slow',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx) => {
      const spanId = tracer.startSpan('slow-execute', undefined, { type: 'slow' });
      metrics.incrementCounter('api.slow.calls');

      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 150));
      const duration = Date.now() - start;

      metrics.recordTimer('api.slow.duration', duration);
      logger.warn(`慢速操作耗时 ${duration}ms`, { duration }, ctx.traceId);
      tracer.endSpan(spanId, { duration });

      return '慢速操作完成';
    },
  });
  console.log('✅ slow-impl');

  kernel.add('api.error', {
    id: 'error-impl',
    pointId: 'api.error',
    version: '1.0.0',
    apiVersion: '1.0.0',
    execute: async (ctx) => {
      const spanId = tracer.startSpan('error-execute', undefined, { type: 'error' });
      metrics.incrementCounter('api.error.calls');
      metrics.incrementCounter('api.error.failures');

      logger.error('扩展执行失败', { error: '模拟错误' }, ctx.traceId);
      tracer.endSpan(spanId, { error: true });

      throw new Error('模拟错误');
    },
  });
  console.log('✅ error-impl');

  // 4. 执行测试
  printSubSection('执行扩展（生成可观测性数据）');

  await kernel.execute('api.hello', 'World');
  printResult('hello-impl', '执行成功');

  await kernel.execute('api.slow');
  printResult('slow-impl', '执行成功');

  try {
    await kernel.execute('api.error');
  } catch (_) {
    printResult('error-impl', '执行失败（预期行为）', false);
  }

  // 5. 查看日志
  printSubSection('日志摘要 (最近 3 条)');
  const logs = logger.getMemoryLogs().slice(-3);
  logs.forEach((log, i) => {
    console.log(`   ${i + 1}. [${log.level}] ${log.message}${log.traceId ? ` (trace: ${log.traceId.slice(0, 12)}...)` : ''}`);
  });

  // 6. 查看追踪
  printSubSection('追踪数据');
  const spans = tracer.getSpans();
  spans.forEach((span, i) => {
    const duration = span.duration ? `${span.duration}ms` : '进行中';
    console.log(`   ${i + 1}. ${span.name} (${duration})${span.parentId ? ` ← parent: ${span.parentId.slice(0, 12)}...` : ''}`);
  });

  // 7. 查看指标
  printSubSection('指标摘要');
  const snapshot = metrics.snapshot();
  snapshot.counters.forEach(c => {
    console.log(`   📈 ${c.name}: ${c.value}`);
  });
  snapshot.timers.forEach(t => {
    console.log(`   ⏱️ ${t.name}: avg=${t.avgMs.toFixed(2)}ms, count=${t.count}`);
  });

  await kernel.destroy();
  console.log('\n✅ 内核已销毁');
}