/**
 * ============================================================
 * PermissionManager.ts
 * 权限管理器
 * 
 * 职责：
 * - 管理权限定义（Permission Registry）
 * - 校验扩展是否拥有所需权限
 * - 支持权限继承和通配符匹配
 * ============================================================
 */

import type { Permission } from '../types/kernel.types.js';
import { PermissionError } from '../types/errors.types.js';

/**
 * 权限策略
 */
export type PermissionPolicy = 'ALLOW' | 'DENY' | 'REQUIRE';

/**
 * 权限规则
 */
export interface PermissionRule {
  /** 权限名称（支持通配符，如 "storage.*"） */
  permission: string;
  /** 策略 */
  policy: PermissionPolicy;
  /** 适用对象（扩展 ID 或扩展点 ID） */
  target?: string;
}

/**
 * 权限校验结果
 */
export interface PermissionCheckResult {
  /** 是否通过 */
  allowed: boolean;
  /** 拒绝原因（如果有） */
  reason?: string;
  /** 缺失的权限列表 */
  missing?: string[];
}

export interface PermissionManagerOptions {
  /** 是否启用权限检查（默认 true） */
  enabled?: boolean;
  /** 默认策略（默认 'DENY'） */
  defaultPolicy?: PermissionPolicy;
  /** 是否启用通配符匹配（默认 true） */
  enableWildcard?: boolean;
}

export class PermissionManager {
  private rules: PermissionRule[] = [];
  private options: Required<PermissionManagerOptions>;

  constructor(options: PermissionManagerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      defaultPolicy: options.defaultPolicy ?? 'DENY',
      enableWildcard: options.enableWildcard ?? true,
    };
  }

  /**
   * 添加权限规则
   * @param rule 权限规则
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * 添加多条权限规则
   */
  addRules(rules: PermissionRule[]): void {
    this.rules.push(...rules);
  }

  /**
   * 移除权限规则
   * @param permission 权限名称
   * @param target 目标（可选）
   */
  removeRule(permission: string, target?: string): void {
    this.rules = this.rules.filter(
      (rule) => !(rule.permission === permission && rule.target === target)
    );
  }

  /**
   * 清空所有规则
   */
  clearRules(): void {
    this.rules = [];
  }

  /**
   * 校验扩展是否拥有所需权限
   * @param extensionId 扩展 ID
   * @param pointId 扩展点 ID
   * @param requiredPermissions 所需权限列表
   * @param grantedPermissions 已授予的权限列表（从扩展声明中获取）
   * @returns 校验结果
   * @throws {PermissionError} 当权限不足且启用严格模式时
   */
  checkPermissions(
    extensionId: string,
    pointId: string,
    requiredPermissions: Permission[],
    grantedPermissions: Permission[]
  ): PermissionCheckResult {
    // 如果权限检查未启用，直接通过
    if (!this.options.enabled) {
      return { allowed: true };
    }

    // 如果没有所需权限，直接通过
    if (requiredPermissions.length === 0) {
      return { allowed: true };
    }

    const missing: string[] = [];

    for (const required of requiredPermissions) {
      // 检查是否拥有该权限（精确匹配或通配符匹配）
      const hasPermission = this.hasPermission(required, grantedPermissions);
      if (!hasPermission) {
        // 检查是否有规则允许该权限
        const policy = this.evaluatePolicy(required, extensionId, pointId);
        if (policy !== 'ALLOW') {
          missing.push(required);
        }
      }
    }

    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `扩展 "${extensionId}" 缺少以下权限: ${missing.join(', ')}`,
        missing,
      };
    }

    return { allowed: true };
  }

  /**
   * 校验并抛出异常（便捷方法）
   */
  checkAndThrow(
    extensionId: string,
    pointId: string,
    requiredPermissions: Permission[],
    grantedPermissions: Permission[]
  ): void {
    const result = this.checkPermissions(
      extensionId,
      pointId,
      requiredPermissions,
      grantedPermissions
    );

    if (!result.allowed) {
      throw new PermissionError(
        result.reason || `权限不足: ${result.missing?.join(', ')}`,
        extensionId,
        pointId,
        (result.missing?.[0] || 'unknown') as Permission
      );
    }
  }

  /**
   * 检查是否拥有指定权限
   */
  private hasPermission(required: Permission, granted: Permission[]): boolean {
    // 精确匹配
    if (granted.includes(required)) {
      return true;
    }

    // 通配符匹配
    if (this.options.enableWildcard) {
      for (const g of granted) {
        if (this.matchWildcard(required, g)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 评估权限策略
   */
  private evaluatePolicy(
    permission: string,
    extensionId: string,
    pointId: string
  ): PermissionPolicy {
    // 按优先级排序：最具体的规则优先
    const applicable = this.rules
      .filter((rule) => {
        if (rule.target && rule.target !== extensionId && rule.target !== pointId) {
          return false;
        }
        if (this.options.enableWildcard) {
          return this.matchWildcard(permission, rule.permission);
        }
        return permission === rule.permission;
      })
      .sort((a, b) => {
        // 有 target 的优先级高于无 target 的
        if (a.target && !b.target) return -1;
        if (!a.target && b.target) return 1;
        // 更具体的权限匹配优先级更高
        return b.permission.length - a.permission.length;
      });

    if (applicable.length > 0) {
      return applicable[0].policy;
    }

    return this.options.defaultPolicy;
  }

  /**
   * 通配符匹配
   */
  private matchWildcard(required: string, pattern: string): boolean {
    // 如果 pattern 包含通配符 *
    if (!pattern.includes('*')) {
      return required === pattern;
    }

    // 将 pattern 转换为正则
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\\\*/g, '.*'); // 将 \* 替换为 .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(required);
  }

  /**
   * 启用/禁用权限检查
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  /**
   * 获取所有规则
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * 获取当前策略快照
   */
  snapshot(): {
    enabled: boolean;
    defaultPolicy: PermissionPolicy;
    rules: PermissionRule[];
  } {
    return {
      enabled: this.options.enabled,
      defaultPolicy: this.options.defaultPolicy,
      rules: [...this.rules],
    };
  }
}

/**
 * 预定义权限集
 */
export const Permissions = {
  /** 存储读取 */
  STORAGE_READ: 'storage.read' as Permission,
  /** 存储写入 */
  STORAGE_WRITE: 'storage.write' as Permission,
  /** 网络请求 */
  NETWORK: 'network' as Permission,
  /** 文件系统 */
  FILE: 'file' as Permission,
  /** DOM 操作 */
  DOM: 'dom' as Permission,
  /** 调用其他扩展 */
  EXTENSION_CALL: 'extension.call' as Permission,
};

/**
 * 常用权限组合
 */
export const PermissionSets = {
  /** 只读权限 */
  READ_ONLY: ['storage.read'] as Permission[],
  /** 读写权限 */
  READ_WRITE: ['storage.read', 'storage.write'] as Permission[],
  /** 完整权限（谨慎使用） */
  FULL: ['storage.read', 'storage.write', 'network', 'file', 'dom', 'extension.call'] as Permission[],
  /** 无权限 */
  NONE: [] as Permission[],
};