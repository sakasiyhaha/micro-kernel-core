/**
 * ============================================================
 * mockExtensions.ts
 * 测试用 Mock 扩展定义
 * ============================================================
 */

import type { Extension, ExecutionContext } from '../../src/types/extension.types.js';

/**
 * 创建一个简单的测试扩展
 */
export function createMockExtension(
  id: string,
  pointId: string,
  options?: {
    parentId?: string;
    priority?: number;
    execute?: (ctx: ExecutionContext, ...args: any[]) => any;
  }
): Extension {
  return {
    id,
    pointId,
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: options?.priority ?? 100,
    parentId: options?.parentId ?? null,
    execute: options?.execute ?? (async () => ({ id, result: 'success' })),
  };
}

/**
 * 创建一个会抛出异常的扩展
 */
export function createErrorExtension(
  id: string,
  pointId: string,
  errorMessage: string = 'Test error'
): Extension {
  return {
    id,
    pointId,
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 100,
    parentId: null,
    execute: async () => {
      throw new Error(errorMessage);
    },
  };
}

/**
 * 创建一个带父实现的扩展（继承场景）
 */
export function createInheritedExtension(
  id: string,
  pointId: string,
  parentId: string,
  customExecute?: (ctx: ExecutionContext, ...args: any[]) => any
): Extension {
  return {
    id,
    pointId,
    version: '1.0.0',
    apiVersion: '1.0.0',
    priority: 100,
    parentId,
    execute: customExecute ?? (async (ctx, ...args) => {
      // 调用父实现
      if (ctx.super) {
        return await ctx.super(...args);
      }
      return { id, inherited: true };
    }),
  };
}