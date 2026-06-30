/**
 * ============================================================
 * SharedStore.ts
 * 共享存储（增强版）
 * 
 * 职责：
 * - 提供命名空间隔离的键值存储
 * - 支持变更监听（onChange）
 * - 支持快照和恢复
 * - 与 DraftManager 集成
 * ============================================================
 */

export type StoreChangeListener = (path: string, newValue: any, oldValue: any) => void;

export interface SharedStoreOptions {
  /** 是否启用变更监听 */
  enableListeners?: boolean;
  /** 是否启用 Draft 模式（默认 true） */
  enableDraft?: boolean;
}

export class SharedStore {
  private data = new Map<string, any>();
  private listeners = new Map<string, StoreChangeListener[]>();
  private options: Required<SharedStoreOptions>;

  constructor(options: SharedStoreOptions = {}) {
    this.options = {
      enableListeners: options.enableListeners ?? true,
      enableDraft: options.enableDraft ?? true,
    };
  }

  /**
   * 设置值
   * @param path 路径（支持点号分隔，如 "editor.blocks"）
   * @param value 值
   * @param silent 是否静默（不触发监听器）
   */
  set(path: string, value: any, silent: boolean = false): void {
    const oldValue = this.get(path);
    this.data.set(path, value);

    if (!silent && this.options.enableListeners) {
      this.notifyListeners(path, value, oldValue);
    }
  }

  /**
   * 获取值
   * @param path 路径
   * @returns 值
   */
  get<T = any>(path: string): T | undefined {
    return this.data.get(path) as T | undefined;
  }

  /**
   * 删除值
   * @param path 路径
   * @param silent 是否静默
   * @returns 是否删除成功
   */
  delete(path: string, silent: boolean = false): boolean {
    if (!this.data.has(path)) return false;
    const oldValue = this.get(path);
    const result = this.data.delete(path);

    if (!silent && this.options.enableListeners) {
      this.notifyListeners(path, undefined, oldValue);
    }
    return result;
  }

  /**
   * 检查路径是否存在
   */
  has(path: string): boolean {
    return this.data.has(path);
  }

  /**
   * 获取指定命名空间下的所有键值对
   * @param namespace 命名空间（如 "editor"）
   */
  getNamespace(namespace: string): Record<string, any> {
    const result: Record<string, any> = {};
    const prefix = namespace + '.';
    for (const [key, value] of this.data) {
      if (key.startsWith(prefix)) {
        const subPath = key.slice(prefix.length);
        result[subPath] = value;
      }
    }
    return result;
  }

  /**
   * 注册变更监听器
   * @param path 路径（支持通配符 "*" 匹配所有）
   * @param listener 监听函数
   * @returns 取消监听的函数
   */
  onChange(path: string, listener: StoreChangeListener): () => void {
    if (!this.options.enableListeners) {
      console.warn('[SharedStore] 监听器已禁用，不会触发回调');
    }

    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path)!.push(listener);

    return () => {
      const listeners = this.listeners.get(path);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
        if (listeners.length === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  /**
   * 获取当前存储的快照
   */
  snapshot(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.data) {
      result[key] = value;
    }
    return result;
  }

  /**
   * 从快照恢复数据
   * @param snapshot 快照数据
   * @param silent 是否静默
   */
  restore(snapshot: Record<string, any>, silent: boolean = false): void {
    // 清空现有数据
    const oldData = new Map(this.data);
    this.data.clear();

    // 恢复新数据
    for (const [key, value] of Object.entries(snapshot)) {
      this.data.set(key, value);
    }

    if (!silent && this.options.enableListeners) {
      // 通知变更：这里简化处理，只通知整体变化
      for (const [key, value] of this.data) {
        const oldValue = oldData.get(key);
        if (oldValue !== value) {
          this.notifyListeners(key, value, oldValue);
        }
      }
      // 通知被删除的键
      for (const [key, oldValue] of oldData) {
        if (!this.data.has(key)) {
          this.notifyListeners(key, undefined, oldValue);
        }
      }
    }
  }

  /**
   * 清空所有数据
   * @param silent 是否静默
   */
  clear(silent: boolean = false): void {
    const oldData = new Map(this.data);
    this.data.clear();

    if (!silent && this.options.enableListeners) {
      for (const [key, oldValue] of oldData) {
        this.notifyListeners(key, undefined, oldValue);
      }
    }
  }

  /**
   * 获取存储大小（键值对数量）
   */
  size(): number {
    return this.data.size;
  }

  /**
   * 获取所有路径
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * 通知监听器
   */
  private notifyListeners(path: string, newValue: any, oldValue: any): void {
    // 精确匹配
    const exactListeners = this.listeners.get(path);
    if (exactListeners) {
      for (const listener of exactListeners) {
        try {
          listener(path, newValue, oldValue);
        } catch (err) {
          console.warn('[SharedStore] 监听器执行失败:', err);
        }
      }
    }

    // 通配符匹配
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(path, newValue, oldValue);
        } catch (err) {
          console.warn('[SharedStore] 通配符监听器执行失败:', err);
        }
      }
    }
  }
}