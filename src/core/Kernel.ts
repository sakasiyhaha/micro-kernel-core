/**
 * ============================================================
 * Kernel.ts
 * 微内核门面类（Facade）- 最终修复版
 * ============================================================
 */

import type { Extension } from '../types/extension.types.js';
import type {
  KernelConfig,
  ExtensionPointMeta,
  FallbackPolicy,
} from '../types/kernel.types.js';
import { KernelError} from '../types/errors.types.js';
import { ExtensionRegistry } from './ExtensionRegistry.js';
import { Executor } from '../execution/Executor.js';
import { PermissionManager } from '../security/PermissionManager.js';

export interface KernelState {
  version: string;
  strictMode: boolean;
  points: ExtensionPointMeta[];
  implementations: Record<string, Extension[]>;
  dependencyGraph: {
    nodes: string[];
    edges: Record<string, string[]>;
  };
}

export class Kernel {
  public readonly version: string;
  public readonly strictMode: boolean;
  public readonly maxExecutionDepth: number;
  public readonly enableCircuitBreaker: boolean;
  public readonly defaultFallback: FallbackPolicy;
  public readonly timeoutMs: number;
  public readonly debug: boolean;

  private registry: ExtensionRegistry;
  private executor: Executor;
  private permissionManager: PermissionManager;
  private destroyed = false;

  constructor(config: KernelConfig) {
    this.version = config.version;
    this.strictMode = config.strictMode ?? true;
    this.maxExecutionDepth = config.maxExecutionDepth ?? 50;
    this.enableCircuitBreaker = config.enableCircuitBreaker ?? true;
    this.defaultFallback = config.defaultFallback ?? 'throw';
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.debug = config.debug ?? false;

    this.registry = new ExtensionRegistry(this.strictMode);

    // 创建权限管理器
    this.permissionManager = new PermissionManager({
      enabled: true,
      defaultPolicy: 'DENY',
      enableWildcard: true,
    });

    // 创建执行器
    this.executor = new Executor({
      defaultFallback: this.defaultFallback,
      timeoutMs: this.timeoutMs,
      enableCircuitBreaker: this.enableCircuitBreaker,
      maxDepth: this.maxExecutionDepth,
      enablePermissions: true,
      permissionManager: this.permissionManager,
    });
  }

  // ============================================================
  // 私有权限校验方法
  // ============================================================

  /**
   * 校验扩展是否拥有扩展点所需的权限
   * @param pointId 扩展点 ID
   * @param extension 扩展实现
   * @throws {PermissionError} 当权限不足时
   */
  private checkPermissions(pointId: string, extension: Extension): void {
    const pointMeta = this.registry.getPointMeta(pointId);
    // 如果扩展点未定义权限要求，跳过校验
    if (!pointMeta?.permissions || pointMeta.permissions.length === 0) {
      return;
    }

    const requiredPermissions = pointMeta.permissions;
    const grantedPermissions = extension.permissions || [];

    this.permissionManager.checkAndThrow(
      extension.id,
      pointId,
      requiredPermissions,
      grantedPermissions
    );
  }

  // ============================================================
  // 核心 API
  // ============================================================

  registerPoint(meta: ExtensionPointMeta): void {
    this.ensureNotDestroyed();
    this.registry.registerPoint(meta);
  }

  /**
   * 向指定扩展点注册一个扩展实现（注册前进行权限校验）
   */
  add(pointId: string, extension: Extension): void {
    this.ensureNotDestroyed();

    // ✅ 权限校验：注册前检查
    this.checkPermissions(pointId, extension);

    const impl = { ...extension, pointId };
    this.registry.registerImplementation(impl);

    if (this.debug) {
      console.log(`[Kernel] 已注册扩展: ${impl.id} → ${pointId}`);
    }
  }

  /**
   * 用新实现覆盖已有的实现（覆盖前进行权限校验）
   */
  override(pointId: string, targetId: string, newImpl: Extension): void {
    this.ensureNotDestroyed();

    const existingImpls = this.registry.getImplementations(pointId);
    const targetImpl = existingImpls.find((impl) => impl.id === targetId);
    if (!targetImpl) {
      throw new KernelError(
        `扩展点 "${pointId}" 中不存在实现 "${targetId}"`,
        'TARGET_NOT_FOUND'
      );
    }

    const meta = this.registry.getPointMeta(pointId);
    if (meta && meta.allowOverride === false) {
      throw new KernelError(
        `扩展点 "${pointId}" 不允许覆盖实现`,
        'OVERRIDE_NOT_ALLOWED'
      );
    }

    // ✅ 权限校验：覆盖前检查
    this.checkPermissions(pointId, newImpl);

    const impl = { ...newImpl, pointId, parentId: targetId };
    this.registry.registerImplementation(impl);

    if (this.debug) {
      console.log(`[Kernel] 已覆盖扩展: ${targetId} → ${newImpl.id}`);
    }
  }

