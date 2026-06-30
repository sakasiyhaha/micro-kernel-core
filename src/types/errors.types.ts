/**
 * ============================================================
 * errors.types.ts
 * 内核自定义错误类型层级
 * ============================================================
 */

/**
 * 内核错误基类
 */
export class KernelError extends Error {
  public readonly code: string;
  
  constructor(message: string, code: string = 'KERNEL_ERROR') {
    super(message);
    this.name = 'KernelError';
    this.code = code;
  }
}

/**
 * 扩展执行错误
 */
export class ExtensionError extends KernelError {
  public readonly extensionId: string;
  public readonly pointId: string;
  
  constructor(
    message: string,
    extensionId: string,
    pointId: string,
    code: string = 'EXTENSION_ERROR'
  ) {
    super(message, code);
    this.name = 'ExtensionError';
    this.extensionId = extensionId;
    this.pointId = pointId;
  }
}

/**
 * 执行超时错误
 */
export class TimeoutError extends ExtensionError {
  public readonly timeout: number;
  
  constructor(
    message: string,
    extensionId: string,
    pointId: string,
    timeout: number
  ) {
    super(message, extensionId, pointId, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * 权限不足错误
 */
export class PermissionError extends ExtensionError {
  public readonly permission: Permission;
  
  constructor(
    message: string,
    extensionId: string,
    pointId: string,
    permission: Permission
  ) {
    super(message, extensionId, pointId, 'PERMISSION_ERROR');
    this.name = 'PermissionError';
    this.permission = permission;
  }
}

/**
 * 递归深度超限错误
 */
export class RecursionError extends ExtensionError {
  public readonly depth: number;
  
  constructor(
    message: string,
    extensionId: string,
    pointId: string,
    depth: number
  ) {
    super(message, extensionId, pointId, 'RECURSION_ERROR');
    this.name = 'RecursionError';
    this.depth = depth;
  }
}

/**
 * 版本不匹配错误
 */
export class VersionMismatchError extends KernelError {
  public readonly expected: string;
  public readonly actual: string;
  
  constructor(
    message: string,
    expected: string,
    actual: string
  ) {
    super(message, 'VERSION_MISMATCH_ERROR');
    this.name = 'VersionMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * 断路器打开错误（拒绝执行）
 */
export class CircuitOpenError extends ExtensionError {
  public readonly reason: string;
  
  constructor(
    message: string,
    extensionId: string,
    pointId: string,
    reason: string
  ) {
    super(message, extensionId, pointId, 'CIRCUIT_OPEN_ERROR');
    this.name = 'CircuitOpenError';
    this.reason = reason;
  }
}

/**
 * 循环依赖检测错误
 */
export class CircularDependencyError extends KernelError {
  public readonly cycle: string[];
  
  constructor(message: string, cycle: string[]) {
    super(message, 'CIRCULAR_DEPENDENCY_ERROR');
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

// 需要从 kernel.types.ts 导入 Permission 类型
import type { Permission } from './kernel.types.js';