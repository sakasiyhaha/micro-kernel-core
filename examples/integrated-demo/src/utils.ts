/**
 * ============================================================
 * utils.ts
 * 集成示例公共工具函数
 * ============================================================
 */

export function printSection(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

export function printResult(label: string, value: any, success: boolean = true): void {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${label}: ${value}`);
}

export function printError(error: Error): void {
  console.log(`❌ 错误: ${error.message}`);
}

export function printSubSection(title: string): void {
  console.log(`\n📌 ${title}`);
  console.log('-'.repeat(40));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}