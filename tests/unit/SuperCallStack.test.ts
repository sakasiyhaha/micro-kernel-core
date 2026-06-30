/**
 * ============================================================
 * SuperCallStack.test.ts
 * 异步调用栈单元测试
 * ============================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SuperCallStack } from '../../src/execution/SuperCallStack.js';

describe('SuperCallStack', () => {
  let stack: SuperCallStack;

  beforeEach(() => {
    stack = new SuperCallStack(10);
  });

  it('初始状态应该为空', () => {
    expect(stack.depth()).toBe(0);
    expect(stack.current()).toBeUndefined();
  });

  it('应该能压入调用帧', () => {
    const frame = stack.push({
      extensionId: 'ext-1',
      pointId: 'point-1',
      parentId: null,
    });

    expect(stack.depth()).toBe(1);
    expect(frame.depth).toBe(1);
    expect(frame.extensionId).toBe('ext-1');
  });

  it('应该能弹出调用帧', () => {
    stack.push({
      extensionId: 'ext-1',
      pointId: 'point-1',
      parentId: null,
    });

    const popped = stack.pop();
    expect(popped).toBeDefined();
    expect(popped!.extensionId).toBe('ext-1');
    expect(stack.depth()).toBe(0);
  });

  it('应该能获取当前调用帧', () => {
    stack.push({
      extensionId: 'ext-1',
      pointId: 'point-1',
      parentId: null,
    });
    stack.push({
      extensionId: 'ext-2',
      pointId: 'point-1',
      parentId: 'ext-1',
    });

    const current = stack.current();
    expect(current).toBeDefined();
    expect(current!.extensionId).toBe('ext-2');
    expect(current!.parentId).toBe('ext-1');
  });

  it('应该能获取父实现 ID', () => {
    stack.push({
      extensionId: 'ext-1',
      pointId: 'point-1',
      parentId: null,
    });
    stack.push({
      extensionId: 'ext-2',
      pointId: 'point-1',
      parentId: 'ext-1',
    });

    expect(stack.getParentId()).toBe('ext-1');
  });

  it('没有父实现时返回 null', () => {
    stack.push({
      extensionId: 'ext-1',
      pointId: 'point-1',
      parentId: null,
    });

    expect(stack.getParentId()).toBeNull();
  });

  it('应该检测循环调用', () => {
    stack.push({
      extensionId: 'ext-1',
      pointId: 'point-1',
      parentId: null,
    });

    expect(stack.hasCycle('ext-1')).toBe(true);
    expect(stack.hasCycle('ext-2')).toBe(false);
  });

  it('超过最大深度应该抛出错误', () => {
    const smallStack = new SuperCallStack(2);
    smallStack.push({ extensionId: '1', pointId: 'p', parentId: null });
    smallStack.push({ extensionId: '2', pointId: 'p', parentId: '1' });

    expect(() => {
      smallStack.push({ extensionId: '3', pointId: 'p', parentId: '2' });
    }).toThrow('调用深度超限');
  });

  it('应该能清空调用栈', () => {
    stack.push({ extensionId: 'ext-1', pointId: 'point-1', parentId: null });
    stack.push({ extensionId: 'ext-2', pointId: 'point-1', parentId: 'ext-1' });

    expect(stack.depth()).toBe(2);
    stack.clear();
    expect(stack.depth()).toBe(0);
  });

  it('应该能获取调用栈快照', () => {
    stack.push({ extensionId: 'ext-1', pointId: 'point-1', parentId: null });
    stack.push({ extensionId: 'ext-2', pointId: 'point-1', parentId: 'ext-1' });

    const snapshot = stack.snapshot();
    expect(snapshot.length).toBe(2);
    expect(snapshot[0].extensionId).toBe('ext-1');
    expect(snapshot[1].extensionId).toBe('ext-2');
  });
});