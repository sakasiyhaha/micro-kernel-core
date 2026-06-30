// src/index.ts

// ========== 核心层导出 ==========
export { Kernel } from './core/Kernel.js';
export type { KernelState } from './core/Kernel.js';
export { ExtensionRegistry } from './core/ExtensionRegistry.js';
export { DependencyGraph } from './core/DependencyGraph.js';

// ========== 执行引擎导出 ==========
export { Executor } from './execution/Executor.js';
export type { ExecutorOptions } from './execution/Executor.js';
export { ContextFactory } from './execution/ContextFactory.js';
export { SuperCallStack } from './execution/SuperCallStack.js';
export type { CallFrame } from './execution/SuperCallStack.js';
export { DraftManager } from './execution/DraftManager.js';
export type { DraftChange } from './execution/DraftManager.js';

// ========== 断路器导出 ==========
export { CircuitBreaker } from './fallback/CircuitBreaker.js';
export type { CircuitBreakerConfig, CircuitState } from './fallback/CircuitBreaker.js';

export { FallbackExecutor, createFallbackExecutor } from './fallback/FallbackExecutor.js';
export type { CustomFallbackHandler, FallbackExecutorOptions, FallbackResult } from './fallback/FallbackExecutor.js';
// ========== 版本管理层导出 ==========
export { VersionRouter } from './version/VersionRouter.js';
export type { VersionAdapter } from './version/VersionRouter.js';
export { VersionLock } from './version/VersionLock.js';
export type { VersionLockConfig, VersionLockResult } from './version/VersionLock.js';
export {
  parseSemVer,
  compareSemVer,
  compareVersions,
  satisfiesRange,
} from './version/SemVer.js';

// ========== 存储层导出 ==========
export { SharedStore } from './store/SharedStore.js';
export type { StoreChangeListener, SharedStoreOptions } from './store/SharedStore.js';
export { OwnershipTracker } from './store/OwnershipTracker.js';
export type { ResourceInfo, OwnershipTrackerOptions } from './store/OwnershipTracker.js';

// ========== 可观测性导出 ==========
export { Logger } from './observable/Logger.js';
export type { LogLevel, LogEntry, LogTransport, LoggerOptions } from './observable/Logger.js';
export { Tracer } from './observable/Tracer.js';
export type { Span, TracerOptions } from './observable/Tracer.js';
export { MetricsCollector } from './observable/MetricsCollector.js';
export type {
  Counter,
  TimerData,
  HistogramData,
  MetricsSnapshot,
} from './observable/MetricsCollector.js';

// ========== 安全模块导出 ==========
export { PermissionManager } from './security/PermissionManager.js';
export type {
  PermissionRule,
  PermissionPolicy,
  PermissionCheckResult,
  PermissionManagerOptions,
} from './security/PermissionManager.js';
export { SandboxProxy } from './security/SandboxProxy.js';
export type { SandboxConfig, SandboxMetrics } from './security/SandboxProxy.js';

// 预定义权限
export { Permissions, PermissionSets } from './security/PermissionManager.js';

// ========== 类型导出 ==========
export type {
  FallbackPolicy,
  Permission,
  KernelConfig,
  ExtensionPointMeta,
  ExtensionPointState,
  Logger as ILogger,
  SharedStore as ISharedStore,
  ExecutionContext,
  Extension,
  ExecutionResult,
  KernelError,
  ExtensionError,
  TimeoutError,
  PermissionError,
  RecursionError,
  VersionMismatchError,
  CircuitOpenError,
  CircularDependencyError,
} from './types/index.js';