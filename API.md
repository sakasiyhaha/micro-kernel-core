# API 文档

> 完整的 Micro-Kernel Core API 参考文档

---

## 目录

- [Kernel 主类](#kernel-主类)
  - [构造函数](#构造函数)
  - [add()](#add)
  - [override()](#override)
  - [inherit()](#inherit)
  - [execute()](#execute)
  - [getState()](#getstate)
  - [destroy()](#destroy)
- [核心类型](#核心类型)
  - [Extension](#extension)
  - [ExecutionContext](#executioncontext)
  - [KernelConfig](#kernelconfig)
  - [ExtensionPointMeta](#extensionpointmeta)
  - [FallbackPolicy](#fallbackpolicy)
  - [Permission](#permission)
- [版本管理](#版本管理)
  - [VersionRouter](#versionrouter)
  - [VersionLock](#versionlock)
  - [SemVer 工具函数](#semver-工具函数)
- [执行引擎](#执行引擎)
  - [Executor](#executor)
  - [ContextFactory](#contextfactory)
  - [DraftManager](#draftmanager)
  - [SuperCallStack](#supercallstack)
- [降级与容错](#降级与容错)
  - [CircuitBreaker](#circuitbreaker)
  - [FallbackExecutor](#fallbackexecutor)
- [存储层](#存储层)
  - [SharedStore](#sharedstore)
  - [OwnershipTracker](#ownershiptracker)
- [可观测性](#可观测性)
  - [Logger](#logger)
  - [Tracer](#tracer)
  - [MetricsCollector](#metricscollector)
- [安全模块](#安全模块)
  - [PermissionManager](#permissionmanager)
  - [SandboxProxy](#sandboxproxy)
- [错误类型](#错误类型)
- [类型索引](#类型索引)

---

## Kernel 主类

微内核的门面类，对外提供所有核心 API。

### 构造函数

```typescript
new Kernel(config: KernelConfig): Kernel
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `config.version` | `string` | ✅ | 内核语义化版本，如 `'1.0.0'` |
| `config.strictMode` | `boolean` | ❌ | 是否开启严格模式，默认 `true` |
| `config.maxExecutionDepth` | `number` | ❌ | 最大调用深度，默认 `50` |
| `config.enableCircuitBreaker` | `boolean` | ❌ | 是否启用断路器，默认 `true` |
| `config.defaultFallback` | `FallbackPolicy` | ❌ | 全局默认降级策略，默认 `'throw'` |
| `config.timeoutMs` | `number` | ❌ | 执行超时时间（毫秒），默认 `30000` |
| `config.debug` | `boolean` | ❌ | 是否开启调试日志，默认 `false` |

**示例**：

```typescript
const kernel = new Kernel({
  version: '1.0.0',
  strictMode: true,
  defaultFallback: 'null',
  timeoutMs: 5000,
  debug: true,
});
```

---

### add()

注册一个扩展实现到指定扩展点。

```typescript
kernel.add(pointId: string, extension: Extension): void
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `pointId` | `string` | 扩展点 ID |
| `extension` | `Extension` | 扩展实现对象 |

**抛出异常**：
- `KernelError`：当扩展点不允许覆盖时
- `CircularDependencyError`：当检测到循环依赖时

**示例**：

```typescript
kernel.add('calculator.add', {
  id: 'add-impl',
  pointId: 'calculator.add',
  version: '1.0.0',
  apiVersion: '1.0.0',
  execute: async (ctx, a: number, b: number) => a + b,
});
```

---

### override()

用新实现覆盖已有的实现。

```typescript
kernel.override(pointId: string, targetId: string, newImpl: Extension): void
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `pointId` | `string` | 扩展点 ID |
| `targetId` | `string` | 被覆盖的实现 ID |
| `newImpl` | `Extension` | 新实现对象（会自动设置 `parentId = targetId`） |

**抛出异常**：
- `KernelError`：当目标实现不存在或扩展点不允许覆盖时

**示例**：

```typescript
kernel.override('calculator.add', 'base-add', {
  id: 'premium-add',
  pointId: 'calculator.add',
  version: '2.0.0',
  apiVersion: '2.0.0',
  execute: async (ctx, a: number, b: number) => {
    // 增强版加法
    return a + b;
  },
});
```

---

### inherit()

基于现有实现创建派生实现（继承）。

```typescript
kernel.inherit(pointId: string, parentId: string, childImpl: Extension): void
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `pointId` | `string` | 扩展点 ID |
| `parentId` | `string` | 父实现 ID |
| `childImpl` | `Extension` | 子实现对象（会自动设置 `parentId = parentId`） |

**抛出异常**：
- `KernelError`：当父实现不存在或扩展点不允许继承时

**示例**：

```typescript
kernel.inherit('calculator.add', 'base-add', {
  id: 'log-add',
  pointId: 'calculator.add',
  version: '1.0.0',
  apiVersion: '1.0.0',
  execute: async (ctx, a: number, b: number) => {
    console.log(`计算: ${a} + ${b}`);
    const result = await ctx.super(a, b); // 调用父实现
    console.log(`结果: ${result}`);
    return result;
  },
});
```

---

### execute()

执行指定扩展点下的主实现（优先级最高的实现）。

```typescript
kernel.execute(pointId: string, ...args: any[]): Promise<any>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `pointId` | `string` | 扩展点 ID |
| `...args` | `any[]` | 传递给执行函数的参数 |

**返回值**：`Promise<any>` — 执行结果

**抛出异常**：
- `KernelError`：当扩展点不存在或执行失败且降级策略为 `'throw'` 时
- 扩展自身抛出的错误

**示例**：

```typescript
const result = await kernel.execute('calculator.add', 10, 20);
console.log(result); // 30
```

---

### getState()

获取内核当前状态快照。

```typescript
kernel.getState(): KernelState
```

**返回值**：`KernelState`

```typescript
interface KernelState {
  version: string;
  strictMode: boolean;
  points: ExtensionPointMeta[];
  implementations: Record<string, Extension[]>;
  dependencyGraph: {
    nodes: string[];
    edges: Record<string, string[]>;
  };
}
```

**示例**：

```typescript
const state = kernel.getState();
console.log('已注册扩展点:', state.points);
console.log('依赖图:', state.dependencyGraph);
```

---

### destroy()

销毁内核实例，释放所有资源。

```typescript
kernel.destroy(): Promise<void>
```

**行为**：
1. 调用所有已注册扩展的 `destroy` 钩子
2. 清空注册表
3. 标记内核为已销毁

**示例**：

```typescript
await kernel.destroy();
```

---

## 核心类型

### Extension

扩展实现接口，泛型 `T` 为返回值类型。

```typescript
interface Extension<T = any> {
  /** 实现唯一标识 */
  id: string;
  
  /** 所属扩展点 ID */
  pointId: string;
  
  /** 扩展自身语义化版本 */
  version: string;
  
  /** 声明的 API 版本（内核据此路由） */
  apiVersion: string;
  
  /** 执行函数 */
  execute: (context: ExecutionContext, ...args: any[]) => T | Promise<T>;
  
  /** 继承自哪个父实现（形成继承链） */
  parentId?: string | null;
  
  /** 被哪个实现覆盖（由内核维护，外部只读） */
  overriddenBy?: string | null;
  
  /** 优先级（数字越小越先执行），默认 100 */
  priority?: number;
  
  /** 信任级别，默认 'user' */
  trustLevel?: 'system' | 'user' | 'untrusted';
  
  /** 所需权限（覆盖扩展点默认值） */
  permissions?: Permission[];
  
  /** 执行前钩子 */
  onBeforeExecute?: (context: ExecutionContext) => void | Promise<void>;
  
  /** 执行后钩子 */
  onAfterExecute?: (context: ExecutionContext, result: T) => void | Promise<void>;
  
  /** 错误钩子 */
  onError?: (context: ExecutionContext, error: Error) => void | Promise<void>;
  
  /** 断路器重置钩子 */
  onCircuitReset?: (context: ExecutionContext) => void | Promise<void>;
  
  /** 卸载清理钩子 */
  destroy?: () => void | Promise<void>;
  
  /** 健康检查函数 */
  healthCheck?: () => boolean | Promise<boolean>;
}
```

---

### ExecutionContext

执行上下文，每次执行由内核创建并注入。

```typescript
interface ExecutionContext {
  /** 全局链路追踪 ID */
  traceId: string;
  
  /** 当前执行的扩展 ID */
  extensionId: string;
  
  /** 当前执行的扩展点 ID */
  pointId: string;
  
  /** 原始参数快照 */
  args: any[];
  
  /** 开始执行的时间戳 */
  startTime: number;
  
  /** 自定义元数据（只读） */
  metadata: Record<string, unknown>;
  
  /** 带上下文的结构化日志器 */
  logger: Logger;
  
  /** 超时中断信号 */
  abortSignal?: AbortSignal;
  
  /** 共享存储 Draft 代理 */
  store: SharedStore;
  
  /** 灰度功能开关 */
  featureFlags?: Record<string, boolean>;
  
  /** 当前生效的 API 版本 */
  apiVersion: string;
  
  /** 超级调用（调用继承链中的父实现） */
  super: (...args: any[]) => Promise<any>;
}
```

---

### KernelConfig

内核配置接口。

```typescript
interface KernelConfig {
  /** 内核自身语义化版本 */
  version: string;
  
  /** 是否开启严格模式，默认 true */
  strictMode?: boolean;
  
  /** 最大调用深度，默认 50 */
  maxExecutionDepth?: number;
  
  /** 是否启用断路器，默认 true */
  enableCircuitBreaker?: boolean;
  
  /** 全局默认降级策略，默认 'throw' */
  defaultFallback?: FallbackPolicy;
  
  /** 执行超时时间（毫秒），默认 30000 */
  timeoutMs?: number;
  
  /** 是否开启调试日志，默认 false */
  debug?: boolean;
}
```

---

### ExtensionPointMeta

扩展点元数据，描述一个扩展点的约束。

```typescript
interface ExtensionPointMeta {
  /** 唯一标识 */
  id: string;
  
  /** 描述信息 */
  description?: string;
  
  /** 是否允许覆盖，默认 true */
  allowOverride?: boolean;
  
  /** 是否允许继承，默认 true */
  allowInherit?: boolean;
  
  /** 该扩展点的降级策略（覆盖全局策略） */
  fallbackPolicy?: FallbackPolicy;
  
  /** 执行所需权限列表 */
  permissions?: Permission[];
  
  /** 要求的 API 版本 */
  apiVersion?: string;
  
  /** 是否已弃用 */
  deprecated?: boolean;
  
  /** 弃用提示信息 */
  deprecationMessage?: string;
}
```

---

### FallbackPolicy

降级策略类型。

```typescript
type FallbackPolicy = 'throw' | 'null' | 'ignore' | 'last-success' | 'custom';
```

| 值 | 说明 |
|----|------|
| `'throw'` | 抛出异常（默认） |
| `'null'` | 返回 `null` |
| `'ignore'` | 返回 `undefined` |
| `'last-success'` | 返回最近一次成功的结果（缓存） |
| `'custom'` | 调用自定义降级处理器 |

---

### Permission

权限类型。

```typescript
type Permission = 
  | 'storage.read'
  | 'storage.write'
  | 'network'
  | 'file'
  | 'dom'
  | 'extension.call';
```

| 值 | 说明 |
|----|------|
| `'storage.read'` | 读取共享存储 |
| `'storage.write'` | 写入共享存储 |
| `'network'` | 网络请求 |
| `'file'` | 文件系统访问 |
| `'dom'` | DOM 操作 |
| `'extension.call'` | 调用其他扩展 |

---

## 版本管理

### VersionRouter

API 版本路由器，根据扩展的 `apiVersion` 路由到对应的适配器。

```typescript
class VersionRouter {
  constructor(kernelVersion: string);
  
  /** 注册一个版本适配器 */
  registerAdapter(apiVersion: string, adapter: VersionAdapter): void;
  
  /** 根据扩展的 apiVersion 查找对应的适配器 */
  route(extension: Extension): Extension | null;
  
  /** 获取所有已注册的 API 版本 */
  getSupportedVersions(): string[];
  
  /** 清除缓存 */
  clearCache(): void;
}
```

**示例**：

```typescript
const router = new VersionRouter('1.0.0');

// 注册适配器：将 v1 API 映射到 v2
router.registerAdapter('1.0.0', (ext) => {
  // 转换扩展以适应 v1 API
  return ext;
});

// 路由扩展
const adapted = router.route(extension);
```

---

### VersionLock

引擎锁，读取项目配置锁定版本组合。

```typescript
class VersionLock {
  /** 加载版本锁配置 */
  load(configPath?: string, config?: VersionLockConfig): void;
  
  /** 校验内核版本 */
  validateKernel(kernelVersion: string): VersionLockResult;
  
  /** 校验服务层版本 */
  validateService(serviceVersion: string): VersionLockResult;
  
  /** 获取当前锁定配置 */
  getConfig(): VersionLockConfig | null;
  
  /** 检查内核是否被锁定 */
  isKernelLocked(): boolean;
  
  /** 获取锁定的内核版本 */
  getLockedKernelVersion(): string | null;
}
```

---

### SemVer 工具函数

语义化版本比对工具。

```typescript
/** 解析版本字符串为 SemVer 对象 */
function parseSemVer(version: string): SemVer | null;

/** 比较两个版本号 */
function compareSemVer(a: SemVer, b: SemVer): number;

/** 比较两个版本字符串 */
function compareVersions(a: string, b: string): number;

/** 检查版本是否满足版本范围 */
function satisfiesRange(version: string, range: string): boolean;
```

**示例**：

```typescript
import { compareVersions, satisfiesRange } from '@devtools/micro-kernel';

compareVersions('1.2.3', '1.2.4'); // -1
satisfiesRange('2.0.0', '>=1.0.0'); // true
```

---

## 执行引擎

### Executor

执行引擎核心，协调上下文工厂和断路器。

```typescript
class Executor {
  constructor(options?: ExecutorOptions);
  
  /** 执行扩展 */
  execute(
    extension: Extension,
    pointId: string,
    args: any[],
    fallbackPolicy?: FallbackPolicy,
    featureFlags?: Record<string, boolean>
  ): Promise<any>;
  
  /** 获取断路器状态 */
  getCircuitBreakerState(): string;
  
  /** 重置断路器 */
  resetCircuitBreaker(): void;
  
  /** 获取调用栈快照 */
  getCallStackSnapshot(): CallFrame[];
  
  /** 清空调用栈 */
  clearCallStack(): void;
}
```

---

### ContextFactory

执行上下文工厂。

```typescript
class ContextFactory {
  constructor(maxDepth?: number);
  
  /** 创建执行上下文 */
  create(
    extension: Extension,
    pointId: string,
    args: any[],
    traceId: string,
    featureFlags?: Record<string, boolean>
  ): ExecutionContext;
  
  /** 清理调用栈 */
  cleanup(): void;
  
  /** 获取调用栈快照 */
  getCallStackSnapshot(): CallFrame[];
  
  /** 清空调用栈 */
  clearStack(): void;
}
```

---

### DraftManager

写时复制管理器。

```typescript
class DraftManager {
  /** 进入 Draft 模式 */
  beginDraft(baseData: Record<string, any>): void;
  
  /** 在 Draft 模式下设置值 */
  set(path: string, value: any): void;
  
  /** 在 Draft 模式下获取值 */
  get(path: string): any;
  
  /** 提交所有变更 */
  commit(): Record<string, any>;
  
  /** 丢弃所有变更 */
  discard(): void;
  
  /** 是否有未提交的变更 */
  hasChanges(): boolean;
  
  /** 是否处于 Draft 模式 */
  isActive(): boolean;
  
  /** 获取当前所有变更（用于调试） */
  getChanges(): DraftChange[];
}
```

---

### SuperCallStack

异步调用栈管理器。

```typescript
class SuperCallStack {
  constructor(maxDepth?: number);
  
  /** 压入调用帧 */
  push(frame: Omit<CallFrame, 'depth'>): CallFrame;
  
  /** 弹出调用帧 */
  pop(): CallFrame | undefined;
  
  /** 获取当前调用帧 */
  current(): CallFrame | undefined;
  
  /** 获取父实现 ID */
  getParentId(): string | null;
  
  /** 检查是否在指定扩展的调用上下文中 */
  isInContext(extensionId: string): boolean;
  
  /** 获取当前调用深度 */
  depth(): number;
  
  /** 清空调用栈 */
  clear(): void;
  
  /** 获取调用栈快照 */
  snapshot(): CallFrame[];
  
  /** 检查是否存在循环调用 */
  hasCycle(extensionId: string): boolean;
}
```

---

## 降级与容错

### CircuitBreaker

断路器状态机。

```typescript
class CircuitBreaker {
  constructor(config?: CircuitBreakerConfig);
  
  /** 检查是否允许执行 */
  allowExecution(): boolean;
  
  /** 记录执行成功 */
  onSuccess(): void;
  
  /** 记录执行失败 */
  onFailure(): void;
  
  /** 获取当前状态 */
  getState(): CircuitState;
  
  /** 获取状态描述 */
  getStateDescription(): string;
  
  /** 手动重置断路器 */
  reset(): void;
  
  /** 强制打开断路器 */
  forceOpen(): void;
  
  /** 强制关闭断路器 */
  forceClose(): void;
}
```

**状态流转**：

```
CLOSED（关闭）—— 正常执行
  └── 连续失败 ≥ 阈值 → OPEN（打开）
OPEN（打开）—— 拒绝执行
  └── 超时后 → HALF_OPEN（半开）
HALF_OPEN（半开）—— 试探执行
  ├── 成功 → CLOSED（恢复）
  └── 失败 → OPEN（再次打开）
```

---

### FallbackExecutor

降级链执行器。

```typescript
class FallbackExecutor {
  constructor(options?: FallbackExecutorOptions);
  
  /** 注册自定义降级处理器 */
  setCustomHandler(handler: CustomFallbackHandler): void;
  
  /** 清除自定义降级处理器 */
  clearCustomHandler(): void;
  
  /** 执行降级链 */
  executeFallback(
    extension: Extension,
    pointId: string,
    error: Error,
    registry: {
      getImplementations: (pointId: string) => Extension[];
      getPointMeta: (pointId: string) => any;
    },
    context?: ExecutionContext,
    circuitBreaker?: CircuitBreaker,
    policy?: FallbackPolicy
  ): Promise<FallbackResult>;
  
  /** 清除缓存 */
  clearCache(extensionId?: string): void;
  
  /** 获取缓存统计信息 */
  getCacheStats(): { size: number; maxSize: number; enabled: boolean };
}
```

---

## 存储层

### SharedStore

命名空间键值存储，支持变更监听。

```typescript
class SharedStore {
  constructor(options?: SharedStoreOptions);
  
  /** 设置值 */
  set(path: string, value: any, silent?: boolean): void;
  
  /** 获取值 */
  get<T = any>(path: string): T | undefined;
  
  /** 删除值 */
  delete(path: string, silent?: boolean): boolean;
  
  /** 检查路径是否存在 */
  has(path: string): boolean;
  
  /** 获取指定命名空间下的所有键值对 */
  getNamespace(namespace: string): Record<string, any>;
  
  /** 注册变更监听器 */
  onChange(path: string, listener: StoreChangeListener): () => void;
  
  /** 获取当前存储的快照 */
  snapshot(): Record<string, any>;
  
  /** 从快照恢复数据 */
  restore(snapshot: Record<string, any>, silent?: boolean): void;
  
  /** 清空所有数据 */
  clear(silent?: boolean): void;
  
  /** 获取存储大小 */
  size(): number;
  
  /** 获取所有路径 */
  keys(): string[];
}
```

---

### OwnershipTracker

资源所有权追踪器，支持引用计数和自动回收。

```typescript
class OwnershipTracker {
  constructor(options?: OwnershipTrackerOptions);
  
  /** 注册资源 */
  register(id: string, data: any, owner: string): ResourceInfo;
  
  /** 释放资源 */
  release(id: string, owner: string): boolean;
  
  /** 获取资源 */
  get(id: string): any | undefined;
  
  /** 检查资源是否存在 */
  has(id: string): boolean;
  
  /** 获取资源信息 */
  getInfo(id: string): Omit<ResourceInfo, 'data'> | undefined;
  
  /** 获取指定所有者的所有资源 ID */
  getResourcesByOwner(owner: string): string[];
  
  /** 获取所有资源的快照 */
  snapshot(): { total: number; resources: Array<Omit<ResourceInfo, 'data'>> };
  
  /** 回收空闲资源 */
  recycleIdleResources(force?: boolean): number;
  
  /** 清空所有资源 */
  clear(): void;
  
  /** 获取资源总数 */
  size(): number;
}
```

---

## 可观测性

### Logger

结构化日志器。

```typescript
class Logger {
  constructor(options?: LoggerOptions);
  
  /** 设置日志级别 */
  setLevel(level: LogLevel): void;
  
  /** 添加日志传输方式 */
  addTransport(transport: LogTransport): void;
  
  /** 移除日志传输方式 */
  removeTransport(transport: LogTransport): void;
  
  /** DEBUG 级别日志 */
  debug(message: string, data?: Record<string, unknown>, traceId?: string): void;
  
  /** INFO 级别日志 */
  info(message: string, data?: Record<string, unknown>, traceId?: string): void;
  
  /** WARN 级别日志 */
  warn(message: string, data?: Record<string, unknown>, traceId?: string): void;
  
  /** ERROR 级别日志 */
  error(message: string, data?: Record<string, unknown>, traceId?: string): void;
  
  /** 获取内存中的日志 */
  getMemoryLogs(level?: LogLevel): LogEntry[];
  
  /** 清空内存日志 */
  clearMemoryLogs(): void;
  
  /** 创建子日志器 */
  child(traceId: string): Logger;
}
```

---

### Tracer

链路追踪器。

```typescript
class Tracer {
  constructor(options?: TracerOptions);
  
  /** 开始一个 Span */
  startSpan(name: string, parentId?: string, tags?: Record<string, string>): string;
  
  /** 结束一个 Span */
  endSpan(spanId: string, data?: Record<string, unknown>): void;
  
  /** 添加标签到 Span */
  addTag(spanId: string, key: string, value: string): void;
  
  /** 添加数据到 Span */
  addData(spanId: string, key: string, value: unknown): void;
  
  /** 获取所有已完成 Span */
  getSpans(): Span[];
  
  /** 获取活跃的 Span */
  getActiveSpans(): Span[];
  
  /** 获取完整链路 */
  getTrace(rootSpanId: string): Span[];
  
  /** 导出为 JSON */
  exportJSON(): string;
  
  /** 清空所有 Span */
  clear(): void;
  
  /** 启用/禁用追踪 */
  setEnabled(enabled: boolean): void;
}
```

---

### MetricsCollector

指标收集器。

```typescript
class MetricsCollector {
  /** 增加计数器 */
  incrementCounter(name: string, value?: number, labels?: Record<string, string>): void;
  
  /** 获取计数器值 */
  getCounter(name: string, labels?: Record<string, string>): number;
  
  /** 记录计时器 */
  recordTimer(name: string, ms: number, labels?: Record<string, string>): void;
  
  /** 获取计时器统计数据 */
  getTimer(name: string, labels?: Record<string, string>): TimerData | null;
  
  /** 记录直方图值 */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
  
  /** 获取直方图数据 */
  getHistogram(name: string, labels?: Record<string, string>): HistogramData | null;
  
  /** 获取所有指标的快照 */
  snapshot(): MetricsSnapshot;
  
  /** 清空所有指标 */
  clear(): void;
}
```

---

## 安全模块

### PermissionManager

权限管理器。

```typescript
class PermissionManager {
  constructor(options?: PermissionManagerOptions);
  
  /** 添加权限规则 */
  addRule(rule: PermissionRule): void;
  
  /** 添加多条权限规则 */
  addRules(rules: PermissionRule[]): void;
  
  /** 移除权限规则 */
  removeRule(permission: string, target?: string): void;
  
  /** 清空所有规则 */
  clearRules(): void;
  
  /** 校验权限 */
  checkPermissions(
    extensionId: string,
    pointId: string,
    requiredPermissions: Permission[],
    grantedPermissions: Permission[]
  ): PermissionCheckResult;
  
  /** 校验并抛出异常 */
  checkAndThrow(
    extensionId: string,
    pointId: string,
    requiredPermissions: Permission[],
    grantedPermissions: Permission[]
  ): void;
  
  /** 启用/禁用权限检查 */
  setEnabled(enabled: boolean): void;
  
  /** 获取所有规则 */
  getRules(): PermissionRule[];
  
  /** 获取当前策略快照 */
  snapshot(): { enabled: boolean; defaultPolicy: PermissionPolicy; rules: PermissionRule[] };
}
```

---

### SandboxProxy

沙箱代理，提供逻辑级安全隔离。

```typescript
class SandboxProxy {
  constructor(config?: SandboxConfig, logger?: Logger);
  
  /** 为对象创建沙箱代理 */
  create<T extends object>(target: T, operationPrefix?: string): T;
  
  /** 获取沙箱指标 */
  getMetrics(): SandboxMetrics;
  
  /** 重置沙箱指标 */
  resetMetrics(): void;
  
  /** 获取沙箱配置 */
  getConfig(): Readonly<Required<SandboxConfig>>;
  
  /** 是否启用沙箱 */
  isEnabled(): boolean;
  
  /** 启用/禁用沙箱 */
  setEnabled(enabled: boolean): void;
  
  /** 创建空沙箱 */
  static createEmptySandbox(): Record<string, never>;
}
```

---

## 错误类型

所有错误继承自 `KernelError` 基类。

| 错误类 | 说明 | 触发场景 |
|--------|------|----------|
| `KernelError` | 内核错误基类 | 所有内核相关错误的基类 |
| `ExtensionError` | 扩展执行错误 | 扩展执行过程中发生错误 |
| `TimeoutError` | 执行超时错误 | 执行超时（超过 `timeoutMs`） |
| `PermissionError` | 权限不足错误 | 权限校验失败 |
| `RecursionError` | 递归深度超限错误 | 调用深度超过 `maxExecutionDepth` |
| `VersionMismatchError` | 版本不匹配错误 | `apiVersion` 与内核不兼容 |
| `CircuitOpenError` | 断路器打开错误 | 断路器处于打开状态，拒绝执行 |
| `CircularDependencyError` | 循环依赖错误 | 注册时检测到循环依赖 |

**示例**：

```typescript
try {
  await kernel.execute('nonexistent.point');
} catch (err) {
  if (err instanceof KernelError) {
    console.error(`内核错误 [${err.code}]: ${err.message}`);
  }
}
```

---

## 类型索引

### 导出类型汇总

| 类型名称 | 来源文件 | 说明 |
|----------|----------|------|
| `Kernel` | `core/Kernel.ts` | 内核主类 |
| `KernelState` | `core/Kernel.ts` | 内核状态快照 |
| `Extension` | `types/extension.types.ts` | 扩展接口 |
| `ExecutionContext` | `types/extension.types.ts` | 执行上下文 |
| `Logger` | `types/extension.types.ts` | 日志器接口 |
| `SharedStore` | `types/extension.types.ts` | 共享存储接口 |
| `KernelConfig` | `types/kernel.types.ts` | 内核配置 |
| `ExtensionPointMeta` | `types/kernel.types.ts` | 扩展点元数据 |
| `FallbackPolicy` | `types/kernel.types.ts` | 降级策略 |
| `Permission` | `types/kernel.types.ts` | 权限类型 |
| `KernelError` | `types/errors.types.ts` | 错误基类 |
| `ExtensionError` | `types/errors.types.ts` | 扩展错误 |
| `TimeoutError` | `types/errors.types.ts` | 超时错误 |
| `PermissionError` | `types/errors.types.ts` | 权限错误 |
| `RecursionError` | `types/errors.types.ts` | 递归错误 |
| `VersionMismatchError` | `types/errors.types.ts` | 版本不匹配 |
| `CircuitOpenError` | `types/errors.types.ts` | 断路器打开 |
| `CircularDependencyError` | `types/errors.types.ts` | 循环依赖 |
| `VersionRouter` | `version/VersionRouter.ts` | 版本路由器 |
| `VersionLock` | `version/VersionLock.ts` | 引擎锁 |
| `Executor` | `execution/Executor.ts` | 执行引擎 |
| `CircuitBreaker` | `fallback/CircuitBreaker.ts` | 断路器 |
| `FallbackExecutor` | `fallback/FallbackExecutor.ts` | 降级执行器 |
| `SharedStore` | `store/SharedStore.ts` | 共享存储 |
| `OwnershipTracker` | `store/OwnershipTracker.ts` | 所有权追踪 |
| `Logger` | `observable/Logger.ts` | 结构化日志 |
| `Tracer` | `observable/Tracer.ts` | 链路追踪 |
| `MetricsCollector` | `observable/MetricsCollector.ts` | 指标收集 |
| `PermissionManager` | `security/PermissionManager.ts` | 权限管理 |
| `SandboxProxy` | `security/SandboxProxy.ts` | 沙箱代理 |

---

## 相关链接

- [README.md](./README.md) — 项目概述和快速开始
- [CHANGELOG.md](./CHANGELOG.md) — 版本变更记录
- [LICENSE](./LICENSE) — MIT 许可证
```

---