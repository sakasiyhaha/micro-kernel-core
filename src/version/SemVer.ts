// src/version/SemVer.ts

/**
 * 语义化版本比对工具（零依赖）
 * 支持版本号解析和比较
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * 解析版本字符串为 SemVer 对象
 * @param version 语义化版本字符串，如 "1.2.3" 或 "1.2.3-alpha.1"
 * @returns SemVer 对象，若解析失败返回 null
 */
export function parseSemVer(version: string): SemVer | null {
  const pattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
  const match = version.match(pattern);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
    build: match[5] || undefined,
  };
}

/**
 * 比较两个版本号
 * @param a 版本 A
 * @param b 版本 B
 * @returns -1 如果 a < b, 0 如果 a === b, 1 如果 a > b
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // 预发布版本处理
  const aHasPre = a.prerelease !== undefined;
  const bHasPre = b.prerelease !== undefined;
  if (aHasPre && !bHasPre) return -1;
  if (!aHasPre && bHasPre) return 1;
  if (aHasPre && bHasPre) {
    // 简化的预发布版本比较
    if (a.prerelease! < b.prerelease!) return -1;
    if (a.prerelease! > b.prerelease!) return 1;
  }

  // build 版本不影响优先级
  return 0;
}

/**
 * 比较两个版本字符串
 * @param a 版本 A 字符串
 * @param b 版本 B 字符串
 * @returns -1 如果 a < b, 0 如果 a === b, 1 如果 a > b
 */
export function compareVersions(a: string, b: string): number {
  const sa = parseSemVer(a);
  const sb = parseSemVer(b);
  if (!sa || !sb) {
    // 如果无法解析，使用字符串比较
    return a.localeCompare(b);
  }
  return compareSemVer(sa, sb);
}

/**
 * 检查版本是否满足版本范围
 * @param version 当前版本
 * @param range 版本范围，支持 ">=", "<=", ">", "<", "=", "^", "~"
 * @returns 是否满足
 */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parseSemVer(version);
  if (!v) return false;

  // 简化版本范围处理：支持精确匹配和 >= 前缀
  if (range.startsWith('>=')) {
    const r = parseSemVer(range.slice(2).trim());
    if (!r) return false;
    return compareSemVer(v, r) >= 0;
  }
  if (range.startsWith('<=')) {
    const r = parseSemVer(range.slice(2).trim());
    if (!r) return false;
    return compareSemVer(v, r) <= 0;
  }
  if (range.startsWith('>')) {
    const r = parseSemVer(range.slice(1).trim());
    if (!r) return false;
    return compareSemVer(v, r) > 0;
  }
  if (range.startsWith('<')) {
    const r = parseSemVer(range.slice(1).trim());
    if (!r) return false;
    return compareSemVer(v, r) < 0;
  }
  if (range.startsWith('^')) {
    // 兼容 ^1.2.3 语义：允许 minor/patch 升级
    const r = parseSemVer(range.slice(1).trim());
    if (!r) return false;
    if (r.major === 0) {
      // ^0.x.x 允许 patch 升级
      return compareSemVer(v, r) >= 0 && v.major === 0;
    }
    return compareSemVer(v, r) >= 0 && v.major === r.major;
  }
  if (range.startsWith('~')) {
    // 兼容 ~1.2.3 语义：允许 patch 升级
    const r = parseSemVer(range.slice(1).trim());
    if (!r) return false;
    return compareSemVer(v, r) >= 0 && v.major === r.major && v.minor === r.minor;
  }

  // 精确匹配
  const r = parseSemVer(range);
  if (!r) return false;
  return compareSemVer(v, r) === 0;
}