  /**
   * 基于现有实现创建派生实现（继承前进行权限校验）
   */
  inherit(pointId: string, parentId: string, childImpl: Extension): void {
    this.ensureNotDestroyed();

    const existingImpls = this.registry.getImplementations(pointId);
    const parentImpl = existingImpls.find((impl) => impl.id === parentId);
    if (!parentImpl) {
      throw new KernelError(
        `扩展点 "${pointId}" 中不存在父实现 "${parentId}"`,
        'PARENT_NOT_FOUND'
      );
    }

    const meta = this.registry.getPointMeta(pointId);
    if (meta && meta.allowInherit === false) {
      throw new KernelError(
        `扩展点 "${pointId}" 不允许继承`,
        'INHERIT_NOT_ALLOWED'
      );
    }

    // ✅ 权限校验：继承前检查
    this.checkPermissions(pointId, childImpl);

    const impl = { ...childImpl, pointId, parentId };
    if (impl.priority === undefined) {
      impl.priority = parentImpl.priority ?? 100;
    }

    this.registry.registerImplementation(impl);

    if (this.debug) {
      console.log(`[Kernel] 已继承扩展: ${childImpl.id} ← ${parentId}`);
    }
  }

  /**
   * 执行指定扩展点下的主实现
   */
  async execute(pointId: string, ...args: any[]): Promise<any> {
    this.ensureNotDestroyed();

    const impl = this.registry.lookup(pointId);
    if (!impl) {
      return this.handleNoImplementation(pointId);
    }

    const pointMeta = this.registry.getPointMeta(pointId);

    return this.executor.execute(
      impl,
      pointId,
      args,
      this.registry,
      pointMeta,
      pointMeta?.fallbackPolicy
    );
  }

  getState(): KernelState {
    const fullState = this.registry.getFullState();
    const graphJson = this.getDependencyGraphSnapshot();
    return {
      version: this.version,
      strictMode: this.strictMode,
      points: fullState.points,
      implementations: fullState.implementations,
      dependencyGraph: {
        nodes: graphJson.nodes,
        edges: graphJson.edges,
      },
    };
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    if (this.debug) console.log('[Kernel] 开始销毁内核...');
    const allPoints = this.registry.getAllPoints();
    for (const point of allPoints) {
      const impls = this.registry.getImplementations(point.id);
      for (const impl of impls) {
        if (impl.destroy) {
          try { await impl.destroy(); } catch (err) {
            console.warn(`[Kernel] 扩展 "${impl.id}" 销毁钩子执行失败:`, err);
          }
        }
      }
    }
    this.registry.clear();
    this.destroyed = true;
    if (this.debug) console.log('[Kernel] 内核已销毁');
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  private ensureNotDestroyed(): void {
    if (this.destroyed) {
      throw new KernelError('内核已被销毁，无法执行操作', 'KERNEL_DESTROYED');
    }
  }

  private getDependencyGraphSnapshot() {
    return this.registry.getDependencyGraphSnapshot();
  }

  private handleNoImplementation(pointId: string): any {
    const meta = this.registry.getPointMeta(pointId);
    const policy = meta?.fallbackPolicy ?? this.defaultFallback;
    if (this.debug) console.warn(`[Kernel] 扩展点 "${pointId}" 没有注册任何实现`);
    switch (policy) {
      case 'throw':
        throw new KernelError(`扩展点 "${pointId}" 没有注册任何实现`, 'NO_IMPLEMENTATION');
      case 'null': return null;
      case 'ignore': return undefined;
      default: return null;
    }
  }

  // ============================================================
  // 扩展 API
  // ============================================================

  getCircuitBreakerState() { return this.executor.getCircuitBreakerState(); }
  resetCircuitBreaker() { this.executor.resetCircuitBreaker(); }
  setCustomFallbackHandler(handler: any) { this.executor.setCustomFallbackHandler(handler); }
  getFallbackCacheStats() { return this.executor.getFallbackCacheStats(); }
}