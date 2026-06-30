/**
 * ============================================================
 * Executor.ts
 * 执行引擎核心（最终版）
 * ============================================================
 */

import type { Extension, ExecutionContext } from '../types/extension.types.js';
import type { FallbackPolicy } from '../types/kernel.types.js';
import {
  ExtensionError,
  TimeoutError,
  CircuitOpenError,
} from '../types/errors.types.js';
import { ContextFactory } from './ContextFactory.js';
import { CircuitBreaker } from '../fallback/CircuitBreaker.js';
import { FallbackExecutor } from '../fallback/FallbackExecutor.js';
import { PermissionManager } from '../security/PermissionManager.js';
import type { Permission } from '../types/kernel.types.js';

export interface ExecutorOptions {
  defaultFallback?: FallbackPolicy;
  timeoutMs?: number;
  enableCircuitBreaker?: boolean;
  maxDepth?: number;
  permissionManager?: PermissionManager;
  enablePermissions?: boolean;
}

export class Executor {
  private contextFactory: ContextFactory;
  private circuitBreaker: CircuitBreaker;
  private fallbackExecutor: FallbackExecutor;
  private permissionManager: PermissionManager | null;
  private options: Required<Omit<ExecutorOptions, 'permissionManager'>> & {
    permissionManager: PermissionManager | null;
  };

  constructor(options: ExecutorOptions = {}) {
    this.options = {
      defaultFallback: options.defaultFallback || 'throw',
      timeoutMs: options.timeoutMs || 30000,
      enableCircuitBreaker: options.enableCircuitBreaker ?? true,
      maxDepth: options.maxDepth || 50,
      enablePermissions: options.enablePermissions ?? true,
      permissionManager: options.permissionManager || null,
    };

    this.contextFactory = new ContextFactory(this.options.maxDepth);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeoutMs: this.options.timeoutMs,
    });
    this.fallbackExecutor = new FallbackExecutor({
      enableCache: true,
      maxCacheSize: 100,
    });
    this.permissionManager = this.options.permissionManager;
  }

  async execute(
    extension: Extension,
    pointId: string,
    args: any[],
    registry: {
      getImplementations: (pointId: string) => Extension[];
      getPointMeta: (pointId: string) => any;
    },
    pointMeta?: { permissions?: Permission[]; fallbackPolicy?: FallbackPolicy },
    fallbackPolicy?: FallbackPolicy,
    featureFlags?: Record<string, boolean>
  ): Promise<any> {
    // ============================================================
    // ✅ 权限校验（强制生效）
    // ============================================================
    if (this.permissionManager && pointMeta?.permissions && pointMeta.permissions.length > 0) {
      const requiredPermissions = pointMeta.permissions;
      const grantedPermissions = extension.permissions || [];
      try {
        this.permissionManager.checkAndThrow(
          extension.id,
          pointId,
          requiredPermissions,
          grantedPermissions
        );
      } catch (err) {
        // 权限错误直接抛出，不触发降级
        throw err;
      }
    }

    // ============================================================
    // 断路器检查
    // ============================================================
    if (this.options.enableCircuitBreaker && !this.circuitBreaker.allowExecution()) {
      throw new CircuitOpenError(
        `断路器已打开，拒绝执行扩展 "${extension.id}"`,
        extension.id,
        pointId,
        this.circuitBreaker.getState()
      );
    }

    const traceId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    try {
      const context = this.contextFactory.create(extension, pointId, args, traceId, featureFlags);

      if (extension.onBeforeExecute) {
        await extension.onBeforeExecute(context);
      }

      let result: any;
      if (this.options.timeoutMs > 0) {
        result = await this.executeWithTimeout(extension, context, args, this.options.timeoutMs);
      } else {
        result = await extension.execute(context, ...args);
      }

      if (extension.onAfterExecute) {
        await extension.onAfterExecute(context, result);
      }

      context.store.commit();

      if (this.options.enableCircuitBreaker) {
        this.circuitBreaker.onSuccess();
      }

      const duration = Date.now() - startTime;
      context.logger.debug(`执行成功: ${extension.id}，耗时 ${duration}ms`);
      return result;
    } catch (error) {
      try {
        const currentContext = this.getCurrentContext();
        if (currentContext) {
          currentContext.store.discard();
        }
      } catch (_) {}

      if (extension.onError) {
        try {
          await extension.onError(this.getCurrentContext()!, error as Error);
        } catch (_) {}
      }

      if (this.options.enableCircuitBreaker) {
        this.circuitBreaker.onFailure();
      }

      const effectivePolicy = fallbackPolicy || pointMeta?.fallbackPolicy || this.options.defaultFallback;

      if (effectivePolicy === 'throw') {
        throw new ExtensionError(
          `扩展 "${extension.id}" 执行失败: ${(error as Error).message}`,
          extension.id,
          pointId,
          'EXECUTION_ERROR'
        );
      }

      const fallbackResult = await this.fallbackExecutor.executeFallback(
        extension,
        pointId,
        error as Error,
        registry,
        this.getCurrentContext(),
        this.options.enableCircuitBreaker ? this.circuitBreaker : undefined,
        effectivePolicy
      );

      if (fallbackResult.success) {
        if (this.options.enableCircuitBreaker) {
          this.circuitBreaker.onSuccess();
        }
        return fallbackResult.data;
      }

      throw new ExtensionError(
        `扩展 "${extension.id}" 执行失败，且所有降级策略均失败: ${(error as Error).message}`,
        extension.id,
        pointId,
        'FALLBACK_FAILED'
      );
    } finally {
      this.contextFactory.cleanup();
    }
  }

  private executeWithTimeout(
    extension: Extension,
    context: ExecutionContext,
    args: any[],
    timeoutMs: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(
          `扩展 "${extension.id}" 执行超时 (${timeoutMs}ms)`,
          extension.id,
          context.pointId,
          timeoutMs
        ));
      }, timeoutMs);
      Promise.resolve(extension.execute(context, ...args))
        .then(result => { clearTimeout(timer); resolve(result); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  }

  private getCurrentContext(): ExecutionContext | undefined {
    return undefined;
  }

  getCircuitBreakerState(): string {
    return this.circuitBreaker.getStateDescription();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  getFallbackCacheStats() {
    return this.fallbackExecutor.getCacheStats();
  }

  getCallStackSnapshot() {
    return this.contextFactory.getCallStackSnapshot();
  }

  clearCallStack(): void {
    this.contextFactory.clearStack();
  }

  setCustomFallbackHandler(
    handler: (extension: Extension, pointId: string, error: Error, context?: ExecutionContext) => any | Promise<any>
  ): void {
    this.fallbackExecutor.setCustomHandler(handler);
  }
}