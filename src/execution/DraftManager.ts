/**
 * ============================================================
 * DraftManager.ts
 * 写时复制（Copy-on-Write）管理器
 * 
 * 职责：
 * - 维护数据修改的 Draft 状态
 * - 提供 Commit（提交）和 Discard（丢弃）操作
 * - 确保数据变更的原子性
 * ============================================================
 */

export interface DraftChange {
  path: string;
  value: any;
  oldValue: any;
}

export class DraftManager {
  /**
   * 原始数据（只读）
   */
  private baseData: Record<string, any> = {};

  /**
   * Draft 修改记录
   */
  private changes: DraftChange[] = [];

  /**
   * 是否处于 Draft 状态
   */
  private isDrafting = false;

  /**
   * 进入 Draft 模式
   * @param baseData 基础数据
   */
  beginDraft(baseData: Record<string, any>): void {
    if (this.isDrafting) {
      throw new Error('DraftManager: 已有未提交的 Draft，请先 Commit 或 Discard');
    }
    this.baseData = { ...baseData };
    this.changes = [];
    this.isDrafting = true;
  }

  /**
   * 在 Draft 模式下设置值
   * @param path 路径（支持点号分隔，如 "a.b.c"）
   * @param value 新值
   */
  set(path: string, value: any): void {
    if (!this.isDrafting) {
      throw new Error('DraftManager: 未进入 Draft 模式，请先调用 beginDraft');
    }
    const oldValue = this.get(path);
    this.changes.push({ path, value, oldValue });
  }

  /**
   * 在 Draft 模式下获取值
   * @param path 路径
   * @returns 当前值（若有修改则返回修改后的值）
   */
  get(path: string): any {
    // 从 changes 中查找最新值
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i];
      if (change.path === path) {
        return change.value;
      }
    }
    // 从 baseData 中读取
    return this.getNestedValue(this.baseData, path);
  }

  /**
   * 提交所有变更
   * @returns 变更后的数据
   */
  commit(): Record<string, any> {
    if (!this.isDrafting) {
      throw new Error('DraftManager: 未进入 Draft 模式，无法提交');
    }
    const result = { ...this.baseData };
    for (const change of this.changes) {
      this.setNestedValue(result, change.path, change.value);
    }
    this.isDrafting = false;
    return result;
  }

  /**
   * 丢弃所有变更
   */
  discard(): void {
    if (!this.isDrafting) {
      return;
    }
    this.changes = [];
    this.isDrafting = false;
  }

  /**
   * 是否有未提交的变更
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  /**
   * 是否处于 Draft 模式
   */
  isActive(): boolean {
    return this.isDrafting;
  }

  /**
   * 获取当前所有变更（用于调试）
   */
  getChanges(): DraftChange[] {
    return [...this.changes];
  }

  /**
   * 获取嵌套属性值
   */
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

  /**
   * 设置嵌套属性值
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    let current: any = obj;
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }
    current[last] = value;
  }
}