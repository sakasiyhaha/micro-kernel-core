/**
 * ============================================================
 * vitest.config.ts
 * Vitest 测试框架配置
 * 
 * 支持：
 * - TypeScript 源码测试
 * - 覆盖率报告
 * - 单元测试和集成测试
 * ============================================================
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试文件匹配模式
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'examples'],

    // 环境配置
    environment: 'node',

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'tests',
        'examples',
        '**/*.d.ts',
        '**/index.ts',
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },

    // 全局 API（无需导入即可使用 describe, it, expect）
    globals: true,

    // 测试超时时间（毫秒）
    testTimeout: 5000,
    hookTimeout: 5000,

    // 控制台输出
    reporters: ['default'],
  },
});