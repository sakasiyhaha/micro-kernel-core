/**
 * ============================================================
 * ExtensionRegistry.ts
 * 扩展注册表（核心数据中心）
 * 
 * 职责：
 * - 管理所有扩展点（ExtensionPointMeta）和扩展实现（Extension）
 * - 维护扩展点与实现之间的关联
 * - 通过 DependencyGraph 检测循环依赖
 * - 提供按优先级排序的实现列表
 * ============================================================
 */

import type { Extension } from '../types/extension.types.js';
import type { ExtensionPointMeta } from '../types/kernel.types.js';
import { DependencyGraph } from './DependencyGraph.js';
import { KernelError } from '../types/errors.types.js';

export class ExtensionRegistry {
  /**
   * 存储所有扩展点的元数据，key = pointId
   */
  private points = new Map<string, ExtensionPointMeta>();

  /**
   * 存储所有扩展实现，两层 Map：
   *   - 第一层 key = pointId
   *   - 第二层 key = implementation id
   */
  private implementations = new Map<string, Map<string, Extension>>();

  /**
   * 循环依赖检测器
   */
  private dependencyGraph = new DependencyGraph();

  /**
   * 是否开启严格模式
   * - true: 重复注册扩展点会抛出错误，覆盖操作必须显式允许
   * - false: 重复注册扩展点会静默覆盖，允许隐式覆盖
   */
  private strictMode: boolean;

  constructor(strictMode: boolean = true) {
    this.strictMode = strictMode;
  }

  // ============================================================
  // 扩展点管理
  // ============================================================

  /**
   * 注册一个扩展点
   * @param meta 扩展点元数据
   * @throws {KernelError} 当严格模式下扩展点已存在时
   */
  registerPoint(meta: ExtensionPointMeta): void {
    const existing = this.points.get(meta.id);
    if (existing) {
      if (this.strictMode) {
        throw new KernelError(
          `扩展点 "${meta.id}" 已存在，无法重复注册（严格模式）`,
          'POINT_ALREADY_EXISTS'
        );
      }
      // 非严格模式下覆盖并警告
      console.warn(`[ExtensionRegistry] 扩展点 "${meta.id}" 已存在，将被覆盖`);
    }
    this.points.set(meta.id, { ...meta });
  }

  /**
   * 检查扩展点是否存在
   */
  hasPoint(pointId: string): boolean {
    return this.points.has(pointId);
  }

  /**
   * 获取扩展点元数据
   */
  getPointMeta(pointId: string): ExtensionPointMeta | undefined {
    return this.points.get(pointId);
  }

  /**
   * 获取所有已注册的扩展点
   */
  getAllPoints(): ExtensionPointMeta[] {
    return Array.from(this.points.values());
  }

  // ============================================================
  // 扩展实现管理
  // ============================================================

  /**
   * 注册一个扩展实现
   * @param impl 扩展实现
   * @throws {CircularDependencyError} 当检测到循环依赖时
   * @throws {KernelError} 当扩展点不存在且无法自动创建时
   * @throws {KernelError} 当实现 ID 已存在且不允许覆盖时
   */
  registerImplementation(impl: Extension): void {
    const { pointId, id, parentId } = impl;

    // 1. 确保扩展点存在（若不存在则自动创建默认扩展点）
    this.ensurePointExists(pointId);

    // 2. 检查实现 ID 是否已存在
    const pointImpls = this.implementations.get(pointId);
    if (pointImpls && pointImpls.has(id)) {
      // 检查扩展点是否允许覆盖
      const meta = this.points.get(pointId)!;
      if (!meta.allowOverride) {
        throw new KernelError(
          `扩展点 "${pointId}" 不允许覆盖实现 "${id}"`,
          'OVERRIDE_NOT_ALLOWED'
        );
      }
      // 允许覆盖，移除旧实现并清理依赖图
      this.unregisterImplementation(pointId, id);
    }

    // 3. 将实现加入存储
    if (!this.implementations.has(pointId)) {
      this.implementations.set(pointId, new Map<string, Extension>());
    }
    const implMap = this.implementations.get(pointId)!;
    implMap.set(id, { ...impl });

    // 4. 将节点加入依赖图
    this.dependencyGraph.addNode(id);

    // 5. 添加依赖边（如果存在 parentId）
    if (parentId) {
      const parentExists = this.findImplementationById(parentId);
      if (!parentExists) {
        console.warn(
          `[ExtensionRegistry] 实现 "${id}" 的父实现 "${parentId}" 尚未注册，可能后续会注册`
        );
      }
      this.dependencyGraph.addDependency(id, parentId);
    }

    // 6. 检测循环依赖
    try {
      this.dependencyGraph.validateAndThrow(id);
    } catch (err) {
      // 回滚
      const map = this.implementations.get(pointId);
      if (map) {
        map.delete(id);
        if (map.size === 0) {
          this.implementations.delete(pointId);
        }
      }
      this.dependencyGraph.removeNode(id);
      throw err;
    }
  }

