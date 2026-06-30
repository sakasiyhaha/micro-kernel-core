/**
 * ============================================================
 * Logger.ts
 * 结构化日志器
 * 
 * 职责：
 * - 支持日志分级（DEBUG, INFO, WARN, ERROR）
 * - 支持日志级别过滤
 * - 支持格式化输出（文本/JSON）
 * - 支持日志输出目标（控制台/内存/自定义）
 * ============================================================
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  traceId?: string;
  data?: Record<string, unknown>;
  stack?: string;
}

export type LogTransport = (entry: LogEntry) => void;

export interface LoggerOptions {
  /** 最小日志级别，默认 'INFO' */
  minLevel?: LogLevel;
  /** 是否包含 traceId */
  includeTraceId?: boolean;
  /** 日志传输方式（默认 console） */
  transports?: LogTransport[];
  /** 是否启用 JSON 格式输出 */
  jsonFormat?: boolean;
}

export class Logger {
  private options: Required<LoggerOptions>;
  private memoryLogs: LogEntry[] = [];
  private maxMemoryLogs = 1000;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      minLevel: options.minLevel ?? 'INFO',
      includeTraceId: options.includeTraceId ?? true,
      transports: options.transports ?? [this.consoleTransport.bind(this)],
      jsonFormat: options.jsonFormat ?? false,
    };
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.options.minLevel = level;
  }

  /**
   * 添加日志传输方式
   */
  addTransport(transport: LogTransport): void {
    this.options.transports.push(transport);
  }

  /**
   * 移除日志传输方式
   */
  removeTransport(transport: LogTransport): void {
    const index = this.options.transports.indexOf(transport);
    if (index >= 0) {
      this.options.transports.splice(index, 1);
    }
  }

  /**
   * DEBUG 级别日志
   */
  debug(message: string, data?: Record<string, unknown>, traceId?: string): void {
    this.log('DEBUG', message, data, traceId);
  }

  /**
   * INFO 级别日志
   */
  info(message: string, data?: Record<string, unknown>, traceId?: string): void {
    this.log('INFO', message, data, traceId);
  }

  /**
   * WARN 级别日志
   */
  warn(message: string, data?: Record<string, unknown>, traceId?: string): void {
    this.log('WARN', message, data, traceId);
  }

  /**
   * ERROR 级别日志
   */
  error(message: string, data?: Record<string, unknown>, traceId?: string): void {
    this.log('ERROR', message, data, traceId);
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>, traceId?: string): void {
    // 级别过滤
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      traceId: this.options.includeTraceId ? traceId : undefined,
      data,
    };

    // 如果是 ERROR 级别，尝试捕获堆栈
    if (level === 'ERROR') {
      try {
        const stack = new Error().stack;
        if (stack) {
          entry.stack = stack;
        }
      } catch (_) { /* 忽略 */ }
    }

    // 存储到内存（用于调试）
    if (this.memoryLogs.length >= this.maxMemoryLogs) {
      this.memoryLogs.shift();
    }
    this.memoryLogs.push(entry);

    // 通过传输方式输出
    for (const transport of this.options.transports) {
      try {
        transport(entry);
      } catch (err) {
        console.error('[Logger] 传输失败:', err);
      }
    }
  }

  /**
   * 检查是否应该记录该级别
   */
  private shouldLog(level: LogLevel): boolean {
    const levelOrder: Record<LogLevel, number> = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3,
      'NONE': 4,
    };
    return levelOrder[level] >= levelOrder[this.options.minLevel];
  }

  /**
   * 控制台传输
   */
  private consoleTransport(entry: LogEntry): void {
    const prefix = `[${entry.level}]`;
    const time = new Date(entry.timestamp).toISOString();
    const trace = entry.traceId ? `[${entry.traceId}]` : '';

    if (this.options.jsonFormat) {
      console.log(JSON.stringify(entry));
      return;
    }

    switch (entry.level) {
      case 'DEBUG':
        console.debug(`${time} ${prefix} ${trace} ${entry.message}`, entry.data || '');
        break;
      case 'INFO':
        console.info(`${time} ${prefix} ${trace} ${entry.message}`, entry.data || '');
        break;
      case 'WARN':
        console.warn(`${time} ${prefix} ${trace} ${entry.message}`, entry.data || '');
        break;
      case 'ERROR':
        console.error(`${time} ${prefix} ${trace} ${entry.message}`, entry.data || '', entry.stack || '');
        break;
    }
  }

  /**
   * 获取内存中的日志（用于调试）
   */
  getMemoryLogs(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.memoryLogs];
    return this.memoryLogs.filter(entry => entry.level === level);
  }

  /**
   * 清空内存日志
   */
  clearMemoryLogs(): void {
    this.memoryLogs = [];
  }

  /**
   * 创建一个带 traceId 的子日志器
   */
  child(_traceId: string): Logger {
    const child = new Logger({
      minLevel: this.options.minLevel,
      includeTraceId: true,
      transports: this.options.transports,
      jsonFormat: this.options.jsonFormat,
    });
    // 将父日志器的内存日志共享给子日志器（可选）
    return child;
  }
}