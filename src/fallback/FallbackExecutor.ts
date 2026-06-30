/**
 * ============================================================
 * FallbackExecutor.ts
 * 降级链执行器
 * 
 * 职责：
 * - 沿继承链（parentId）向上查找可用的父实现
 * - 支持 last-success 策略（缓存最近一次成功结果）
 * - 支持 custom 策略（调用自定义降级处理器）
 * - 与 CircuitBreaker 联动
 * ============================================================
 */

import type { Extension, ExecutionContext } from '../types/extension.types.js';
import type { FallbackPolicy } from '../types/kernel.types.js';
import type { CircuitBreaker } from './CircuitBreaker.js';

/**
 * 自定义降级处理器类型
 */
export type CustomFallbackHandler = (
  extension: Extension,
  pointId: string,
  error: Error,
  context?: ExecutionContext
) => any | Promise<any>;

/**
 * 降级执行器配置
 */
export interface FallbackExecutorOptions {
  /** 是否启用降级缓存（last-success） */
  enableCache?: boolean;
  /** 缓存最大数量 */
  maxCacheSize?: number;
}

/**
 * 降级执行结果
 */
export interface FallbackResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: any;
  /** 使用的降级策略 */
  strategy: FallbackPolicy | 'parent' | 'cache';
  /** 错误信息（如果失败） */
  error?: Error;
  /** 执行耗时（毫秒） */
  duration: number;
}

export class FallbackExecutor {
  /**
   * 上次成功结果缓存（用于 last-success 策略）
   * key: extensionId
   * value: 上次成功的结果
   */
  private successCache = new Map<string, any>();

  /**
   * 自定义降级处理器
   */
  private customHandler: CustomFallbackHandler | null = null;

  /**
   * 配置
   */
  private options: Required<FallbackExecutorOptions>;

