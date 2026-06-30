/**
 * ============================================================
 * extension.types.ts
 * 扩展实现与执行上下文类型定义
 * ============================================================
 */

import type { Permission } from './kernel.types.js';

/**
 * 日志器接口（由内核的 observable/Logger.ts 实现）
 */
export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * 共享存储接口（由内核的 store/SharedStore.ts 实现）
 */
export interface SharedStore {
  /** 获取指定命名空间下的值（只读） */
  get<T = any>(path: string): T | undefined;
  
  /** 设置值（写入 Draft，需 commit 才生效） */
  set(path: string, value: any): void;
  
  /** 提交所有 Draft 变更 */
  commit(): void;
  
  /** 丢弃所有 Draft 变更 */
  discard(): void;
  
  /** 检查当前是否有未提交的 Draft */
  hasDraft(): boolean;
}

/**
 * 执行上下文（每次执行由内核创建并注入）
 */
export interface ExecutionContext {
  /** 全局链路追踪 ID */
  traceId: string;
  
  /** 当前执行的扩展 ID */
  extensionId: string;
  
  /** 当前执行的扩展点 ID */
  pointId: string;
  
  /** 原始参数快照 */
  args: any[];
  
  /** 开始执行的时间戳 */
  startTime: number;
  
  /** 自定义元数据（只读） */
  metadata: Record<string, unknown>;
  
  /** 带上下文的结构化日志器 */
  logger: Logger;
  
  /** 超时中断信号 */
  abortSignal?: AbortSignal;
  
  /** 共享存储 Draft 代理 */
  store: SharedStore;
  
  /** 灰度功能开关 */
  featureFlags?: Record<string, boolean>;
  
  /** 当前生效的 API 版本 */
  apiVersion: string;
  
  /**
   * 超级调用（调用继承链中的父实现）
   * 只有在存在父实现时才有效，否则抛出错误
   */
  super: (...args: any[]) => Promise<any>;
}

/**
 * 扩展实现（核心接口，泛型 T 为返回值类型）
 */
export interface Extension<T = any> {
  /** 实现唯一标识 */
  id: string;
  
  /** 所属扩展点 ID */
  pointId: string;
  
  /** 扩展自身语义化版本 */
  version: string;
  
  /** 声明的 API 版本（内核据此路由） */
  apiVersion: string;
  
  /** 执行函数 */
  execute: (context: ExecutionContext, ...args: any[]) => T | Promise<T>;
  
  /** 继承自哪个父实现（形成继承链） */
  parentId?: string | null;
  
  /** 被哪个实现覆盖（由内核维护，外部只读） */
  overriddenBy?: string | null;
  
  /** 优先级（数字越小越先执行），默认 100 */
  priority?: number;
  
  /** 信任级别，默认 'user' */
  trustLevel?: 'system' | 'user' | 'untrusted';
  
  /** 所需权限（覆盖扩展点默认值） */
  permissions?: Permission[];
  
  /** 执行前钩子 */
  onBeforeExecute?: (context: ExecutionContext) => void | Promise<void>;
  
  /** 执行后钩子 */
  onAfterExecute?: (context: ExecutionContext, result: T) => void | Promise<void>;
  
  /** 错误钩子 */
  onError?: (context: ExecutionContext, error: Error) => void | Promise<void>;
  
  /** 断路器重置钩子 */
  onCircuitReset?: (context: ExecutionContext) => void | Promise<void>;
  
  /** 卸载清理钩子 */
  destroy?: () => void | Promise<void>;
  
  /** 健康检查函数 */
  healthCheck?: () => boolean | Promise<boolean>;
}

/**
 * 执行结果包装（内核内部使用）
 */
export interface ExecutionResult<T = any> {
  /** 是否执行成功 */
  success: boolean;
  
  /** 成功时的返回数据 */
  data?: T;
  
  /** 失败时的错误对象 */
  error?: Error;
  
  /** 是否触发了降级 */
  fallbackUsed?: boolean;
  
  /** 执行耗时（毫秒） */
  duration: number;
}