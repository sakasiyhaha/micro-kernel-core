/**
 * ============================================================
 * kernel-manager.ts - 内核管理器
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector } from '@devtools/micro-kernel';

export interface DemoResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class KernelManager {
  private kernel: Kernel | null = null;
  private logger: Logger;
  private tracer: Tracer;
  private metrics: MetricsCollector;

  constructor() {
    this.logger = new Logger({ minLevel: 'DEBUG' });
    this.tracer = new Tracer({ enabled: true });
    this.metrics = new MetricsCollector();
  }

  initKernel(debug: boolean = false): void {
    this.kernel = new Kernel({
      version: '1.0.0',
      strictMode: true,
      defaultFallback: 'null',
      debug,
    });
  }

  getKernel(): Kernel | null {
    return this.kernel;
  }

  async resetKernel(): Promise<void> {
    if (this.kernel) {
      await this.kernel.destroy();
    }
    this.kernel = null;
    this.logger.clearMemoryLogs();
    this.tracer.clear();
    this.metrics.clear();
  }

  async runDemo(
    demoFn: (kernel: Kernel, logger: Logger, tracer: Tracer, metrics: MetricsCollector) => Promise<void>
  ): Promise<DemoResult> {
    if (!this.kernel) {
      return { success: false, message: '内核未初始化' };
    }

    try {
      await demoFn(this.kernel, this.logger, this.tracer, this.metrics);
      return { success: true, message: '演示执行完成' };
    } catch (err) {
      return {
        success: false,
        message: '演示执行失败',
        error: (err as Error).message,
      };
    }
  }

  getState() {
    if (!this.kernel) return null;
    return this.kernel.getState();
  }

  getLogs() {
    return this.logger.getMemoryLogs();
  }

  getSpans() {
    return this.tracer.getSpans();
  }

  getMetrics() {
    return this.metrics.snapshot();
  }
}