  constructor(options: FallbackExecutorOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      maxCacheSize: options.maxCacheSize ?? 100,
    };
  }

  /**
   * 注册自定义降级处理器
   */
  setCustomHandler(handler: CustomFallbackHandler): void {
    this.customHandler = handler;
  }

  /**
   * 清除自定义降级处理器
   */
  clearCustomHandler(): void {
    this.customHandler = null;
  }

  /**
   * 执行降级链
   * @param extension 当前失败的扩展
   * @param pointId 扩展点 ID
   * @param error 原始错误
   * @param registry 扩展注册表（用于查找父实现）
   * @param context 执行上下文（可选）
   * @param _circuitBreaker 断路器（可选，暂未使用）
   * @param policy 降级策略
   * @returns 降级结果
   */
  async executeFallback(
    extension: Extension,
    pointId: string,
    error: Error,
    registry: {
      getImplementations: (pointId: string) => Extension[];
      getPointMeta: (pointId: string) => any;
    },
    context?: ExecutionContext,
    _circuitBreaker?: CircuitBreaker,
    policy?: FallbackPolicy
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    const fallbackPolicy = policy ?? this.getFallbackPolicy(extension, pointId, registry);

    try {
      let result: any;

      switch (fallbackPolicy) {
        case 'last-success':
          result = await this.handleLastSuccess(extension, pointId);
          if (result !== undefined) {
            return {
              success: true,
              data: result,
              strategy: 'cache',
              duration: Date.now() - startTime,
            };
          }
          // 如果缓存中没有结果，尝试父实现
          return await this.tryParentImplementation(extension, pointId, error, registry, context);

        case 'custom':
          result = await this.handleCustom(extension, pointId, error, context);
          if (result !== undefined) {
            return {
              success: true,
              data: result,
              strategy: 'custom',
              duration: Date.now() - startTime,
            };
          }
          // 如果自定义处理器未返回结果，尝试父实现
          return await this.tryParentImplementation(extension, pointId, error, registry, context);

        case 'null': {
          // ✅ 先尝试父实现降级
          const parentResult = await this.tryParentImplementation(
            extension, pointId, error, registry, context
          );
          if (parentResult.success) {
            return parentResult;
          }
          // 没有父实现或父实现也失败，返回 null
          return {
            success: true,
            data: null,
            strategy: 'null',
            duration: Date.now() - startTime,
          };
        }

        case 'ignore': {
          // ✅ 先尝试父实现降级
          const parentResult = await this.tryParentImplementation(
            extension, pointId, error, registry, context
          );
          if (parentResult.success) {
            return parentResult;
          }
          // 没有父实现或父实现也失败，返回 undefined
          return {
            success: true,
            data: undefined,
            strategy: 'ignore',
            duration: Date.now() - startTime,
          };
        }

        case 'throw':
          // 直接抛出原始错误
          return {
            success: false,
            error: error,
            strategy: 'throw',
            duration: Date.now() - startTime,
          };

        default:
          // 尝试父实现
          return await this.tryParentImplementation(extension, pointId, error, registry, context);
      }
    } catch (fallbackError) {
      // 降级过程本身出错
      return {
        success: false,
        error: fallbackError as Error,
        strategy: policy ?? 'throw',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 从缓存中获取上次成功结果
   */
  private async handleLastSuccess(extension: Extension, pointId: string): Promise<any> {
    if (!this.options.enableCache) {
      return undefined;
    }

    const cacheKey = this.getCacheKey(extension.id, pointId);
    if (this.successCache.has(cacheKey)) {
      return this.successCache.get(cacheKey);
    }

    // 尝试使用扩展 ID 作为 key
    if (this.successCache.has(extension.id)) {
      return this.successCache.get(extension.id);
    }

    return undefined;
  }

  /**
   * 调用自定义降级处理器
   */
  private async handleCustom(
    extension: Extension,
    pointId: string,
    error: Error,
    context?: ExecutionContext
  ): Promise<any> {
    if (!this.customHandler) {
      return undefined;
    }
    try {
      return await this.customHandler(extension, pointId, error, context);
    } catch (_) {
      // 自定义处理器失败，返回 undefined 继续尝试其他策略
      return undefined;
    }
  }

  /**
   * 尝试使用父实现
   */
  private async tryParentImplementation(
    extension: Extension,
    pointId: string,
    error: Error,
    registry: {
      getImplementations: (pointId: string) => Extension[];
      getPointMeta: (pointId: string) => any;
    },
    context?: ExecutionContext
  ): Promise<FallbackResult> {
    const startTime = Date.now();

    // 如果没有父实现，无法继续降级
    if (!extension.parentId) {
      return {
        success: false,
        error: error,
        strategy: 'parent',
        duration: Date.now() - startTime,
      };
    }

    // 查找父实现
    const allImpls = registry.getImplementations(pointId);
    const parentImpl = allImpls.find(impl => impl.id === extension.parentId);

    if (!parentImpl) {
      return {
        success: false,
        error: new Error(`父实现 "${extension.parentId}" 不存在`),
        strategy: 'parent',
        duration: Date.now() - startTime,
      };
    }

    try {
      // 构建父实现执行上下文（如果提供了 context）
      let parentContext = context;
      if (parentContext) {
        parentContext = {
          ...parentContext,
          extensionId: parentImpl.id,
          pointId: pointId,
        };
      }

      // 执行父实现
      const result = await parentImpl.execute(
        parentContext as ExecutionContext,
        ...(context?.args || [])
      );

      // 降级成功日志
      console.log(`[FallbackExecutor] 降级到父实现 ${parentImpl.id} 成功，结果:`, result);

      // 如果执行成功，缓存结果（如果启用）
      if (this.options.enableCache) {
        this.setCache(extension.id, pointId, result);
      }

      return {
        success: true,
        data: result,
        strategy: 'parent',
        duration: Date.now() - startTime,
      };
    } catch (parentError) {
      // 父实现也失败，继续向上查找（递归）
      return this.tryParentImplementation(
        parentImpl,
        pointId,
        parentError as Error,
        registry,
        context
      );
    }
  }

  /**
   * 获取降级策略
   */
  private getFallbackPolicy(
    _extension: Extension,
    pointId: string,
    registry: {
      getPointMeta: (pointId: string) => any;
    }
  ): FallbackPolicy {
    // 1. 优先使用扩展点的 fallbackPolicy
    const meta = registry.getPointMeta(pointId);
    if (meta?.fallbackPolicy) {
      return meta.fallbackPolicy;
    }

    // 2. 默认返回 'throw'，由调用方传入默认值
    return 'throw';
  }

  /**
   * 缓存成功结果
   */
  private setCache(extensionId: string, pointId: string, result: any): void {
    const key = this.getCacheKey(extensionId, pointId);

    // 如果缓存已满，删除最旧的条目
    if (this.successCache.size >= this.options.maxCacheSize) {
      const firstKey = this.successCache.keys().next().value;
      if (firstKey) {
        this.successCache.delete(firstKey);
      }
    }

    this.successCache.set(key, result);
    // 同时以 extensionId 为键存储一份（便于快速查找）
    this.successCache.set(extensionId, result);
  }

  /**
   * 清除缓存
   * @param extensionId 可选，如果指定则只清除该扩展的缓存
   */
  clearCache(extensionId?: string): void {
    if (extensionId) {
      this.successCache.delete(extensionId);
      // 删除所有以该 ID 开头的缓存
      for (const key of this.successCache.keys()) {
        if (key.startsWith(`${extensionId}:`)) {
          this.successCache.delete(key);
        }
      }
    } else {
      this.successCache.clear();
    }
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(extensionId: string, pointId: string): string {
    return `${extensionId}:${pointId}`;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
  } {
    return {
      size: this.successCache.size,
      maxSize: this.options.maxCacheSize,
      enabled: this.options.enableCache,
    };
  }
}

/**
 * 创建 FallbackExecutor 实例的工厂函数
 */
export function createFallbackExecutor(options?: FallbackExecutorOptions): FallbackExecutor {
  return new FallbackExecutor(options);
}