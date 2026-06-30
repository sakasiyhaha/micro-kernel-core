/**
 * ============================================================
 * kernel.types.ts
 * 内核配置与核心元数据类型定义
 * ============================================================
 */

/**
 * 降级策略
 * - 'throw'：抛出异常
 * - 'null'：返回 null
 * - 'ignore'：返回 undefined
 * - 'last-success'：返回最近一次成功的结果（缓存）
 * - 'custom'：调用自定义降级处理器
 */
export type FallbackPolicy = 'throw' | 'null' | 'ignore' | 'last-success' | 'custom';

/**
 * 权限字符串（逻辑级权限约束）
 */
export type Permission = 
  | 'storage.read'
  | 'storage.write'
  | 'network'
  | 'file'
  | 'dom'
  | 'extension.call';

/**
 * 内核配置（创建 Kernel 实例时传入）
 */
export interface KernelConfig {
  /** 内核自身语义化版本，如 '1.0.0' */
  version: string;
  
  /** 是否开启严格模式（更严格的版本/权限校验） */
  strictMode?: boolean;
  
  /** 最大调用深度（防止递归过深），默认 50 */
  maxExecutionDepth?: number;
  
  /** 是否启用断路器（连续失败 3 次触发熔断），默认 true */
  enableCircuitBreaker?: boolean;
  
  /** 全局默认降级策略，默认 'throw' */
  defaultFallback?: FallbackPolicy;
  
  /** 执行超时时间（毫秒），默认 30000（30 秒） */
  timeoutMs?: number;
  
  /** 是否开启调试日志，默认 false */
  debug?: boolean;
}

/**
 * 扩展点元数据（描述一个扩展点的约束）
 */
export interface ExtensionPointMeta {
  /** 唯一标识，如 'registry.block' */
  id: string;
  
  /** 描述信息 */
  description?: string;
  
  /** 是否允许覆盖（默认 true） */
  allowOverride?: boolean;
  
  /** 是否允许继承（默认 true） */
  allowInherit?: boolean;
  
  /** 该扩展点的降级策略（覆盖全局策略） */
  fallbackPolicy?: FallbackPolicy;
  
  /** 执行所需权限列表 */
  permissions?: Permission[];
  
  /** 要求的 API 版本，如 '2.0.0' */
  apiVersion?: string;
  
  /** 是否已弃用 */
  deprecated?: boolean;
  
  /** 弃用提示信息 */
  deprecationMessage?: string;
}

/**
 * 扩展点运行时状态（由内核维护）
 */
export interface ExtensionPointState {
  /** 扩展点 ID */
  pointId: string;
  
  /** 该扩展点下所有已注册的实现（已按优先级排序） */
  implementations: any[]; // 实际类型为 Extension<any>，但为了避免循环引用，使用 any
  
  /** 扩展点元数据 */
  meta: ExtensionPointMeta;
}