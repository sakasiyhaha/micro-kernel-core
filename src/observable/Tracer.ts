/**
 * ============================================================
 * Tracer.ts
 * 链路追踪器
 * 
 * 职责：
 * - 记录执行链路（Span）
 * - 支持 Span 父子关系
 * - 导出为 JSON 格式
 * ============================================================
 */

export interface Span {
  /** Span ID */
  id: string;
  /** 父 Span ID（若为根则为 null） */
  parentId: string | null;
  /** 操作名称 */
  name: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间（若已完成） */
  endTime?: number;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 标签 */
  tags: Record<string, string>;
  /** 自定义数据 */
  data: Record<string, unknown>;
  /** 是否已完成 */
  finished: boolean;
}

export interface TracerOptions {
  /** 是否启用追踪（默认 true） */
  enabled?: boolean;
  /** 最大 Span 数量（默认 1000） */
  maxSpans?: number;
  /** 采样率（0-1，默认 1） */
  sampleRate?: number;
}

export class Tracer {
  private spans: Span[] = [];
  private activeSpans = new Map<string, Span>();
  private options: Required<TracerOptions>;

  constructor(options: TracerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      maxSpans: options.maxSpans ?? 1000,
      sampleRate: options.sampleRate ?? 1,
    };
  }

  /**
   * 开始一个 Span
   * @param name 操作名称
   * @param parentId 父 Span ID（可选）
   * @param tags 标签（可选）
   * @returns Span ID
   */
  startSpan(name: string, parentId?: string, tags?: Record<string, string>): string {
    if (!this.options.enabled) return '';

    // 采样判断
    if (Math.random() > this.options.sampleRate) {
      return '';
    }

    const id = this.generateId();
    const span: Span = {
      id,
      parentId: parentId || null,
      name,
      startTime: Date.now(),
      tags: tags || {},
      data: {},
      finished: false,
    };

    this.activeSpans.set(id, span);
    return id;
  }

  /**
   * 结束一个 Span
   * @param spanId Span ID
   * @param data 结束数据
   */
  endSpan(spanId: string, data?: Record<string, unknown>): void {
    if (!this.options.enabled) return;

    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    if (data) {
      span.data = { ...span.data, ...data };
    }
    span.finished = true;

    this.activeSpans.delete(spanId);
    this.spans.push(span);

    // 限制最大 Span 数量
    if (this.spans.length > this.options.maxSpans) {
      this.spans = this.spans.slice(-this.options.maxSpans);
    }
  }

  /**
   * 添加标签到 Span
   */
  addTag(spanId: string, key: string, value: string): void {
    if (!this.options.enabled) return;
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * 添加数据到 Span
   */
  addData(spanId: string, key: string, value: unknown): void {
    if (!this.options.enabled) return;
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.data[key] = value;
    }
  }

  /**
   * 获取所有已完成 Span
   */
  getSpans(): Span[] {
    return [...this.spans];
  }

  /**
   * 获取活跃的 Span
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * 获取指定根 Span 的完整链路（包含所有子 Span）
   */
  getTrace(rootSpanId: string): Span[] {
    const result: Span[] = [];
    const root = this.spans.find(s => s.id === rootSpanId);
    if (root) {
      result.push(root);
    }

    // 查找所有子 Span
    const children = this.spans.filter(s => s.parentId === rootSpanId);
    result.push(...children);

    return result;
  }

  /**
   * 导出为 JSON 格式
   */
  exportJSON(): string {
    return JSON.stringify({
      spans: this.spans,
      activeSpans: Array.from(this.activeSpans.values()),
      total: this.spans.length,
    }, null, 2);
  }

  /**
   * 清空所有 Span
   */
  clear(): void {
    this.spans = [];
    this.activeSpans.clear();
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 启用/禁用追踪
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }
}