// src/version/VersionRouter.ts

import type { Extension } from '../types/extension.types.js';
import { VersionMismatchError } from '../types/errors.types.js';
import { parseSemVer, compareVersions, satisfiesRange } from './SemVer.js';

/**
 * 适配器函数类型
 * 接收扩展和原始参数，返回适配后的扩展（或 null 表示不兼容）
 */
export type VersionAdapter = (extension: Extension) => Extension | null;

/**
 * 版本路由器
 * 
 * 职责：
 * - 维护 apiVersion → 适配器 的映射
 * - 根据扩展的 apiVersion 路由到对应的适配器
 * - 支持版本范围匹配（如 ">=2.0.0"）
 */
export class VersionRouter {
  /**
   * 存储版本适配器
   * key: apiVersion 字符串（支持范围语法）
   * value: 适配器函数
   */
  private adapters = new Map<string, VersionAdapter>();

  /**
   * 缓存已解析的适配器查找结果
   * key: extensionId + apiVersion
   * value: 适配后的 Extension 或 null
   */
  private cache = new Map<string, Extension | null>();

  /**
   * 内核自身版本
   */
  private kernelVersion: string;

  constructor(kernelVersion: string) {
    this.kernelVersion = kernelVersion;
  }

  /**
   * 注册一个版本适配器
   * @param apiVersion 支持的 API 版本（支持范围语法，如 ">=2.0.0"）
   * @param adapter 适配器函数
   */
  registerAdapter(apiVersion: string, adapter: VersionAdapter): void {
    if (this.adapters.has(apiVersion)) {
      console.warn(`[VersionRouter] 适配器 "${apiVersion}" 已存在，将被覆盖`);
    }
    this.adapters.set(apiVersion, adapter);
    // 清除缓存（因为适配器变更可能影响缓存结果）
    this.cache.clear();
  }

  /**
   * 根据扩展的 apiVersion 查找对应的适配器
   * @param extension 扩展实现
   * @returns 适配后的扩展，若无可用的适配器则返回 null
   * @throws {VersionMismatchError} 当版本完全不兼容时
   */
  route(extension: Extension): Extension | null {
    const cacheKey = `${extension.id}:${extension.apiVersion}`;

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    // 如果没有适配器，直接返回原扩展（假设兼容）
    if (this.adapters.size === 0) {
      // 检查版本是否与内核兼容（简单检查：至少 major 版本一致）
      if (!this.isVersionCompatible(extension.apiVersion)) {
        this.cache.set(cacheKey, null);
        throw new VersionMismatchError(
          `扩展 "${extension.id}" 的 API 版本 "${extension.apiVersion}" 与内核版本 "${this.kernelVersion}" 不兼容`,
          this.kernelVersion,
          extension.apiVersion
        );
      }
      this.cache.set(cacheKey, extension);
      return extension;
    }

    // 遍历适配器，按注册顺序匹配
    // 支持范围匹配：如 ">=2.0.0" 匹配 2.0.0, 2.1.0, 3.0.0 等
    for (const [versionRange, adapter] of this.adapters) {
      if (this.matchesVersion(extension.apiVersion, versionRange)) {
        try {
          const adapted = adapter(extension);
          this.cache.set(cacheKey, adapted);
          return adapted;
        } catch (err) {
          console.warn(
            `[VersionRouter] 适配器 "${versionRange}" 处理扩展 "${extension.id}" 失败:`,
            err
          );
          // 继续尝试下一个适配器
          continue;
        }
      }
    }

    // 没有匹配的适配器
    this.cache.set(cacheKey, null);
    throw new VersionMismatchError(
      `扩展 "${extension.id}" 的 API 版本 "${extension.apiVersion}" 没有可用的适配器`,
      this.kernelVersion,
      extension.apiVersion
    );
  }

  /**
   * 获取所有已注册的 API 版本
   */
  getSupportedVersions(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 检查版本是否与内核兼容
   */
  private isVersionCompatible(apiVersion: string): boolean {
    const kernel = parseSemVer(this.kernelVersion);
    const api = parseSemVer(apiVersion);
    if (!kernel || !api) return false;

    // 至少 major 版本一致
    return kernel.major === api.major;
  }

  /**
   * 检查版本是否匹配版本范围
   */
  private matchesVersion(version: string, range: string): boolean {
    // 如果 range 本身就是版本号（不含特殊字符），精确匹配
    if (/^\d+\.\d+\.\d+$/.test(range)) {
      return compareVersions(version, range) === 0;
    }
    // 否则使用 satisfiesRange 进行范围匹配
    return satisfiesRange(version, range);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}