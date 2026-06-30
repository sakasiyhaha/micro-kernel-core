// src/version/VersionLock.ts

// 声明 Node.js 全局变量，避免 TypeScript 报错（实际运行时通过 typeof 检查）
declare const process: any;
declare const require: any;

import { satisfiesRange } from './SemVer.js';

/**
 * 版本锁配置（对应 micro-kernel.config.json）
 */
export interface VersionLockConfig {
  /** 内核版本锁定配置 */
  kernel: {
    /** 锁定的版本号 */
    version: string;
    /** 是否锁定（禁止自动升级） */
    locked: boolean;
    /** 最低允许版本 */
    minVersion?: string;
    /** 最高允许版本 */
    maxVersion?: string;
  };
  /** 服务层版本锁定配置 */
  services?: {
    version: string;
    locked: boolean;
    minVersion?: string;
    maxVersion?: string;
  };
  /** 应用层版本锁定配置 */
  apps?: {
    version: string;
    locked: boolean;
  };
}

/**
 * 版本锁校验结果
 */
export interface VersionLockResult {
  /** 是否全部通过 */
  valid: boolean;
  /** 校验错误列表 */
  errors: string[];
  /** 校验警告列表 */
  warnings: string[];
}

/**
 * 引擎锁
 * 
 * 职责：
 * - 读取项目配置文件中的版本锁定信息
 * - 校验当前版本是否满足锁定要求
 * - 提供锁定状态查询
 */
export class VersionLock {
  private config: VersionLockConfig | null = null;

  /**
   * 加载版本锁配置
   * @param configPath 配置文件路径（可选，默认为项目根目录的 micro-kernel.config.json）
   * @param config 直接传入配置对象（优先级高于读取文件）
   */
  load(configPath?: string, config?: VersionLockConfig): void {
    if (config) {
      this.config = config;
      return;
    }

    // 仅在 Node.js 环境中尝试读取文件
    if (typeof process !== 'undefined' && typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const configFile = configPath || 'micro-kernel.config.json';
        const fullPath = path.resolve(process.cwd(), configFile);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          this.config = JSON.parse(content);
          return;
        }
      } catch (err) {
        console.warn('[VersionLock] 读取配置文件失败，使用默认值:', err);
      }
    }

    // 默认配置（无锁定）
    this.config = {
      kernel: {
        version: '1.0.0',
        locked: false,
      },
    };
  }

  /**
   * 校验内核版本是否满足锁定要求
   * @param kernelVersion 当前内核版本
   * @returns 校验结果
   */
  validateKernel(kernelVersion: string): VersionLockResult {
    const result: VersionLockResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!this.config) {
      this.load();
    }

    const cfg = this.config!;

    // 检查内核版本锁定状态
    if (cfg.kernel.locked) {
      const lockedVersion = cfg.kernel.version;
      if (kernelVersion !== lockedVersion) {
        result.valid = false;
        result.errors.push(
          `内核版本不匹配: 当前 ${kernelVersion}，锁定版本 ${lockedVersion}。` +
          `请使用 "micro-kernel unlock --force" 强制解锁（不推荐）`
        );
      }
    }

    // 检查版本范围
    if (cfg.kernel.minVersion) {
      if (!satisfiesRange(kernelVersion, `>=${cfg.kernel.minVersion}`)) {
        result.valid = false;
        result.errors.push(
          `内核版本 ${kernelVersion} 低于最低要求 ${cfg.kernel.minVersion}`
        );
      }
    }
    if (cfg.kernel.maxVersion) {
      if (!satisfiesRange(kernelVersion, `<=${cfg.kernel.maxVersion}`)) {
        result.valid = false;
        result.errors.push(
          `内核版本 ${kernelVersion} 高于最高允许 ${cfg.kernel.maxVersion}`
        );
      }
    }

    return result;
  }

  /**
   * 校验服务层版本
   * @param serviceVersion 当前服务层版本
   * @returns 校验结果
   */
  validateService(serviceVersion: string): VersionLockResult {
    const result: VersionLockResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!this.config) {
      this.load();
    }

    const cfg = this.config!;
    if (!cfg.services) {
      // 未配置服务层锁定，跳过
      return result;
    }

    if (cfg.services.locked) {
      const lockedVersion = cfg.services.version;
      if (serviceVersion !== lockedVersion) {
        result.valid = false;
        result.errors.push(
          `服务层版本不匹配: 当前 ${serviceVersion}，锁定版本 ${lockedVersion}`
        );
      }
    }

    if (cfg.services.minVersion) {
      if (!satisfiesRange(serviceVersion, `>=${cfg.services.minVersion}`)) {
        result.valid = false;
        result.errors.push(
          `服务层版本 ${serviceVersion} 低于最低要求 ${cfg.services.minVersion}`
        );
      }
    }
    if (cfg.services.maxVersion) {
      if (!satisfiesRange(serviceVersion, `<=${cfg.services.maxVersion}`)) {
        result.valid = false;
        result.errors.push(
          `服务层版本 ${serviceVersion} 高于最高允许 ${cfg.services.maxVersion}`
        );
      }
    }

    return result;
  }

  /**
   * 获取当前锁定配置
   */
  getConfig(): VersionLockConfig | null {
    return this.config;
  }

  /**
   * 检查内核是否被锁定
   */
  isKernelLocked(): boolean {
    return this.config?.kernel.locked ?? false;
  }

  /**
   * 获取锁定的内核版本
   */
  getLockedKernelVersion(): string | null {
    return this.config?.kernel.version ?? null;
  }
}