/**
 * ============================================================
 * SandboxProxy.ts
 * 沙箱代理
 * 
 * 职责：
 * - 提供逻辑级安全隔离（通过 Proxy 拦截敏感操作）
 * - 预留物理隔离接入点（如 iframe、Web Worker）
 * - 记录沙箱操作日志
 * ============================================================
 */

import type { Logger } from '../observable/Logger.js';

export interface SandboxConfig {
  /** 是否启用沙箱 */
  enabled?: boolean;
  /** 允许的操作列表 */
  allowedOperations?: string[];
  /** 禁止的操作列表 */
  deniedOperations?: string[];
  /** 最大操作次数（防止无限循环） */
  maxOperations?: number;
  /** 沙箱类型 */
  type?: 'logical' | 'iframe' | 'worker' | 'none';
}

export interface SandboxMetrics {
  operationCount: number;
  allowedCount: number;
  deniedCount: number;
  errorCount: number;
}

/**
 * 沙箱代理
 * 提供对目标对象的受控访问
 */
export class SandboxProxy {
  private metrics: SandboxMetrics = {
    operationCount: 0,
    allowedCount: 0,
    deniedCount: 0,
    errorCount: 0,
  };

  private config: Required<SandboxConfig>;
  private logger?: Logger;

  constructor(config: SandboxConfig = {}, logger?: Logger) {
    this.config = {
      enabled: config.enabled ?? true,
      allowedOperations: config.allowedOperations ?? [],
      deniedOperations: config.deniedOperations ?? [],
      maxOperations: config.maxOperations ?? 10000,
      type: config.type ?? 'logical',
    };
    this.logger = logger;
  }

  /**
   * 为对象创建沙箱代理
   * @param target 目标对象
   * @param operationPrefix 操作前缀（用于日志和统计）
   * @returns 代理对象
   */
  create<T extends object>(target: T, operationPrefix?: string): T {
    if (!this.config.enabled) {
      return target;
    }

    const sandbox = this;

    return new Proxy(target, {
      get(obj, prop: string | symbol) {
        const propStr = String(prop);
        const fullOp = operationPrefix ? `${operationPrefix}.${propStr}` : propStr;

        // 检查操作次数限制
        if (sandbox.metrics.operationCount >= sandbox.config.maxOperations) {
          sandbox.logger?.warn(`沙箱操作次数已达上限: ${sandbox.metrics.operationCount}`);
          throw new Error(`沙箱操作次数已达上限 (${sandbox.config.maxOperations})`);
        }

        sandbox.metrics.operationCount++;

        // 检查禁止操作
        if (sandbox.isDenied(fullOp)) {
          sandbox.metrics.deniedCount++;
          sandbox.logger?.warn(`沙箱拒绝操作: ${fullOp}`);
          throw new Error(`操作 "${fullOp}" 被沙箱拒绝`);
        }

        // 检查允许操作（如果配置了白名单）
        if (sandbox.config.allowedOperations.length > 0) {
          if (!sandbox.isAllowed(fullOp)) {
            sandbox.metrics.deniedCount++;
            sandbox.logger?.warn(`沙箱拒绝操作（不在白名单）: ${fullOp}`);
            throw new Error(`操作 "${fullOp}" 不在沙箱白名单中`);
          }
        }

        sandbox.metrics.allowedCount++;

        const value = Reflect.get(obj, prop);
        // 如果值是函数，绑定 this
        if (typeof value === 'function') {
          return value.bind(obj);
        }
        // 如果返回值是对象且不是 null，递归创建代理
        if (value && typeof value === 'object') {
          return sandbox.create(value, fullOp);
        }
        return value;
      },

      set(obj, prop: string | symbol, value): boolean {
        const propStr = String(prop);
        const fullOp = operationPrefix ? `${operationPrefix}.${propStr}` : propStr;

        if (sandbox.metrics.operationCount >= sandbox.config.maxOperations) {
          sandbox.logger?.warn(`沙箱操作次数已达上限: ${sandbox.metrics.operationCount}`);
          throw new Error(`沙箱操作次数已达上限 (${sandbox.config.maxOperations})`);
        }

        sandbox.metrics.operationCount++;

        // 设置操作视为写操作
        const writeOp = `${fullOp}:write`;
        if (sandbox.isDenied(writeOp) || sandbox.isDenied(fullOp)) {
          sandbox.metrics.deniedCount++;
          sandbox.logger?.warn(`沙箱拒绝写操作: ${fullOp}`);
          throw new Error(`写操作 "${fullOp}" 被沙箱拒绝`);
        }

        if (sandbox.config.allowedOperations.length > 0) {
          if (!sandbox.isAllowed(writeOp) && !sandbox.isAllowed(fullOp)) {
            sandbox.metrics.deniedCount++;
            sandbox.logger?.warn(`沙箱拒绝写操作（不在白名单）: ${fullOp}`);
            throw new Error(`写操作 "${fullOp}" 不在沙箱白名单中`);
          }
        }

        sandbox.metrics.allowedCount++;
        return Reflect.set(obj, prop, value);
      },

      deleteProperty(obj, prop: string | symbol) {
        const propStr = String(prop);
        const fullOp = operationPrefix ? `${operationPrefix}.${propStr}` : propStr;

        if (sandbox.isDenied(fullOp)) {
          sandbox.metrics.deniedCount++;
          sandbox.logger?.warn(`沙箱拒绝删除操作: ${fullOp}`);
          throw new Error(`删除操作 "${fullOp}" 被沙箱拒绝`);
        }

        return Reflect.deleteProperty(obj, prop);
      },
    });
  }

  /**
   * 检查操作是否被允许
   */
  private isAllowed(operation: string): boolean {
    for (const allowed of this.config.allowedOperations) {
      if (this.matchPattern(operation, allowed)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查操作是否被禁止
   */
  private isDenied(operation: string): boolean {
    for (const denied of this.config.deniedOperations) {
      if (this.matchPattern(operation, denied)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 模式匹配（支持通配符 *）
   */
  private matchPattern(operation: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return operation === pattern;
    }

    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(operation);
  }

  /**
   * 获取沙箱指标
   */
  getMetrics(): SandboxMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置沙箱指标
   */
  resetMetrics(): void {
    this.metrics = {
      operationCount: 0,
      allowedCount: 0,
      deniedCount: 0,
      errorCount: 0,
    };
  }

  /**
   * 获取沙箱配置
   */
  getConfig(): Readonly<Required<SandboxConfig>> {
    return { ...this.config };
  }

  /**
   * 是否启用沙箱
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 启用/禁用沙箱
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 创建空沙箱（用于隔离的上下文）
   */
  static createEmptySandbox(): Record<string, never> {
    return Object.create(null);
  }
}