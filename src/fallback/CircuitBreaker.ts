/**
 * ============================================================
 * CircuitBreaker.ts
 * 断路器状态机
 * 
 * 状态流转：
 *   CLOSED（关闭）—— 正常执行
 *   └── 连续失败 ≥ 阈值 → OPEN（打开）
 *   OPEN（打开）—— 拒绝执行
 *   └── 超时后 → HALF_OPEN（半开）
 *   HALF_OPEN（半开）—— 试探执行
 *   ├── 成功 → CLOSED（恢复）
 *   └── 失败 → OPEN（再次打开）
 * ============================================================
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  timeoutMs?: number;
  halfOpenRequests?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttemptTime = 0;
  private halfOpenAttempts = 0;

  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
      halfOpenRequests: config.halfOpenRequests ?? 1,
    };
  }

  allowExecution(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (Date.now() >= this.nextAttemptTime) {
          this.state = 'HALF_OPEN';
          this.halfOpenAttempts = 0;
          return true;
        }
        return false;
      case 'HALF_OPEN':
        if (this.halfOpenAttempts < this.config.halfOpenRequests) {
          this.halfOpenAttempts++;
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  onSuccess(): void {
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  onFailure(): void {
    // ✅ 移除对 _lastFailureTime 的赋值
    switch (this.state) {
      case 'CLOSED':
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.trip();
        }
        break;
      case 'HALF_OPEN':
        this.trip();
        break;
      case 'OPEN':
        this.failureCount++;
        break;
    }
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF_OPEN';
      this.halfOpenAttempts = 0;
    }
    return this.state;
  }

  getStateDescription(): string {
    const state = this.getState();
    switch (state) {
      case 'CLOSED':
        return `🟢 关闭（失败次数: ${this.failureCount}/${this.config.failureThreshold}）`;
      case 'OPEN':
        return `🔴 打开（剩余等待时间: ${Math.max(0, Math.ceil((this.nextAttemptTime - Date.now()) / 1000))}s）`;
      case 'HALF_OPEN':
        return `🟡 半开（试探次数: ${this.halfOpenAttempts}/${this.config.halfOpenRequests}）`;
      default:
        return '未知状态';
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    this.halfOpenAttempts = 0;
  }

  forceOpen(): void {
    this.trip();
  }

  forceClose(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    this.halfOpenAttempts = 0;
  }

  private trip(): void {
    this.state = 'OPEN';
    this.failureCount = 0;
    this.nextAttemptTime = Date.now() + this.config.timeoutMs;
    this.halfOpenAttempts = 0;
  }
}