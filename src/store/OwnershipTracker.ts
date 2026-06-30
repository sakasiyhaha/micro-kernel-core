/**
 * ============================================================
 * OwnershipTracker.ts
 * 资源所有权追踪器
 * 
 * 职责：
 * - 追踪资源的所有者（扩展 ID）
 * - 支持资源的引用计数
 * - 支持自动回收（当所有持有者释放时）
 * - 支持泄漏检测
 * ============================================================
 */

export interface ResourceInfo {
  /** 资源唯一标识 */
  id: string;
  /** 资源数据 */
  data: any;
  /** 持有者 ID 列表 */
  owners: string[];
  /** 引用计数 */
  refCount: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessed: number;
}

export interface OwnershipTrackerOptions {
  /** 是否启用自动回收 */
  autoRecycle?: boolean;
  /** 空闲超时时间（毫秒），超过此时间未被访问则视为可回收 */
  idleTimeoutMs?: number;
  /** 最大资源数量 */
  maxResources?: number;
}

export class OwnershipTracker {
  private resources = new Map<string, ResourceInfo>();
  private options: Required<OwnershipTrackerOptions>;

  constructor(options: OwnershipTrackerOptions = {}) {
    this.options = {
      autoRecycle: options.autoRecycle ?? true,
      idleTimeoutMs: options.idleTimeoutMs ?? 60000,
      maxResources: options.maxResources ?? 1000,
    };
  }

  /**
   * 注册资源
   * @param id 资源 ID
   * @param data 资源数据
   * @param owner 所有者 ID
   * @returns 资源信息
   */
  register(id: string, data: any, owner: string): ResourceInfo {
    // 检查资源数量限制
    if (this.resources.size >= this.options.maxResources) {
      this.recycleIdleResources();
      if (this.resources.size >= this.options.maxResources) {
        throw new Error(
          `资源数量已达上限 (${this.options.maxResources})，无法注册新资源`
        );
      }
    }

    // 如果资源已存在，只增加持有者
    if (this.resources.has(id)) {
      const info = this.resources.get(id)!;
      if (!info.owners.includes(owner)) {
        info.owners.push(owner);
        info.refCount++;
      }
      info.lastAccessed = Date.now();
      return info;
    }

    // 创建新资源
    const info: ResourceInfo = {
      id,
      data,
      owners: [owner],
      refCount: 1,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };
    this.resources.set(id, info);
    return info;
  }

  /**
   * 释放资源（减少引用计数）
   * @param id 资源 ID
   * @param owner 所有者 ID
   * @returns 是否完全释放（引用计数归零）
   */
  release(id: string, owner: string): boolean {
    const info = this.resources.get(id);
    if (!info) return false;

    const ownerIndex = info.owners.indexOf(owner);
    if (ownerIndex < 0) return false;

    info.owners.splice(ownerIndex, 1);
    info.refCount--;
    info.lastAccessed = Date.now();

    if (info.refCount <= 0) {
      this.resources.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 获取资源（会更新最后访问时间）
   * @param id 资源 ID
   * @returns 资源数据，若不存在则返回 undefined
   */
  get(id: string): any | undefined {
    const info = this.resources.get(id);
    if (!info) return undefined;
    info.lastAccessed = Date.now();
    return info.data;
  }

  /**
   * 检查资源是否存在
   */
  has(id: string): boolean {
    return this.resources.has(id);
  }

  /**
   * 获取资源信息（不含 data，保护数据）
   */
  getInfo(id: string): Omit<ResourceInfo, 'data'> | undefined {
    const info = this.resources.get(id);
    if (!info) return undefined;
    return {
      id: info.id,
      owners: [...info.owners],
      refCount: info.refCount,
      createdAt: info.createdAt,
      lastAccessed: info.lastAccessed,
    };
  }

  /**
   * 获取指定所有者的所有资源 ID
   */
  getResourcesByOwner(owner: string): string[] {
    const result: string[] = [];
    for (const [id, info] of this.resources) {
      if (info.owners.includes(owner)) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * 获取所有资源的快照（用于调试）
   */
  snapshot(): {
    total: number;
    resources: Array<Omit<ResourceInfo, 'data'>>;
  } {
    const resources: Array<Omit<ResourceInfo, 'data'>> = [];
    for (const info of this.resources.values()) {
      resources.push({
        id: info.id,
        owners: [...info.owners],
        refCount: info.refCount,
        createdAt: info.createdAt,
        lastAccessed: info.lastAccessed,
      });
    }
    return {
      total: this.resources.size,
      resources,
    };
  }

  /**
   * 回收空闲资源
   * @param force 是否强制回收所有空闲资源
   * @returns 回收的资源数量
   */
  recycleIdleResources(force: boolean = false): number {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, info] of this.resources) {
      const isIdle = now - info.lastAccessed > this.options.idleTimeoutMs;
      const isOrphan = info.refCount <= 0;
      if (isOrphan || (this.options.autoRecycle && isIdle) || force) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.resources.delete(id);
    }

    return toRemove.length;
  }

  /**
   * 清空所有资源
   */
  clear(): void {
    this.resources.clear();
  }

  /**
   * 获取资源总数
   */
  size(): number {
    return this.resources.size;
  }
}