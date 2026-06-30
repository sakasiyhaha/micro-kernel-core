/**
 * ============================================================
 * demos/permissions.ts - 权限管理演示（修复版）
 * 
 * 演示：
 * 1. 注册扩展点（含权限要求）
 * 2. 注册扩展（声明拥有的权限）
 * 3. 执行扩展（权限校验生效）
 * 4. 权限不足被拒绝的场景
 * ============================================================
 */

import { Kernel, Logger, Tracer, MetricsCollector, PermissionManager } from '@devtools/micro-kernel';

export async function runPermissionsDemo(
  kernel: Kernel,
  logger: Logger,
  _tracer: Tracer,
  metrics: MetricsCollector
): Promise<void> {
  logger.info('🔐 权限管理演示开始');

  // ============================================================
  // 1. 创建权限管理器
  // ============================================================

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

  logger.debug('权限规则已配置: storage.read=ALLOW, storage.write=DENY');

  // ============================================================
  // 2. 注册扩展点（含权限要求）
  // ============================================================

  // 2.1 无权限要求的扩展点
  kernel.registerPoint({
    id: 'perms.none',
    description: '无权限要求的扩展点',
    allowOverride: true,
    allowInherit: true,
    permissions: [], // 无权限要求
  });
  logger.debug('已注册扩展点: perms.none (无权限要求)');

  // 2.2 只读权限要求的扩展点
  kernel.registerPoint({
    id: 'perms.readonly',
    description: '需要 storage.read 权限',
    allowOverride: true,
    allowInherit: true,
    permissions: ['storage.read'],
  });
  logger.debug('已注册扩展点: perms.readonly (需要 storage.read)');

  // 2.3 写入权限要求的扩展点
  kernel.registerPoint({
    id: 'perms.write',
    description: '需要 storage.write 权限',
    allowOverride: true,
    allowInherit: true,
    permissions: ['storage.write'],
  });
  logger.debug('已注册扩展点: perms.write (需要 storage.write)');

  // ============================================================
  // 3. 注册扩展
  // ============================================================

  // 3.1 ✅ 无权限扩展 → 注册到无要求的扩展点（应该成功）
  kernel.add('perms.none', {
    id: 'none-impl',
    pointId: 'perms.none',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: [],
    execute: async () => '无权限扩展执行成功',
  });
  logger.debug('已注册: none-impl (无权限) → perms.none');

  // 3.2 ✅ 只读扩展 → 注册到只读要求的扩展点（应该成功）
  kernel.add('perms.readonly', {
    id: 'readonly-impl',
    pointId: 'perms.readonly',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: ['storage.read'],
    execute: async () => '只读扩展执行成功',
  });
  logger.debug('已注册: readonly-impl (storage.read) → perms.readonly');

  // 3.3 ✅ 写入扩展 → 注册到写入要求的扩展点（应该成功）
  kernel.add('perms.write', {
    id: 'write-impl',
    pointId: 'perms.write',
    version: '1.0.0',
    apiVersion: '1.0.0',
    permissions: ['storage.write'],
    execute: async () => '写入扩展执行成功',
  });
  logger.debug('已注册: write-impl (storage.write) → perms.write');

  // ============================================================
  // 4. ❌ 权限不足场景（预期失败）
  // ============================================================

  logger.warn('⚠️ 尝试注册只读扩展到写入扩展点（预期失败）...');

  try {
    // 只读扩展 → 注册到写入要求的扩展点（应该被拒绝！）
    kernel.add('perms.write', {
      id: 'readonly-to-write-impl',
      pointId: 'perms.write',
      version: '1.0.0',
      apiVersion: '1.0.0',
      permissions: ['storage.read'], // 只有读权限，缺少 storage.write
      execute: async () => '只读扩展试图注册到写入扩展点（不应该执行）',
    });
    // 如果执行到这里，说明权限校验未生效
    logger.error('❌ 权限校验未生效！只读扩展被错误地允许注册到写入扩展点');
  } catch (err) {
    // ✅ 预期行为：抛出 PermissionError
    // ✅ 修正：使用 logger.info 替代 logger.success
    logger.info(`✅ 权限校验生效！扩展被拒绝注册: ${(err as Error).message}`);
    metrics.incrementCounter('demo.permissions.denied', 1);
  }

  // ============================================================
  // 5. 执行已注册的扩展
  // ============================================================

  logger.info('📌 执行已注册的扩展:');

  const r1 = await kernel.execute('perms.none');
  logger.info(`  无权限扩展: "${r1}" ✅`);

  const r2 = await kernel.execute('perms.readonly');
  logger.info(`  只读扩展: "${r2}" ✅`);

  const r3 = await kernel.execute('perms.write');
  logger.info(`  写入扩展: "${r3}" ✅`);

  // ============================================================
  // 6. 显示权限规则
  // ============================================================

  logger.debug('📊 当前权限规则:');
  pm.getRules().forEach((rule: any) => {
    logger.debug(`  ${rule.permission} → ${rule.policy}${rule.target ? ` (目标: ${rule.target})` : ''}`);
  });

  // ============================================================
  // 7. 显示扩展点权限要求
  // ============================================================

  const state = kernel.getState();
  logger.debug('📊 扩展点权限要求:');
  state.points.forEach((point: any) => {
    const perms = point.permissions?.length ? point.permissions.join(', ') : '无';
    logger.debug(`  ${point.id}: [${perms}]`);
  });

  logger.info('✅ 权限管理演示完成');
}