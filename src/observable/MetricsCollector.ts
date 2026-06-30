/**
 * ============================================================
 * MetricsCollector.ts
 * 指标收集器
 * 
 * 职责：
 * - 计数器（Counter）：累计值
 * - 计时器（Timer）：记录耗时分布
 * - 直方图（Histogram）：记录值分布
 * - 支持导出为 JSON
 * ============================================================
 */

export interface Counter {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

export interface TimerData {
  name: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms?: number;
  p95Ms?: number;
  p99Ms?: number;
}

export interface HistogramData {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: Array<{ threshold: number; count: number }>;
}

export interface MetricsSnapshot {
  counters: Counter[];
  timers: TimerData[];
  histograms: HistogramData[];
  timestamp: number;
}

export class MetricsCollector {
  private counters = new Map<string, Counter>();
  private timers = new Map<string, { values: number[]; min: number; max: number; total: number }>();
  private histograms = new Map<string, { values: number[]; buckets: Map<number, number> }>();

  /**
   * 增加计数器
   * @param name 计数器名称
   * @param value 增量（默认 1）
   * @param labels 标签
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    if (!this.counters.has(key)) {
      this.counters.set(key, { name, value: 0, labels });
    }
    const counter = this.counters.get(key)!;
    counter.value += value;
  }

  /**
   * 获取计数器值
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.buildKey(name, labels);
    const counter = this.counters.get(key);
    return counter ? counter.value : 0;
  }

  /**
   * 记录计时器
   * @param name 计时器名称
   * @param ms 耗时（毫秒）
   * @param labels 标签
   */
  recordTimer(name: string, ms: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    if (!this.timers.has(key)) {
      this.timers.set(key, { values: [], min: Infinity, max: -Infinity, total: 0 });
    }
    const timer = this.timers.get(key)!;
    timer.values.push(ms);
    timer.total += ms;
    timer.min = Math.min(timer.min, ms);
    timer.max = Math.max(timer.max, ms);
  }

  /**
   * 获取计时器统计数据
   */
  getTimer(name: string, labels?: Record<string, string>): TimerData | null {
    const key = this.buildKey(name, labels);
    const timer = this.timers.get(key);
    if (!timer || timer.values.length === 0) return null;

    const sorted = [...timer.values].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      name,
      count,
      totalMs: timer.total,
      minMs: timer.min,
      maxMs: timer.max,
      avgMs: timer.total / count,
      p50Ms: this.percentile(sorted, 50),
      p95Ms: this.percentile(sorted, 95),
      p99Ms: this.percentile(sorted, 99),
    };
  }

  /**
   * 记录直方图值
   * @param name 直方图名称
   * @param value 值
   * @param labels 标签
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, { values: [], buckets: new Map() });
    }
    const hist = this.histograms.get(key)!;
    hist.values.push(value);

    // 更新桶
    // 默认桶边界：0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
    const bucketThresholds = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    for (const threshold of bucketThresholds) {
      if (value <= threshold) {
        if (!hist.buckets.has(threshold)) {
          hist.buckets.set(threshold, 0);
        }
        hist.buckets.set(threshold, hist.buckets.get(threshold)! + 1);
        break;
      }
    }
  }

  /**
   * 获取直方图数据
   */
  getHistogram(name: string, labels?: Record<string, string>): HistogramData | null {
    const key = this.buildKey(name, labels);
    const hist = this.histograms.get(key);
    if (!hist || hist.values.length === 0) return null;

    const sorted = [...hist.values].sort((a, b) => a - b);
    const count = sorted.length;

    const buckets: Array<{ threshold: number; count: number }> = [];
    const sortedBuckets = Array.from(hist.buckets.keys()).sort((a, b) => a - b);
    let cumulative = 0;
    for (const threshold of sortedBuckets) {
      cumulative += hist.buckets.get(threshold) || 0;
      buckets.push({ threshold, count: cumulative });
    }

    return {
      name,
      count,
      sum: sorted.reduce((a, b) => a + b, 0),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      buckets,
    };
  }

  /**
   * 获取所有指标的快照
   */
  snapshot(): MetricsSnapshot {
    const counters: Counter[] = Array.from(this.counters.values());
    const timers: TimerData[] = [];
    const histograms: HistogramData[] = [];

    for (const key of this.timers.keys()) {
      const timer = this.getTimerFromKey(key);
      if (timer) timers.push(timer);
    }

    for (const key of this.histograms.keys()) {
      const hist = this.getHistogramFromKey(key);
      if (hist) histograms.push(hist);
    }

    return {
      counters,
      timers,
      histograms,
      timestamp: Date.now(),
    };
  }

  /**
   * 清空所有指标
   */
  clear(): void {
    this.counters.clear();
    this.timers.clear();
    this.histograms.clear();
  }

  /**
   * 构建存储键
   */
  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.entries(labels)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${sortedLabels}}`;
  }

  /**
   * 从存储键获取定时器数据
   */
  private getTimerFromKey(key: string): TimerData | null {
    // 解析 key 获取 name 和 labels
    const match = key.match(/^(.+)\{(.+)\}$/);
    if (match) {
      const name = match[1];
      const labels: Record<string, string> = {};
      const pairs = match[2].split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k && v) labels[k] = v;
      }
      return this.getTimer(name, labels);
    }
    return this.getTimer(key);
  }

  /**
   * 从存储键获取直方图数据
   */
  private getHistogramFromKey(key: string): HistogramData | null {
    const match = key.match(/^(.+)\{(.+)\}$/);
    if (match) {
      const name = match[1];
      const labels: Record<string, string> = {};
      const pairs = match[2].split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k && v) labels[k] = v;
      }
      return this.getHistogram(name, labels);
    }
    return this.getHistogram(key);
  }

  /**
   * 计算百分位数
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}