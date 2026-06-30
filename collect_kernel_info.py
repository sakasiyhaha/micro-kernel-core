#!/usr/bin/env python3
"""
Micro-Kernel Core 项目信息收集脚本（优化版）
- 自动生成结构化快照报告，供 AI 分析
- 排除二进制、大体积文件，仅记录路径
- 默认忽略 examples/ 目录（示例代码）
- 支持 --verbose 和 --list-files 调试选项
"""

import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime

# ==================== 全局配置 ====================
PROJECT_ROOT = Path(__file__).parent.resolve()
OUTPUT_FILE = PROJECT_ROOT / "micro_kernel_snapshot.txt"

# 支持读取内容的文本文件扩展名
TEXT_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx", ".d.ts", ".d.tsx",
    ".css", ".scss", ".less",
    ".html", ".json", ".md", ".txt", ".xml",
    ".yaml", ".yml",
}

# 默认忽略的目录/文件名称（精确匹配）
SKIP_PATTERNS = {
    "node_modules", ".git", ".vite", "dist", "build",
    "coverage", ".idea", ".vs", ".DS_Store", "__pycache__",
    "archive", "venv", ".pytest_cache",
    "examples",   # 新增：忽略示例代码目录
}

# 即使在上面的忽略列表中，这些文件也强制读取内容
ALWAYS_INCLUDE = {
    "package.json", "package-lock.json",
    "tsconfig.json", "rollup.config.js", "vite.config.ts",
    "vitest.config.ts", "vitest.config.js",
    "index.html",
}

# 敏感文件列表：只记录文件名，不读取内容
SENSITIVE_FILES = {".env", ".env.local", ".env.production", "credentials.json"}

# 文件大小上限（KB），超过则仅显示路径
MAX_FILE_SIZE_KB = 300

# 是否在报告头部显示环境信息
SHOW_ENV_INFO = True

# ==================== 工具函数 ====================
def should_skip(name: str, extra_skips: set = None) -> bool:
    if extra_skips and name in extra_skips:
        return True
    return name in SKIP_PATTERNS

def should_read_content(file_path: Path, verbose: bool = False) -> bool:
    """判断是否应读取文件内容，verbose 用于调试输出"""
    if file_path.name in ALWAYS_INCLUDE:
        return True
    if file_path.name in SENSITIVE_FILES:
        return False
    if file_path.suffix.lower() not in TEXT_EXTENSIONS:
        return False
    try:
        size_kb = file_path.stat().st_size / 1024
        if size_kb > MAX_FILE_SIZE_KB:
            if verbose:
                print(f"⚠️  跳过过大文件: {file_path} ({size_kb:.1f} KB)")
            return False
    except OSError:
        return False
    return True

def safe_read(file_path: Path) -> str:
    if file_path.name in SENSITIVE_FILES:
        return "[敏感文件，内容未显示]"
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        return "[二进制文件，未显示内容]"
    except Exception as e:
        return f"[读取失败: {e}]"

def get_lang(suffix: str) -> str:
    mapping = {
        '.js': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript', '.d.ts': 'typescript', '.d.tsx': 'typescript',
        '.css': 'css', '.scss': 'scss', '.less': 'less',
        '.html': 'html',
        '.json': 'json',
        '.md': 'markdown',
        '.xml': 'xml',
        '.yaml': 'yaml', '.yml': 'yaml',
    }
    return mapping.get(suffix.lower(), '')

# ==================== 目录树生成 ====================
def generate_tree(root: Path, prefix="", is_last=False, root_label=None, verbose=False) -> list:
    lines = []
    if not root.is_dir():
        return lines

    if root_label:
        lines.append(prefix + root_label + "/")
        prefix = prefix + "    " if is_last else prefix + "│   "

    try:
        children = sorted(
            [p for p in root.iterdir() if not should_skip(p.name)],
            key=lambda x: (not x.is_dir(), x.name.lower())
        )
    except PermissionError:
        lines.append(prefix + "└── [权限不足，无法读取]")
        return lines

    for i, child in enumerate(children):
        is_last_child = (i == len(children) - 1)
        connector = "└── " if is_last_child else "├── "
        lines.append(prefix + connector + child.name)
        if child.is_dir():
            extension = "    " if is_last_child else "│   "
            lines.extend(generate_tree(child, prefix + extension, is_last_child, verbose=verbose))
    return lines

def get_all_top_level_dirs() -> list:
    if not PROJECT_ROOT.is_dir():
        return []
    dirs = []
    for child in sorted(PROJECT_ROOT.iterdir()):
        if child.is_dir() and not should_skip(child.name):
            dirs.append(child.name)
    return dirs

# ==================== 内容收集函数 ====================
def collect_configs() -> str:
    config_files = [
        PROJECT_ROOT / "package.json",
        PROJECT_ROOT / "tsconfig.json",
        PROJECT_ROOT / "rollup.config.js",
        PROJECT_ROOT / "vite.config.ts",
        PROJECT_ROOT / "vitest.config.ts",
        PROJECT_ROOT / "vitest.config.js",
    ]
    config_dir = PROJECT_ROOT / "config"
    if config_dir.exists():
        for f in list(config_dir.glob("*.js")) + list(config_dir.glob("*.ts")):
            config_files.append(f)

    seen = set()
    unique_files = []
    for f in config_files:
        if f.exists() and f not in seen:
            seen.add(f)
            unique_files.append(f)

    content = []
    for cfg in unique_files:
        rel = cfg.relative_to(PROJECT_ROOT)
        lang = get_lang(cfg.suffix)
        content.append(f"\n### {rel}\n```{lang}\n{safe_read(cfg)}\n```")
    return "".join(content)

