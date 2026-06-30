# Changelog

所有显著的项目变更将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-06-30

### 🎉 首次发布

Micro-Kernel Core v1.0.0 正式发布！这是一个**零依赖、高可用、可版本隔离的通用微内核架构**，专为需要插件系统的 JavaScript/TypeScript 项目设计。

---

### ✨ 新增特性

#### 核心层 (Core)

| 模块 | 说明 |
|------|------|
| **Kernel** | 微内核门面类，对外提供 `add`、`override`、`inherit`、`execute`、`getState`、`destroy` 等核心 API |
| **ExtensionRegistry** | 扩展注册表，管理扩展点（`ExtensionPointMeta`）和扩展实现（`Extension`） |
| **DependencyGraph** | 基于 DFS 三色标记法的循环依赖检测器，支持全图检测和指定节点检测 |

#### 执行引擎 (Execution)

| 模块 | 说明 |
|------|------|
| **Executor** | 执行引擎核心，协调权限校验、断路器检查、扩展执行、降级链处理 |
| **ContextFactory** | 执行上下文工厂，构建 `ExecutionContext` 并注入 `super` 代理 |
| **DraftManager** | 写时复制（Copy-on-Write）管理器，支持 `Commit` 和 `Discard` |
| **SuperCallStack** | 异步调用栈管理器，确保 `super` 调用指向正确的父实现，防止无限递归 |

#### 降级与容错 (Fallback)

| 模块 | 说明 |
|------|------|
| **CircuitBreaker** | 断路器状态机（CLOSED → OPEN → HALF_OPEN → CLOSED），连续失败自动熔断 |
| **FallbackExecutor** | 降级链执行器，沿继承链向上查找父实现，支持 `null`、`ignore`、`last-success`、`custom` 策略 |

#### 版本管理 (Version)

| 模块 | 说明 |
|------|------|
| **VersionRouter** | API 版本路由器，根据 `apiVersion` 路由到对应适配器，支持版本范围匹配 |
| **VersionLock** | 引擎锁，通过 `micro-kernel.config.json` 锁定版本组合，升级安全可控 |
| **SemVer** | 语义化版本比对工具，支持 `parseSemVer`、`compareVersions`、`satisfiesRange` |

#### 存储层 (Store)

| 模块 | 说明 |
|------|------|
| **SharedStore** | 命名空间键值存储，支持变更监听（`onChange`）、快照和恢复 |
| **OwnershipTracker** | 资源所有权追踪器，支持引用计数和自动回收空闲资源 |

#### 可观测性 (Observability)

| 模块 | 说明 |
|------|------|
| **Logger** | 结构化日志器，支持分级输出（DEBUG/INFO/WARN/ERROR）、自定义传输和内存缓存 |
| **Tracer** | 链路追踪器，支持 Span 父子关系、标签和 JSON 导出 |
| **MetricsCollector** | 指标收集器，支持计数器（Counter）、计时器（Timer）、直方图（Histogram）和百分位数 |

#### 安全模块 (Security)

| 模块 | 说明 |
|------|------|
| **PermissionManager** | 权限管理器，支持通配符匹配（`storage.*`）、规则优先级和权限校验 |
| **SandboxProxy** | 沙箱代理，提供逻辑级安全隔离，预留物理隔离（iframe/Worker）接入点 |

#### 类型定义 (Types)

| 模块 | 说明 |
|------|------|
| **kernel.types.ts** | 内核配置（`KernelConfig`）、扩展点元数据（`ExtensionPointMeta`）、降级策略（`FallbackPolicy`）、权限（`Permission`） |
| **extension.types.ts** | 扩展接口（`Extension`）、执行上下文（`ExecutionContext`）、日志器（`Logger`）、共享存储（`SharedStore`） |
| **errors.types.ts** | 错误类型层级：`KernelError` → `ExtensionError` → `TimeoutError`/`PermissionError`/`RecursionError`/`CircuitOpenError`/`VersionMismatchError`/`CircularDependencyError` |

---

### 🔧 已修复问题

| 问题 | 修复说明 |
|------|----------|
| 降级链返回 `null` 而非父实现结果 | `FallbackExecutor` 在 `null` 和 `ignore` 策略中优先尝试父实现降级 |
| 权限校验未生效 | `Kernel` 在 `add`、`override`、`inherit` 中增加 `checkPermissions` 校验 |
| `Kernel.getState()` 依赖图数据为空 | `ExtensionRegistry` 新增 `getDependencyGraphSnapshot()` 方法 |
| 构建时未使用变量警告 | 清理了 `Kernel.ts`、`Executor.ts` 等文件中的未使用导入 |

---

### 🧪 测试

| 测试文件 | 测试数量 | 覆盖模块 |
|----------|----------|----------|
| `DependencyGraph.test.ts` | 18 | 节点管理、边管理、环检测、辅助方法 |
| `CircuitBreaker.test.ts` | 12 | 状态流转、手动控制、状态描述、成功恢复 |
| `SuperCallStack.test.ts` | 10 | 压入/弹出帧、当前帧、父 ID、循环检测、深度限制 |

**测试结果**：40 个测试用例全部通过 ✅

---

### 📦 工程化

| 项目 | 说明 |
|------|------|
| **零生产依赖** | `dependencies` 为空，仅包含开发工具 |
| **双格式构建** | ESM（`dist/index.mjs`）+ CJS（`dist/index.cjs`） |
| **TypeScript 严格模式** | `strict: true`，完整类型定义 |
| **Rollup 打包** | 支持 Tree Shaking（`sideEffects: false`） |
| **Vitest 测试** | 单元测试 + 覆盖率报告 |
| **类型声明** | 完整 `.d.ts` 文件导出 |

---

### 📚 文档

| 文档 | 说明 |
|------|------|
| **README.md** | 项目概述、快速开始、架构设计、API 示例 |
| **API.md** | 完整 API 参考文档（Kernel、Extension、ExecutionContext、各模块） |
| **CHANGELOG.md** | 版本变更记录（本文档） |
| **集成示例** | `examples/integrated-demo/` 包含 5 个功能演示 |

---

### 🔜 后续计划

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 高 | 集成到 `block-editor` | 创建适配器层，替换旧版 `EditorBus` |
| 高 | 发布到 npm | `npm publish --access public` |
| 中 | 热加载支持 | 运行时动态加载/卸载扩展 |
| 中 | 扩展优先级动态调整 | 支持运行时修改优先级 |
| 低 | 事件总线集成 | 扩展间事件通信 |

---