  /**
   * 卸载一个扩展实现
   * @param pointId 扩展点 ID
   * @param implId 实现 ID
   * @returns 是否成功移除
   */
  unregisterImplementation(pointId: string, implId: string): boolean {
    const implMap = this.implementations.get(pointId);
    if (!implMap) {
      return false;
    }

    const impl = implMap.get(implId);
    if (!impl) {
      return false;
    }

    // 1. 从存储中移除
    implMap.delete(implId);
    if (implMap.size === 0) {
      this.implementations.delete(pointId);
    }

    // 2. 从依赖图中移除节点及其关联边
    this.dependencyGraph.removeNode(implId);

    return true;
  }

  /**
   * 查找指定扩展点下的主实现（优先级最高的实现）
   * @param pointId 扩展点 ID
   * @returns 主实现，若不存在则返回 null
   */
  lookup(pointId: string): Extension | null {
    const impls = this.getImplementations(pointId);
    return impls.length > 0 ? impls[0] : null;
  }

  /**
   * 获取指定扩展点下的所有实现（按优先级升序排序）
   * @param pointId 扩展点 ID
   * @returns 实现数组（已排序）
   */
  getImplementations(pointId: string): Extension[] {
    const implMap = this.implementations.get(pointId);
    if (!implMap) {
      return [];
    }
    const impls = Array.from(implMap.values());
    return this.sortImplementations(impls);
  }

  /**
   * 获取所有扩展点及其实现（用于调试）
   */
  getFullState(): {
    points: ExtensionPointMeta[];
    implementations: Record<string, Extension[]>;
  } {
    const result: Record<string, Extension[]> = {};
    for (const [pointId, implMap] of this.implementations) {
      result[pointId] = this.sortImplementations(Array.from(implMap.values()));
    }
    return {
      points: this.getAllPoints(),
      implementations: result,
    };
  }

  /**
   * 清空所有注册数据（用于销毁或测试重置）
   */
  clear(): void {
    this.points.clear();
    this.implementations.clear();
    this.dependencyGraph.clear();
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /**
   * 确保扩展点存在，若不存在则自动创建默认扩展点
   */
  private ensurePointExists(pointId: string): void {
    if (!this.points.has(pointId)) {
      this.registerPoint({
        id: pointId,
        description: `Auto-created extension point for "${pointId}"`,
        allowOverride: true,
        allowInherit: true,
      });
    }
  }

  /**
   * 按优先级排序实现列表（数字越小越靠前）
   */
  private sortImplementations(impls: Extension[]): Extension[] {
    return [...impls].sort((a, b) => {
      const aPriority = a.priority ?? 100;
      const bPriority = b.priority ?? 100;
      return aPriority - bPriority;
    });
  }

  /**
   * 在所有扩展点中查找指定 ID 的实现（用于验证父实现是否存在）
   */
  private findImplementationById(implId: string): Extension | undefined {
    for (const implMap of this.implementations.values()) {
      const impl = implMap.get(implId);
      if (impl) {
        return impl;
      }
    }
    return undefined;
  }

  /**
   * ============================================================
   * ✅ P1 新增：获取依赖图快照
   * ============================================================
   */
  getDependencyGraphSnapshot(): {
    nodes: string[];
    edges: Record<string, string[]>;
  } {
    return this.dependencyGraph.toJSON();
  }
}