def collect_entry_html() -> str:
    index_path = PROJECT_ROOT / "index.html"
    if index_path.exists():
        return f"\n### index.html\n```html\n{safe_read(index_path)}\n```"
    return "index.html 未找到"

def collect_source_files(extra_dirs: list, verbose=False, list_files=False) -> str:
    parts = []
    if extra_dirs:
        scan_dirs = extra_dirs
    else:
        scan_dirs = get_all_top_level_dirs()

    total_files = 0
    for d in scan_dirs:
        dir_path = PROJECT_ROOT / d
        if not dir_path.exists():
            if verbose:
                print(f"⚠️  目录不存在: {dir_path}")
            continue
        files = [f for f in dir_path.rglob("*") if f.is_file() and not any(should_skip(p.name) for p in f.parents)]
        total_files += len(files)
        if verbose:
            print(f"📁 扫描 {dir_path}: 发现 {len(files)} 个文件")
        if list_files:
            for fp in files:
                rel = fp.relative_to(PROJECT_ROOT)
                print(f"   {rel}")
        for fp in sorted(files):
            rel = fp.relative_to(PROJECT_ROOT)
            if should_read_content(fp, verbose):
                lang = get_lang(fp.suffix)
                parts.append(f"\n### {rel}\n```{lang}\n{safe_read(fp)}\n```")
            else:
                parts.append(f"\n### {rel}\n```\n[文件未显示内容]\n```")
    if verbose:
        print(f"📊 共扫描 {len(scan_dirs)} 个目录，{total_files} 个文件")
    return "".join(parts)

def collect_other_files() -> str:
    others = [
        PROJECT_ROOT / ".gitignore",
        PROJECT_ROOT / "README.md",
        PROJECT_ROOT / "LICENSE",
        PROJECT_ROOT / "CHANGELOG.md",
    ]
    parts = []
    for f in others:
        if f.exists():
            rel = f.relative_to(PROJECT_ROOT)
            parts.append(f"\n### {rel}\n```\n{safe_read(f)}\n```")
    return "".join(parts)

# ==================== 报告生成 ====================
def generate_report(extra_skips: set, extra_dirs: list, verbose=False, list_files=False) -> str:
    if extra_skips:
        SKIP_PATTERNS.update(extra_skips)

    lines = []
    lines.append("=" * 80)
    lines.append("Micro-Kernel Core 项目快照报告")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"项目路径: {PROJECT_ROOT}")
    if SHOW_ENV_INFO:
        lines.append(f"Python: {sys.version.split()[0]} | OS: {sys.platform}")
    lines.append("=" * 80)

    # 目录结构
    lines.append("\n\n## 1. 项目目录结构\n")
    lines.append("(已自动排除 node_modules, dist, .git, examples 等目录)\n")
    top_dirs = get_all_top_level_dirs()
    for d in top_dirs:
        dir_path = PROJECT_ROOT / d
        if dir_path.exists():
            lines.extend(generate_tree(dir_path, root_label=d, verbose=verbose))

    # 配置文件
    lines.append("\n\n## 2. 配置文件\n")
    lines.append(collect_configs())

    # 入口 HTML（如果有）
    lines.append("\n\n## 3. 入口 HTML\n")
    lines.append(collect_entry_html())

    # 源代码与文档
    lines.append("\n\n## 4. 源代码与文档文件\n")
    lines.append(collect_source_files(extra_dirs, verbose, list_files))

    # 其他
    lines.append("\n\n## 5. 其他文件\n")
    lines.append(collect_other_files())

    lines.append("\n\n" + "=" * 80)
    lines.append("报告结束")
    return "\n".join(lines)

# ==================== 命令行 ====================
def parse_args():
    parser = argparse.ArgumentParser(description="生成 Micro-Kernel Core 项目快照报告")
    parser.add_argument('--skip', nargs='*', default=[],
                        help='额外忽略的目录/文件名称')
    parser.add_argument('--extra', nargs='*', default=[],
                        help='额外扫描的目录（默认所有非忽略目录）')
    parser.add_argument('--output', type=Path, default=OUTPUT_FILE,
                        help='输出文件路径')
    parser.add_argument('--verbose', action='store_true',
                        help='输出详细的扫描过程信息')
    parser.add_argument('--list-files', action='store_true',
                        help='仅列出所有将被包含的文件，不生成完整报告')
    return parser.parse_args()

# ==================== 主入口 ====================
if __name__ == "__main__":
    args = parse_args()
    verbose = args.verbose
    list_files = args.list_files

    if list_files:
        print("📋 列出所有将被扫描的文件：")
        extra_skips = set(args.skip)
        extra_dirs = args.extra
        if extra_skips:
            SKIP_PATTERNS.update(extra_skips)
        collect_source_files(extra_dirs, verbose=True, list_files=True)
        sys.exit(0)

    print("🔍 开始收集项目信息...")
    start = time.time()

    try:
        report = generate_report(set(args.skip), args.extra, verbose=verbose)
    except Exception as e:
        print(f"❌ 报告生成失败: {e}")
        sys.exit(1)

    output_path = args.output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"✅ 报告已生成: {output_path}")
    print(f"   文件大小: {len(report)} 字符 | 耗时: {time.time() - start:.2f} 秒")