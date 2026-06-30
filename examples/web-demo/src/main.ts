/**
 * ============================================================
 * main.ts - Web Demo 主入口
 * ============================================================
 */

import { KernelManager } from './kernel-manager.js';
import { UIHandler } from './ui-handler.js';

// ============================================================
// 初始化
// ============================================================

const kernelManager = new KernelManager();
const uiHandler = new UIHandler(kernelManager);

// 注册 UI 事件
uiHandler.setupEventListeners();

// 显示初始状态
uiHandler.updateStatus();

console.log('✅ Web Demo 已启动');