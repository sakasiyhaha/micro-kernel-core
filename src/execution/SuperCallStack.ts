/**
 * ============================================================
 * SuperCallStack.ts
 * 异步调用栈管理器
 * 
 * 职责：
 * - 维护执行调用的层级关系
 * - 确保 super 调用在并发场景下指向正确的父实现
 * - 防止无限递归（检测循环调用）
 * 
 * 实现策略：
 * - Node.js: 使用 AsyncLocalStorage（需引入）
 * - 浏览器: 使用调用栈数组 + 执行 ID 标记（降级方案）
 * ============================================================
 */

export interface CallFrame {
  /** 扩展 ID */
  extensionId: string;
  /** 扩展点 ID */
  pointId: string;
  /** 父扩展 ID（调用 super 的目标） */
  parentId: string | null;
  /** 调用深度 */
  depth: number;
}

export class SuperCallStack {
  /**
   * 调用栈（数组模拟）
   * 在浏览器环境中使用简单数组管理
   */
  private stack: CallFrame[] = [];

  /**
   * 最大调用深度
   */
  private maxDepth: number;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  /**
   * 压入调用帧
   * @param frame 调用帧
   * @returns 当前深度
   * @throws {RecursionError} 当超过最大深度时
   */
  push(frame: Omit<CallFrame, 'depth'>): CallFrame {
    const depth = this.stack.length + 1;
    if (depth > this.maxDepth) {
      throw new Error(`调用深度超限: 最大 ${this.maxDepth} 层`);
    }
    const fullFrame: CallFrame = { ...frame, depth };
    this.stack.push(fullFrame);
    return fullFrame;
  }

  /**
   * 弹出调用帧
   */
  pop(): CallFrame | undefined {
    return this.stack.pop();
  }

  /**
   * 获取当前调用帧
   */
  current(): CallFrame | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * 获取父实现 ID（用于 super 调用）
   * @returns 父实现 ID，若无则返回 null
   */
  getParentId(): string | null {
    const current = this.current();
    if (!current) return null;
    return current.parentId;
  }

  /**
   * 检查是否在指定扩展的调用上下文中
   */
  isInContext(extensionId: string): boolean {
    return this.stack.some(frame => frame.extensionId === extensionId);
  }

  /**
   * 获取当前调用深度
   */
  depth(): number {
    return this.stack.length;
  }

  /**
   * 清空调用栈
   */
  clear(): void {
    this.stack = [];
  }

  /**
   * 获取调用栈快照（用于调试）
   */
  snapshot(): CallFrame[] {
    return [...this.stack];
  }

  /**
   * 检查是否存在循环调用
   * @param extensionId 要检查的扩展 ID
   * @returns 是否存在循环
   */
  hasCycle(extensionId: string): boolean {
    return this.stack.some(frame => frame.extensionId === extensionId);
  }
}