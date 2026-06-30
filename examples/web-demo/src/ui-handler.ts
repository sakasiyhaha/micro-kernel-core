/**
 * ============================================================
 * ui-handler.ts - UI 事件处理器（修复版）
 * ============================================================
 */

import { KernelManager } from './kernel-manager.js';
import {
  runBasicDemo,
  runInheritanceDemo,
  runFallbackDemo,
  runPermissionsDemo,
  runObservabilityDemo,
} from './demos/index.js';

type DemoName = 'basic' | 'inheritance' | 'fallback' | 'permissions' | 'observability';

interface OutputLine {
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

const DEMO_MAP: Record<DemoName, { title: string; description: string; fn: any }> = {
  basic: {
    title: '📘 基础用法',
    description: '创建内核、注册 4 个计算器扩展、执行计算',
    fn: runBasicDemo,
  },
  inheritance: {
    title: '🌳 继承与覆盖',
    description: '演示 inherit()、override() 和 ctx.super() 调用链',
    fn: runInheritanceDemo,
  },
  fallback: {
    title: '🛡️ 降级与容错',
    description: '演示降级策略（null/throw/ignore）和断路器熔断',
    fn: runFallbackDemo,
  },
  permissions: {
    title: '🔐 权限管理',
    description: '演示权限规则、通配符匹配和权限校验',
    fn: runPermissionsDemo,
  },
  observability: {
    title: '📊 可观测性',
    description: '演示结构化日志、链路追踪和指标收集',
    fn: runObservabilityDemo,
  },
};

export class UIHandler {
  private manager: KernelManager;
  private currentDemo: DemoName = 'basic';
  private outputLines: OutputLine[] = [];
  private outputLimit = 100;

  constructor(manager: KernelManager) {
    this.manager = manager;
  }

  setupEventListeners(): void {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.addEventListener('click', () => {
        const demo = el.getAttribute('data-demo') as DemoName;
        if (demo && demo !== this.currentDemo) {
          this.switchDemo(demo);
        }
      });
    });

    document.getElementById('btn-run-demo')?.addEventListener('click', () => {
      this.runCurrentDemo();
    });

    document.getElementById('btn-clear-output')?.addEventListener('click', () => {
      this.clearOutput();
    });

    document.getElementById('btn-reset-kernel')?.addEventListener('click', async () => {
      await this.resetKernel();
    });

    this.manager.initKernel(true);
    this.updateStatus();
    this.switchDemo('basic');
  }

  switchDemo(demo: DemoName): void {
    this.currentDemo = demo;

    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-demo') === demo);
    });

    const info = DEMO_MAP[demo];
    document.getElementById('demo-title')!.textContent = info.title;
    document.getElementById('demo-description')!.textContent = info.description;

    this.clearOutput();
    this.updateStatus();
  }

  async runCurrentDemo(): Promise<void> {
    const info = DEMO_MAP[this.currentDemo];
    this.addOutput('info', `开始运行: ${info.title}`);

    if (!this.manager.getKernel()) {
      this.manager.initKernel(true);
      this.addOutput('info', '已重新初始化内核');
    }

    const result = await this.manager.runDemo(info.fn);

    if (result.success) {
      this.addOutput('success', `✅ ${result.message}`);
    } else {
      this.addOutput('error', `❌ ${result.message}`);
      if (result.error) {
        this.addOutput('error', `   原因: ${result.error}`);
      }
    }

    this.updateStatus();
  }

  async resetKernel(): Promise<void> {
    await this.manager.resetKernel();
    this.manager.initKernel(true);
    this.clearOutput();
    this.addOutput('info', '🔄 内核已重置');
    this.updateStatus();
  }

  addOutput(level: OutputLine['level'], message: string): void {
    const time = new Date().toLocaleTimeString();
    this.outputLines.push({ time, level, message });

    if (this.outputLines.length > this.outputLimit) {
      this.outputLines = this.outputLines.slice(-this.outputLimit);
    }

    this.renderOutput();
  }

  renderOutput(): void {
    const container = document.getElementById('output-body')!;
    const count = document.getElementById('output-count')!;

    if (this.outputLines.length === 0) {
      container.innerHTML = '<div class="output-placeholder">暂无输出</div>';
      count.textContent = '0 条';
      return;
    }

    container.innerHTML = this.outputLines
      .map(
        (line) => `
      <div class="output-line">
        <span class="time">${line.time}</span>
        <span class="level ${line.level}">[${line.level}]</span>
        <span class="message">${this.escapeHtml(line.message)}</span>
      </div>
    `
      )
      .join('');

    count.textContent = `${this.outputLines.length} 条`;
    container.scrollTop = container.scrollHeight;
  }

  clearOutput(): void {
    this.outputLines = [];
    this.renderOutput();
  }

  updateStatus(): void {
    const state = this.manager.getState();
    if (!state) {
      document.getElementById('stat-points')!.textContent = '-';
      document.getElementById('stat-impls')!.textContent = '-';
      document.getElementById('stat-nodes')!.textContent = '-';
      document.getElementById('stat-edges')!.textContent = '-';
      return;
    }

    let totalImpls = 0;
    for (const key in state.implementations) {
      totalImpls += state.implementations[key].length;
    }

    document.getElementById('stat-points')!.textContent = String(state.points.length);
    document.getElementById('stat-impls')!.textContent = String(totalImpls);
    document.getElementById('stat-nodes')!.textContent = String(state.dependencyGraph.nodes.length);
    document.getElementById('stat-edges')!.textContent = String(Object.keys(state.dependencyGraph.edges).length);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}