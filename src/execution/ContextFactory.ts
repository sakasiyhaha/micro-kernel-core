/**
 * ============================================================
 * ContextFactory.ts
 * 执行上下文工厂
 * 
 * 职责：
 * - 构建 ExecutionContext 对象
 * - 注入 super 代理
 * - 绑定 logger 和 store
 * ============================================================
 */

import type {
  Extension,
  ExecutionContext,
  Logger,
  SharedStore,
} from '../types/extension.types.js';
import { SuperCallStack } from './SuperCallStack.js';
import { DraftManager } from './DraftManager.js';

/**
 * 简单日志器实现
 */
class ConsoleLogger implements Logger {
  constructor(private traceId: string) {}

  debug(msg: string, meta?: Record<string, unknown>): void {
    console.debug(`[Kernel][${this.traceId}] DEBUG:`, msg, meta || '');
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    console.info(`[Kernel][${this.traceId}] INFO:`, msg, meta || '');
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(`[Kernel][${this.traceId}] WARN:`, msg, meta || '');
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(`[Kernel][${this.traceId}] ERROR:`, msg, meta || '');
  }
}

/**
 * 共享存储实现
 */
class MemorySharedStore implements SharedStore {
  private draftManager = new DraftManager();
  private committedData: Record<string, any> = {};

  get<T = any>(path: string): T | undefined {
    if (this.draftManager.isActive()) {
      const draftValue = this.draftManager.get(path);
      if (draftValue !== undefined) {
        return draftValue as T;
      }
    }
    return this.getNestedValue(this.committedData, path) as T | undefined;
  }

  set(path: string, value: any): void {
    if (!this.draftManager.isActive()) {
      this.draftManager.beginDraft(this.committedData);
    }
    this.draftManager.set(path, value);
  }

  commit(): void {
    if (this.draftManager.isActive()) {
      this.committedData = this.draftManager.commit();
    }
  }

  discard(): void {
    if (this.draftManager.isActive()) {
      this.draftManager.discard();
    }
  }

  hasDraft(): boolean {
    return this.draftManager.isActive() && this.draftManager.hasChanges();
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}

export class ContextFactory {
  private callStack: SuperCallStack;

  constructor(maxDepth: number = 50) {
    this.callStack = new SuperCallStack(maxDepth);
  }

  create(
    extension: Extension,
    pointId: string,
    args: any[],
    traceId: string,
    featureFlags?: Record<string, boolean>
  ): ExecutionContext {
    const store = new MemorySharedStore();
    const logger = new ConsoleLogger(traceId);
    const startTime = Date.now();

    if (this.callStack.hasCycle(extension.id)) {
      throw new Error(`检测到循环调用: ${extension.id}`);
    }

    this.callStack.push({
      extensionId: extension.id,
      pointId: pointId,
      parentId: extension.parentId || null,
    });

    // ✅ 修正：使用 _args 表示故意未使用的参数
    const superProxy = async (..._args: any[]): Promise<any> => {
      const currentFrame = this.callStack.current();
      if (!currentFrame || !currentFrame.parentId) {
        throw new Error(`当前实现 "${extension.id}" 没有父实现可调用`);
      }
      throw new Error(
        'super 调用需要由执行引擎注入实现，请确保通过 Executor 调用'
      );
    };

    const context: ExecutionContext = {
      traceId,
      extensionId: extension.id,
      pointId,
      args,
      startTime,
      metadata: {},
      logger,
      store,
      apiVersion: extension.apiVersion,
      super: superProxy,
      featureFlags,
    };

    return context;
  }

  cleanup(): void {
    this.callStack.pop();
  }

  getCallStackSnapshot() {
    return this.callStack.snapshot();
  }

  clearStack(): void {
    this.callStack.clear();
  }
}