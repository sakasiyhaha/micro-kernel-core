# Micro-Kernel Core

> 零依赖、高可用、可版本隔离的通用微内核架构

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)](package.json)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-6B9F3B.svg)](https://vitest.dev/)

---

## 📦 概述

**Micro-Kernel Core** 是一个纯 TypeScript 编写的通用扩展框架（Extension Framework），专为需要**插件系统**的 JavaScript/TypeScript 项目设计。它管理扩展点（Extension Points）的全生命周期：注册、解析、执行、降级、卸载。

### 核心理念

> **内核只做三件事：注册、查找、执行。**

- **零依赖**：可在浏览器（ESM）和 Node.js（CommonJS / ESM）中运行
- **版本隔离**：内核升级不影响存量扩展，项目自主控制升级节奏
- **防御式编程**：任何扩展的异常都不应导致内核崩溃
- **类型安全**：完整的 TypeScript 类型定义，IDE 智能提示无缝集成

---

## 🎯 适用场景

| 场景 | 说明 |
|------|------|
| **积木编辑器** | 积木模板注册、自定义积木扩展 |
| **IDE / 编辑器插件系统** | 菜单项、工具栏按钮、侧边栏组件扩展 |
| **工作流引擎** | 节点类型注册、自定义节点行为 |
| **低代码平台** | 组件库扩展、业务逻辑插件 |
| **微服务网关** | 过滤器、路由策略、中间件扩展 |
| **任何需要插件化架构的应用** | 解耦核心与扩展，实现热插拔 |

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| **🔄 可添加 (Add)** | 向内核注册扩展点或扩展实现，动态扩展系统功能 |
| **🔀 可覆盖 (Override)** | 用新实现替换已有实现，支持覆盖链 |
| **🌳 可继承 (Inherit)** | 基于现有实现创建派生实现，支持 `super` 调用 |
| **🛡️ 可防御降级 (Fallback)** | 扩展失败时自动降级，保证系统不崩溃 |
| **⏱️ 断路器 (Circuit Breaker)** | 连续失败自动熔断，防止故障扩散 |
| **📦 版本隔离 (Version Isolation)** | API 版本独立演化，多版本共存 |
| **🔒 引擎锁 (Version Lock)** | 项目配置锁定版本组合，升级安全可控 |
| **📝 不可变数据流 (Draft)** | 写时复制，执行成功提交，失败自动回滚 |
| **🔐 权限管理 (Permission)** | 细粒度权限控制，支持通配符匹配 |
| **📊 可观测性 (Observability)** | 结构化日志、链路追踪、指标收集 |
| **🏷️ 资源所有权追踪 (Ownership)** | 引用计数管理，自动回收资源 |

---

## 🏗️ 架构设计

### 三层架构模型

```
┌─────────────────────────────────────────────────────────────────┐
│                      应用层（Application）                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  积木编辑器  │  IDE插件  │  低代码平台  │  其他项目    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ 依赖
┌─────────────────────────────────────────────────────────────────┐
│                      二级 Mod（应用扩展）                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • 仅依赖服务层 API（不直接依赖内核）                   │   │
│  │  • 声明 apiVersion，由内核自动路由                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ 依赖稳定服务层 API
┌─────────────────────────────────────────────────────────────────┐
│                      服务层（Service Layer）                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  一级 Mod（Facade 门面）                               │   │
│  │  • 提供稳定的业务 API（如 registerBlockTemplates）     │   │
│  │  • API 版本独立于内核版本演化                          │   │
│  │  • 变更频率 < 2 次/年                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ 使用内核 API
┌─────────────────────────────────────────────────────────────────┐
│                      微内核核心（Micro-Kernel Core）            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Kernel（极简、稳定、极少变更）                        │   │
│  │  • 扩展点注册表（Extension Registry）                   │   │
│  │  • 执行引擎（Execution Engine）                         │   │
│  │  • API 版本路由器（Version Router）                     │   │
│  │  • 断路器与降级（Circuit Breaker & Fallback）          │   │
│  │  • 安全与权限（Security & Permissions）                 │   │
│  │  • 可观测性（Observability）                            │   │
│  │  • 变更频率 < 1 次/年                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 模块结构

```
micro-kernel-core/
├── src/
│   ├── core/                      # 核心层
│   │   ├── Kernel.ts              # 门面类，对外 API
│   │   ├── ExtensionRegistry.ts   # 扩展注册表
│   │   └── DependencyGraph.ts     # 循环依赖检测
│   ├── execution/                 # 执行引擎
│   │   ├── Executor.ts            # 执行引擎核心
│   │   ├── ContextFactory.ts      # 执行上下文工厂
│   │   ├── DraftManager.ts        # 写时复制管理
│   │   └── SuperCallStack.ts      # 异步调用栈
│   ├── fallback/                  # 降级与容错
│   │   ├── CircuitBreaker.ts      # 断路器状态机
│   │   └── FallbackExecutor.ts    # 降级链执行器
│   ├── version/                   # 版本管理
│   │   ├── VersionRouter.ts       # API 版本路由
│   │   ├── VersionLock.ts         # 引擎锁
│   │   └── SemVer.ts              # 语义化版本工具
│   ├── store/                     # 存储层
│   │   ├── SharedStore.ts         # 命名空间键值存储
│   │   └── OwnershipTracker.ts    # 资源所有权追踪
│   ├── observable/                # 可观测性
│   │   ├── Logger.ts              # 结构化日志
│   │   ├── Tracer.ts              # 链路追踪
│   │   └── MetricsCollector.ts    # 指标收集
│   ├── security/                  # 安全模块
│   │   ├── PermissionManager.ts   # 权限管理
│   │   └── SandboxProxy.ts        # 沙箱代理
│   └── types/                     # 类型定义
│       ├── kernel.types.ts
│       ├── extension.types.ts
│       └── errors.types.ts
└── tests/                         # 测试
    ├── unit/
    └── integration/
```

---

## 🚀 快速开始

### 安装

```bash
npm install @devtools/micro-kernel
```

或者使用本地路径：

```bash
npm install file:../micro-kernel-core
```

### 基础用法

```typescript
import { Kernel } from '@devtools/micro-kernel';

// 1. 创建内核实例
const kernel = new Kernel({
  version: '1.0.0',
  strictMode: true,
  debug: true,
});

// 2. 定义扩展点
kernel.add('calculator.add', {
  id: 'add-impl',
  pointId: 'calculator.add',
  version: '1.0.0',
  apiVersion: '1.0.0',
  execute: async (ctx, a: number, b: number) => a + b,
});

kernel.add('calculator.subtract', {
  id: 'subtract-impl',
  pointId: 'calculator.subtract',
  version: '1.0.0',
  apiVersion: '1.0.0',
  execute: async (ctx, a: number, b: number) => a - b,
});

// 3. 执行扩展
const sum = await kernel.execute('calculator.add', 10, 20);
console.log(sum); // 30

const diff = await kernel.execute('calculator.subtract', 20, 5);
console.log(diff); // 15
```

### 继承与覆盖

```typescript
// 父实现：基础加法
kernel.add('calculator.add', {
  id: 'base-add',
  pointId: 'calculator.add',
  version: '1.0.0',
  apiVersion: '1.0.0',
  execute: async (ctx, a: number, b: number) => a + b,
});

// 子实现：继承父实现，增加日志
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

// 覆盖：用新实现替换
kernel.override('calculator.add', 'base-add', {
  id: 'premium-add',
  pointId: 'calculator.add',
  version: '2.0.0',
  apiVersion: '1.0.0',
  execute: async (ctx, a: number, b: number) => {
    // 增强版加法（支持大数）
    return a + b;
  },
});
```

---

## 🔧 API 文档

### Kernel 类

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `add(pointId, extension)` | `pointId: string`, `extension: Extension` | `void` | 注册扩展实现 |
| `override(pointId, targetId, newImpl)` | `pointId: string`, `targetId: string`, `newImpl: Extension` | `void` | 覆盖已有实现 |
| `inherit(pointId, parentId, childImpl)` | `pointId: string`, `parentId: string`, `childImpl: Extension` | `void` | 继承已有实现 |
| `execute(pointId, ...args)` | `pointId: string`, `...args: any[]` | `Promise<any>` | 执行扩展 |
| `getState()` | 无 | `KernelState` | 获取内核状态快照 |
| `destroy()` | 无 | `Promise<void>` | 销毁内核 |

### Extension 接口

```typescript
interface Extension<T = any> {
  id: string;                    // 唯一标识
  pointId: string;               // 所属扩展点
  version: string;               // 扩展版本
  apiVersion: string;            // API 版本（内核据此路由）
  execute: (ctx: ExecutionContext, ...args: any[]) => T | Promise<T>;
  parentId?: string | null;      // 父实现 ID（继承链）
  priority?: number;             // 优先级（数字越小越先执行，默认 100）
  permissions?: Permission[];    // 所需权限
  onBeforeExecute?: (ctx: ExecutionContext) => void | Promise<void>;
  onAfterExecute?: (ctx: ExecutionContext, result: T) => void | Promise<void>;
  onError?: (ctx: ExecutionContext, error: Error) => void | Promise<void>;
  onCircuitReset?: (ctx: ExecutionContext) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
  healthCheck?: () => boolean | Promise<boolean>;
}
```

### ExecutionContext 接口

```typescript
interface ExecutionContext {
  traceId: string;               // 链路追踪 ID
  extensionId: string;           // 当前扩展 ID
  pointId: string;               // 当前扩展点 ID
  args: any[];                   // 原始参数
  startTime: number;             // 开始时间戳
  metadata: Record<string, unknown>;
  logger: Logger;                // 结构化日志器
  store: SharedStore;            // 共享存储（Draft 模式）
  apiVersion: string;            // 当前 API 版本
  super: (...args: any[]) => Promise<any>; // 调用父实现
  featureFlags?: Record<string, boolean>;
  abortSignal?: AbortSignal;
}
```

---

## 🛡️ 降级策略

| 策略 | 说明 |
|------|------|
| `throw` | 抛出异常（默认） |
| `null` | 返回 `null` |
| `ignore` | 返回 `undefined` |
| `last-success` | 返回上次成功的结果（缓存） |
| `custom` | 调用自定义降级处理器 |

**示例**：

```typescript
const kernel = new Kernel({
  version: '1.0.0',
  defaultFallback: 'null', // 全局降级策略
});

// 扩展点可单独配置降级策略
kernel.add('my.point', {
  id: 'impl',
  pointId: 'my.point',
  version: '1.0.0',
  apiVersion: '1.0.0',
  execute: async () => { throw new Error('失败'); },
});

// 执行失败时返回 null（而非抛出异常）
const result = await kernel.execute('my.point');
console.log(result); // null
```

---

## 🔐 版本隔离与引擎锁

### 声明 API 版本

每个扩展必须声明 `apiVersion`，内核根据此版本路由到对应的适配器：

```typescript
kernel.add('my.point', {
  id: 'impl-v2',
  pointId: 'my.point',
  version: '1.0.0',
  apiVersion: '2.0.0', // 声明使用的 API 版本
  execute: async () => { /* ... */ },
});
```

### 配置引擎锁

创建 `micro-kernel.config.json`（项目根目录）：

```json
{
  "kernel": {
    "version": "1.0.0",
    "locked": true,
    "minVersion": "1.0.0",
    "maxVersion": "1.2.0"
  },
  "services": {
    "version": "2.0.0",
    "locked": true
  }
}
```

---

## 🔬 可观测性

### 日志（Logger）

```typescript
import { Logger } from '@devtools/micro-kernel';

const logger = new Logger({ minLevel: 'DEBUG' });

logger.info('应用启动', { version: '1.0.0' });
logger.debug('调试信息', { detail: 'some data' });
logger.error('错误发生', { error: error.message });
```

### 链路追踪（Tracer）

```typescript
import { Tracer } from '@devtools/micro-kernel';

const tracer = new Tracer({ enabled: true });

const spanId = tracer.startSpan('计算操作', undefined, { user: 'admin' });
// ... 执行业务逻辑 ...
tracer.endSpan(spanId, { result: 'success' });

const spans = tracer.getSpans();
console.log(spans);
```

---

## 📈 性能基准

| 场景 | 微内核开销 | 业务逻辑 | 内核占比 |
|------|------------|----------|----------|
| 正常执行 | ~0.02ms | 5ms | 0.4% |
| 继承链（缓存命中） | ~0.03ms | 5ms | 0.6% |
| 版本路由命中 | ~0.01ms | 5ms | 0.2% |
| 降级执行（含 Draft） | ~0.3ms | 5ms | 5.7% |

---

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 可视化测试界面
npm run test:ui
```

---

## 📄 许可证

MIT License © 2026

---

**Micro-Kernel Core** —— 为你的项目提供坚实、可靠的扩展基础设施。
