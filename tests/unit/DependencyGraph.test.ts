/**
 * ============================================================
 * DependencyGraph.test.ts
 * 循环依赖检测器单元测试
 * ============================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../src/core/DependencyGraph.js';
import { CircularDependencyError } from '../../src/types/errors.types.js';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('节点管理', () => {
    it('应该能添加节点', () => {
      graph.addNode('A');
      expect(graph.hasNode('A')).toBe(true);
      expect(graph.getNodes().size).toBe(1);
    });

    it('应该能移除节点及其关联边', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      expect(graph.hasNode('A')).toBe(true);
      expect(graph.getEdgeCount()).toBe(2);

      graph.removeNode('A');
      expect(graph.hasNode('A')).toBe(false);
      expect(graph.getEdgeCount()).toBe(0);
    });

    it('应该能清空所有节点和边', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      expect(graph.getNodes().size).toBe(3);
      expect(graph.getEdgeCount()).toBe(2);

      graph.clear();
      expect(graph.getNodes().size).toBe(0);
      expect(graph.getEdgeCount()).toBe(0);
    });
  });

  describe('边管理', () => {
    it('应该能添加有向边', () => {
      graph.addDependency('A', 'B');
      expect(graph.hasDirectDependency('A', 'B')).toBe(true);
      expect(graph.hasDirectDependency('B', 'A')).toBe(false);
    });

    it('添加边时应该自动创建节点', () => {
      graph.addDependency('A', 'B');
      expect(graph.hasNode('A')).toBe(true);
      expect(graph.hasNode('B')).toBe(true);
    });

    it('应该能移除有向边', () => {
      graph.addDependency('A', 'B');
      expect(graph.hasDirectDependency('A', 'B')).toBe(true);

      graph.removeDependency('A', 'B');
      expect(graph.hasDirectDependency('A', 'B')).toBe(false);
    });

    it('应该能获取节点的所有依赖', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');
      graph.addDependency('A', 'D');

      const deps = graph.getDependencies('A');
      expect(deps).toBeDefined();
      expect(deps!.size).toBe(3);
      expect(deps!.has('B')).toBe(true);
      expect(deps!.has('C')).toBe(true);
      expect(deps!.has('D')).toBe(true);
    });
  });

  describe('环检测', () => {
    it('无环图应该返回 null', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'D');

      const cycles = graph.detectCycles();
      expect(cycles).toBeNull();
    });

    it('应该检测到简单环 A→B→C→A', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'A');

      const cycles = graph.detectCycles();
      expect(cycles).not.toBeNull();
      expect(cycles!.length).toBe(1);
      expect(cycles![0]).toContain('A');
      expect(cycles![0]).toContain('B');
      expect(cycles![0]).toContain('C');
      // 首尾相同形成闭环
      expect(cycles![0][0]).toBe(cycles![0][cycles![0].length - 1]);
    });

    it('应该检测到自依赖 A→A', () => {
      graph.addDependency('A', 'A');

      const cycles = graph.detectCycles();
      expect(cycles).not.toBeNull();
      expect(cycles![0]).toEqual(['A', 'A']);
    });

    it('应该检测到多个环', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'A'); // 环1
      graph.addDependency('C', 'D');
      graph.addDependency('D', 'C'); // 环2

      const cycles = graph.detectCycles();
      expect(cycles).not.toBeNull();
      expect(cycles!.length).toBe(2);
    });

    it('应该检测到复杂环', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'D');
      graph.addDependency('D', 'B'); // B→C→D→B 形成环

      const cycles = graph.detectCycles();
      expect(cycles).not.toBeNull();
      expect(cycles![0]).toContain('B');
      expect(cycles![0]).toContain('C');
      expect(cycles![0]).toContain('D');
    });

    it('从指定节点检测环', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'A'); // 环 A→B→C→A
      graph.addDependency('D', 'E'); // 无关边

      // 从 A 检测，应该检测到环
      const cyclesFromA = graph.detectCycles('A');
      expect(cyclesFromA).not.toBeNull();

      // 从 D 检测，应该没有环（D→E 无环）
      const cyclesFromD = graph.detectCycles('D');
      expect(cyclesFromD).toBeNull();
    });

    it('验证并抛出错误', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'A');

      expect(() => graph.validateAndThrow()).toThrow(CircularDependencyError);
    });

    it('验证从指定节点并抛出错误', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');
      graph.addDependency('C', 'A');

      // 从 A 检测，应该抛出
      expect(() => graph.validateAndThrow('A')).toThrow(CircularDependencyError);

      // 从 B 检测，也应该抛出（B 在环中）
      expect(() => graph.validateAndThrow('B')).toThrow(CircularDependencyError);
    });

    it('无环时不抛出错误', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('B', 'C');

      expect(() => graph.validateAndThrow()).not.toThrow();
    });
  });

  describe('辅助方法', () => {
    it('应该返回正确的边数', () => {
      expect(graph.getEdgeCount()).toBe(0);
      graph.addDependency('A', 'B');
      expect(graph.getEdgeCount()).toBe(1);
      graph.addDependency('A', 'C');
      expect(graph.getEdgeCount()).toBe(2);
    });

    it('应该导出 JSON 快照', () => {
      graph.addDependency('A', 'B');
      graph.addDependency('A', 'C');

      const json = graph.toJSON();
      expect(json.nodes).toEqual(expect.arrayContaining(['A', 'B', 'C']));
      expect(json.edges).toHaveProperty('A');
      expect(json.edges['A']).toEqual(expect.arrayContaining(['B', 'C']));
    });
  });
});