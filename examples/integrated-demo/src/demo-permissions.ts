/**
 * ============================================================
 * demo-permissions.ts
 * 权限管理演示
 * ============================================================
 */

import { Kernel, PermissionManager, Permissions } from '@devtools/micro-kernel';
import { printSection, printResult, printSubSection, printError } from './utils.js';

export async function runPermissionsDemo(): Promise<void> {
  printSection('🔐 权限管理演示');

  const kernel = new Kernel({
    version: '1.0.0',
    strictMode: true,
    debug: false,
  });

  // 1. 创建权限管理器
  const pm = new PermissionManager({
    enabled: true,
    defaultPolicy: 'DENY',
    enableWildcard: true,
  });

  pm.addRules([
    { permission: 'storage.read', policy: 'ALLOW' },
    { permission: 'storage.write', policy: 'DENY' },
    { permission: 'storage.*', policy: 'ALLOW', target: 'system-ext' },
  ]);

  console.log('✅ 权限管理器已配置 (默认策略: DENY)');

  // 2. 注册带权限的扩展
  printSubSection('注册 4 个带权限的扩展');

  kernel.add('test.no-permission', {
    id: 'no-permission-impl',
    pointId: 'test.no-permission',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: [],
    execute: async () => '无权限扩展执行成功',
  });
  console.log('✅ no-permission-impl (无权限)');

  kernel.add('test.read-only', {
    id: 'read-only-impl',
    pointId: 'test.read-only',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: ['storage.read'],
    execute: async () => '读取权限扩展执行成功',
  });
  console.log('✅ read-only-impl (只读权限)');

  kernel.add('test.write-required', {
    id: 'write-required-impl',
    pointId: 'test.write-required',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: ['storage.write'],
    execute: async () => '写入权限扩展执行成功（不应该到达）',
  });
  console.log('✅ write-required-impl (需要写入权限)');

  kernel.add('test.system', {
    id: 'system-ext',
    pointId: 'test.system',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: ['storage.read', 'storage.write'],
    execute: async () => '系统扩展执行成功',
  });
  console.log('✅ system-ext (系统扩展，通配符权限)');

  // 3. 执行测试
  printSubSection('执行权限测试');

  // 3.1 无权限扩展
  const result1 = await kernel.execute('test.no-permission');
  printResult('无权限扩展', `"${result1}"`);

  // 3.2 只读权限扩展
  const result2 = await kernel.execute('test.read-only');
  printResult('只读权限扩展', `"${result2}"`);

  // 3.3 需要写入权限（被拒绝）
  try {
    await kernel.execute('test.write-required');
  } catch (err) {
    printError(err as Error);
  }

  // 3.4 系统扩展
  const result4 = await kernel.execute('test.system');
  printResult('系统扩展 (通配符)', `"${result4}"`);

  // 4. 显示权限规则
  printSubSection('当前权限规则');
  pm.getRules().forEach((rule, i) => {
    console.log(`   ${i + 1}. ${rule.permission} → ${rule.policy}${rule.target ? ` (目标: ${rule.target})` : ''}`);
  });

  await kernel.destroy();
  console.log('\n✅ 内核已销毁');
}