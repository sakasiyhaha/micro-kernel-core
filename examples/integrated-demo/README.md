# Micro-Kernel 集成示例

本示例演示了 Micro-Kernel Core 的所有核心功能。

## 功能列表

| 模块 | 说明 |
|------|------|
| 基础用法 | 创建内核、注册扩展、执行扩展 |
| 继承与覆盖 | `inherit()`、`override()`、`super()` 调用 |
| 降级与容错 | 降级策略、断路器、降级链 |
| 权限管理 | 权限规则、通配符匹配、权限校验 |
| 可观测性 | 日志、链路追踪、指标收集 |

## 运行方式

```bash
# 安装依赖
npm install

# 交互式菜单（推荐）
npm start

# 直接运行特定演示
npm run start:basic
npm run start:inheritance
npm run start:fallback
npm run start:permissions
npm run start:observability

# 运行所有演示
npm run start:all
交互式菜单操作
运行 npm start 后，会显示菜单：

text
1. 基础用法 (Basic)
2. 继承与覆盖 (Inheritance)
3. 降级与容错 (Fallback)
4. 权限管理 (Permissions)
5. 可观测性 (Observability)
6. 运行所有演示 (All)
0. 退出
输入对应数字即可运行该演示。

文件说明
text
src/
├── index.ts           # 主入口，交互式菜单
├── demo-basic.ts      # 基础用法演示
├── demo-inheritance.ts # 继承与覆盖演示
├── demo-fallback.ts   # 降级与容错演示
├── demo-permissions.ts # 权限管理演示
├── demo-observability.ts # 可观测性演示
└── utils.ts           # 公共工具函数
text

---

## 文件保存位置

请将上述所有文件按目录结构保存到 `examples/integrated-demo/` 目录下。

---

## 运行命令

```bash
cd examples/integrated-demo
npm install
npm start