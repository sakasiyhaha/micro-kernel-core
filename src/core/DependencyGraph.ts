/**
 * ============================================================
 * DependencyGraph.ts
 * 循环依赖检测器（DFS 三色标记法）
 * 
 * 职责：
 * - 维护扩展 ID 之间的有向边关系
 * - 检测是否存在循环依赖
 * - 在发现环时抛出 CircularDependencyError
 * 
 * 算法：DFS 三色标记法（白色=未访问，灰色=访问中，黑色=已完成）
 * 复杂度：O(V + E)
 * ============================================================
 */

import { CircularDependencyError } from '../types/errors.types.js';

/**
 * 节点状态枚举
 * - 0: 未访问（白色）
 * - 1: 访问中（灰色）- 当前在 DFS 调用栈中
 * - 2: 已完成（黑色）- 所有邻接节点已探索完成
 */
type NodeState = 0 | 1 | 2;

export class DependencyGraph {
  /**
   * 所有已注册的节点 ID 集合
   */
  private nodes = new Set<string>();

  /**
   * 有向边映射：from → Set<to>
   * 表示 from 依赖于 to
   */
  private edges = new Map<string, Set<string>>();

  /**
   * ============================================================
   * 节点管理
   * ============================================================
   */

  /**
   * 添加一个节点
   * 若节点已存在，则忽略
   */
  addNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      this.nodes.add(nodeId);
    }
  }

  /**
   * 移除一个节点及其所有关联的边
   */
  removeNode(nodeId: string): void {
    // 1. 从 nodes 中移除
    this.nodes.delete(nodeId);

    // 2. 从 edges 中移除作为 key 的条目
    this.edges.delete(nodeId);

    // 3. 遍历所有 edges，从每个 Set 中移除该节点
    for (const [_, targets] of this.edges) {
      targets.delete(nodeId);
    }
  }

  /**
   * 清空所有节点和边
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }

  /**
   * 获取所有节点 ID（只读视图）
   */
  getNodes(): ReadonlySet<string> {
    return this.nodes;
  }

  /**
   * ============================================================
   * 边管理
   * ============================================================
   */

  /**
   * 添加一条有向边：from → to
   * 表示 from 依赖于 to
   * 
   * 若节点不存在，自动创建
   */
  addDependency(from: string, to: string): void {
    // 确保节点存在
    this.addNode(from);
    this.addNode(to);

    // 获取或创建目标集合
    let targets = this.edges.get(from);
    if (!targets) {
      targets = new Set<string>();
      this.edges.set(from, targets);
    }
    targets.add(to);
  }

  /**
   * 移除一条有向边：from → to
   * 若边不存在，则忽略
   */
  removeDependency(from: string, to: string): void {
    const targets = this.edges.get(from);
    if (targets) {
      targets.delete(to);
      // 如果目标集合为空，可以保留空 Set 或删除 key（保留以便后续复用）
    }
  }

  /**
   * 获取从指定节点出发的所有目标节点
   */
  getDependencies(nodeId: string): ReadonlySet<string> | undefined {
    return this.edges.get(nodeId);
  }

  /**
   * ============================================================
   * 环检测（核心算法）
   * ============================================================
   */

  /**
   * 检测图中是否存在循环依赖
   * @param startNode 可选：若传入，仅检测以该节点为起点的环；若不传，检测全图
   * @returns 若存在环，返回环路径数组；若不存在，返回 null
   */
  detectCycles(startNode?: string): string[][] | null {
    const state = new Map<string, NodeState>();
    const parent = new Map<string, string>();
    const cycles: string[][] = [];

    // 初始化所有节点的状态为未访问
    for (const node of this.nodes) {
      state.set(node, 0);
    }

    // DFS 递归函数（使用内部函数避免污染类作用域）
    const dfs = (node: string, path: string[]): void => {
      state.set(node, 1); // 标记为访问中（灰色）
      path.push(node);

      const neighbors = this.edges.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          const neighborState = state.get(neighbor);

          if (neighborState === 0) {
            // 未访问，递归探索
            parent.set(neighbor, node);
            dfs(neighbor, path);
          } else if (neighborState === 1) {
            // 发现环：neighbor 在当前 DFS 调用栈中
            // 从 node 回溯到 neighbor，构建环路径
            const cycle: string[] = [];
            let current = node;
            while (current !== neighbor) {
              cycle.unshift(current);
              current = parent.get(current)!;
            }
            cycle.unshift(neighbor);
            cycle.push(neighbor); // 闭环：首尾相同
            cycles.push(cycle);
          }
          // 若 neighborState === 2，已完全探索，跳过
        }
      }

      state.set(node, 2); // 标记为已完成（黑色）
      path.pop();
    };

    // 确定起始节点
    if (startNode) {
      // 检查起始节点是否存在
      if (!this.nodes.has(startNode)) {
        throw new Error(`节点 "${startNode}" 不存在于依赖图中`);
      }
      // 从指定节点开始 DFS
      if (state.get(startNode) === 0) {
        dfs(startNode, []);
      }
      // 如果起始节点已访问，可能还有其他未访问节点，但我们只关心起始节点可达的环
      // 为了完整检测，还可以继续遍历其他节点，但该模式下只检测从 startNode 可达到的环
    } else {
      // 遍历所有节点
      for (const node of this.nodes) {
        if (state.get(node) === 0) {
          dfs(node, []);
        }
      }
    }

    return cycles.length > 0 ? cycles : null;
  }

  /**
   * 检测环，若发现则直接抛出 CircularDependencyError
   * @param startNode 可选：若传入，仅检测以该节点为起点的环
   * @throws {CircularDependencyError} 当检测到循环依赖时
   */
  validateAndThrow(startNode?: string): void {
    const cycles = this.detectCycles(startNode);
    if (cycles && cycles.length > 0) {
      // 取第一个环作为错误信息
      const cycle = cycles[0];
      const pathStr = cycle.join(' → ');
      throw new CircularDependencyError(
        `检测到循环依赖: ${pathStr}`,
        cycle
      );
    }
  }

  /**
   * ============================================================
   * 辅助方法
   * ============================================================
   */

  /**
   * 检查两个节点之间是否存在直接依赖关系
   */
  hasDirectDependency(from: string, to: string): boolean {
    const targets = this.edges.get(from);
    return targets ? targets.has(to) : false;
  }

  /**
   * 检查图中是否存在指定节点
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * 获取图中的边数
   */
  getEdgeCount(): number {
    let count = 0;
    for (const targets of this.edges.values()) {
      count += targets.size;
    }
    return count;
  }

  /**
   * 导出图的 JSON 快照（用于调试和测试）
   */
  toJSON(): {
    nodes: string[];
    edges: Record<string, string[]>;
  } {
    const edgeMap: Record<string, string[]> = {};
    for (const [from, targets] of this.edges) {
      edgeMap[from] = Array.from(targets);
    }
    return {
      nodes: Array.from(this.nodes),
      edges: edgeMap
    };
  }
}
