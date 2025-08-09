#!/usr/bin/env python3
"""
プロジェクトリファクタリング分析・実行スクリプト
UIと処理に影響しないコード品質向上のためのリファクタリング
"""

import os
import re
import json
import ast
import argparse
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict, Counter

@dataclass
class CodeIssue:
    """コードの問題を表すデータクラス"""
    file_path: str
    line_number: int
    issue_type: str
    description: str
    severity: str  # 'high', 'medium', 'low'
    suggestion: str

@dataclass
class RefactoringSuggestion:
    """リファクタリング提案を表すデータクラス"""
    category: str
    priority: int
    description: str
    files_affected: List[str]
    estimated_effort: str
    benefits: List[str]

class ProjectAnalyzer:
    """プロジェクト分析クラス"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.src_dir = self.project_root / "src"
        self.issues: List[CodeIssue] = []
        self.suggestions: List[RefactoringSuggestion] = []
        
    def analyze_all(self) -> Dict:
        """全体分析を実行"""
        print("🔍 プロジェクト全体分析を開始...")
        
        results = {
            "file_stats": self._analyze_file_statistics(),
            "duplicate_code": self._find_duplicate_code(),
            "component_issues": self._analyze_components(),
            "type_issues": self._analyze_types(),
            "import_issues": self._analyze_imports(),
            "utility_functions": self._analyze_utility_functions(),
            "complexity_metrics": self._analyze_complexity(),
            "suggestions": self._generate_suggestions()
        }
        
        return results
    
    def _analyze_file_statistics(self) -> Dict:
        """ファイル統計分析"""
        stats = {
            "total_files": 0,
            "total_lines": 0,
            "large_files": [],
            "file_distribution": defaultdict(int)
        }
        
        for file_path in self._get_source_files():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = len(f.readlines())
                
                stats["total_files"] += 1
                stats["total_lines"] += lines
                
                # 大きすぎるファイルの検出
                if lines > 300:
                    stats["large_files"].append({
                        "path": str(file_path.relative_to(self.project_root)),
                        "lines": lines,
                        "severity": "high" if lines > 500 else "medium"
                    })
                
                # ディレクトリ別統計
                relative_path = file_path.relative_to(self.src_dir)
                directory = str(relative_path.parent) if relative_path.parent != Path('.') else 'root'
                stats["file_distribution"][directory] += 1
                
            except Exception as e:
                print(f"警告: {file_path} の読み込みに失敗: {e}")
        
        return stats
    
    def _find_duplicate_code(self) -> Dict:
        """重複コード検出"""
        duplicates = {
            "function_names": Counter(),
            "import_statements": Counter(),
            "similar_patterns": [],
            "duplicate_interfaces": []
        }
        
        for file_path in self._get_source_files():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 関数名の重複
                function_matches = re.findall(r'(?:function\s+|const\s+)(\w+)', content)
                for func_name in function_matches:
                    duplicates["function_names"][func_name] += 1
                
                # インポート文の重複
                import_matches = re.findall(r'import.*from\s+["\']([^"\']+)["\']', content)
                for import_path in import_matches:
                    duplicates["import_statements"][import_path] += 1
                
                # インターフェース定義の重複
                interface_matches = re.findall(r'interface\s+(\w+)', content)
                for interface_name in interface_matches:
                    if interface_name in duplicates["duplicate_interfaces"]:
                        continue
                    # 他のファイルで同じインターフェース名があるかチェック
                    count = 0
                    for other_file in self._get_source_files():
                        if other_file != file_path:
                            try:
                                with open(other_file, 'r', encoding='utf-8') as f:
                                    other_content = f.read()
                                if f'interface {interface_name}' in other_content:
                                    count += 1
                            except:
                                pass
                    if count > 0:
                        duplicates["duplicate_interfaces"].append({
                            "name": interface_name,
                            "occurrences": count + 1
                        })
                
            except Exception as e:
                print(f"警告: {file_path} の重複コード分析に失敗: {e}")
        
        # 頻繁に使用される項目のみ抽出
        duplicates["frequent_functions"] = {k: v for k, v in duplicates["function_names"].items() if v > 2}
        duplicates["common_imports"] = {k: v for k, v in duplicates["import_statements"].items() if v > 5}
        
        return duplicates
    
    def _analyze_components(self) -> Dict:
        """React コンポーネント分析"""
        component_issues = {
            "large_components": [],
            "complex_components": [],
            "stateful_components": [],
            "prop_issues": []
        }
        
        components_dir = self.src_dir / "components"
        if not components_dir.exists():
            return component_issues
        
        for file_path in components_dir.rglob("*.tsx"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                lines = len(content.splitlines())
                
                # 大きすぎるコンポーネント
                if lines > 200:
                    component_issues["large_components"].append({
                        "path": str(file_path.relative_to(self.project_root)),
                        "lines": lines,
                        "suggestion": "小さなコンポーネントに分割することを推奨"
                    })
                
                # 複雑な状態管理
                useState_count = len(re.findall(r'useState', content))
                useEffect_count = len(re.findall(r'useEffect', content))
                
                if useState_count > 5:
                    component_issues["stateful_components"].append({
                        "path": str(file_path.relative_to(self.project_root)),
                        "useState_count": useState_count,
                        "useEffect_count": useEffect_count,
                        "suggestion": "カスタムフックまたは状態管理ライブラリの使用を検討"
                    })
                
                # プロップの型チェック
                any_props = len(re.findall(r'props:\s*any', content))
                if any_props > 0:
                    component_issues["prop_issues"].append({
                        "path": str(file_path.relative_to(self.project_root)),
                        "any_usage": any_props,
                        "suggestion": "適切な型定義を作成"
                    })
                
            except Exception as e:
                print(f"警告: {file_path} のコンポーネント分析に失敗: {e}")
        
        return component_issues
    
    def _analyze_types(self) -> Dict:
        """型定義分析"""
        type_issues = {
            "any_usage": [],
            "inline_interfaces": [],
            "missing_types": [],
            "type_duplicates": []
        }
        
        for file_path in self._get_source_files():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # any型の使用
                any_matches = re.finditer(r':\s*any\b|<any>', content)
                for match in any_matches:
                    line_num = content[:match.start()].count('\n') + 1
                    type_issues["any_usage"].append({
                        "path": str(file_path.relative_to(self.project_root)),
                        "line": line_num,
                        "context": self._get_line_context(content, line_num)
                    })
                
                # インラインインターフェース
                if 'types/' not in str(file_path):
                    interface_matches = re.finditer(r'interface\s+\w+\s*{', content)
                    for match in interface_matches:
                        line_num = content[:match.start()].count('\n') + 1
                        type_issues["inline_interfaces"].append({
                            "path": str(file_path.relative_to(self.project_root)),
                            "line": line_num,
                            "interface": match.group(),
                            "suggestion": "types/ ディレクトリに移動を検討"
                        })
                
            except Exception as e:
                print(f"警告: {file_path} の型分析に失敗: {e}")
        
        return type_issues
    
    def _analyze_imports(self) -> Dict:
        """インポート分析"""
        import_issues = {
            "unused_imports": [],
            "redundant_imports": [],
            "long_import_paths": [],
            "missing_index_files": []
        }
        
        for file_path in self._get_source_files():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # インポート文の抽出
                import_matches = re.findall(r'import\s+{([^}]+)}\s+from\s+["\']([^"\']+)["\']', content)
                
                for imports, module_path in import_matches:
                    # 長すぎるインポートパス
                    if len(module_path.split('/')) > 4:
                        import_issues["long_import_paths"].append({
                            "path": str(file_path.relative_to(self.project_root)),
                            "import_path": module_path,
                            "suggestion": "index.tsファイルを使用した短縮を検討"
                        })
                    
                    # 未使用のインポートチェック（簡易版）
                    imported_names = [name.strip() for name in imports.split(',')]
                    for name in imported_names:
                        name = name.strip()
                        if name and not re.search(rf'\b{re.escape(name)}\b', content.replace(f'import {{{imports}}}', '')):
                            import_issues["unused_imports"].append({
                                "path": str(file_path.relative_to(self.project_root)),
                                "unused_import": name,
                                "from_module": module_path
                            })
                
            except Exception as e:
                print(f"警告: {file_path} のインポート分析に失敗: {e}")
        
        return import_issues
    
    def _analyze_utility_functions(self) -> Dict:
        """ユーティリティ関数分析"""
        utils_analysis = {
            "inline_functions": [],
            "extractable_functions": [],
            "utility_candidates": []
        }
        
        # lib/utils/ 以外の場所で定義されている関数を探す
        for file_path in self._get_source_files():
            if 'lib/utils' in str(file_path) or 'utils/' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # インライン関数の検出
                inline_functions = re.findall(r'const\s+(\w+)\s*=\s*\([^)]*\)\s*=>', content)
                if len(inline_functions) > 3:
                    utils_analysis["inline_functions"].append({
                        "path": str(file_path.relative_to(self.project_root)),
                        "function_count": len(inline_functions),
                        "functions": inline_functions,
                        "suggestion": "一部の関数をユーティリティとして抽出を検討"
                    })
                
            except Exception as e:
                print(f"警告: {file_path} のユーティリティ分析に失敗: {e}")
        
        return utils_analysis
    
    def _analyze_complexity(self) -> Dict:
        """コードの複雑性分析"""
        complexity = {
            "cyclomatic_complexity": [],
            "nested_conditions": [],
            "long_functions": []
        }
        
        for file_path in self._get_source_files():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 深いネストの検出
                lines = content.splitlines()
                for i, line in enumerate(lines):
                    indent_level = len(line) - len(line.lstrip())
                    if indent_level > 16:  # 4スペース × 4レベル以上
                        complexity["nested_conditions"].append({
                            "path": str(file_path.relative_to(self.project_root)),
                            "line": i + 1,
                            "indent_level": indent_level // 2,
                            "suggestion": "ネストを浅くするためのリファクタリングを検討"
                        })
                
            except Exception as e:
                print(f"警告: {file_path} の複雑性分析に失敗: {e}")
        
        return complexity
    
    def _generate_suggestions(self) -> List[RefactoringSuggestion]:
        """リファクタリング提案生成"""
        suggestions = []
        
        # コンポーネント分割の提案
        suggestions.append(RefactoringSuggestion(
            category="コンポーネント分割",
            priority=1,
            description="大きすぎるコンポーネントを小さな再利用可能なコンポーネントに分割",
            files_affected=["src/components/**/*.tsx"],
            estimated_effort="中程度",
            benefits=[
                "コードの可読性向上",
                "テストの書きやすさ",
                "再利用性の向上"
            ]
        ))
        
        # 型安全性の向上
        suggestions.append(RefactoringSuggestion(
            category="型安全性向上",
            priority=2,
            description="any型の使用を避け、適切な型定義を作成",
            files_affected=["src/**/*.ts", "src/**/*.tsx"],
            estimated_effort="小程度",
            benefits=[
                "型安全性の向上",
                "IDEサポートの改善",
                "バグの早期発見"
            ]
        ))
        
        # ユーティリティ関数の共通化
        suggestions.append(RefactoringSuggestion(
            category="ユーティリティ共通化",
            priority=3,
            description="重複するユーティリティ関数を共通化",
            files_affected=["src/lib/utils/**/*.ts"],
            estimated_effort="小程度",
            benefits=[
                "コードの重複削減",
                "保守性の向上",
                "一貫性の確保"
            ]
        ))
        
        return suggestions
    
    def _get_source_files(self) -> List[Path]:
        """ソースファイル一覧を取得"""
        extensions = {'.ts', '.tsx', '.js', '.jsx'}
        files = []
        
        for ext in extensions:
            files.extend(self.src_dir.rglob(f"*{ext}"))
        
        # node_modules等を除外
        exclude_patterns = {'node_modules', '.next', 'dist', 'build'}
        return [f for f in files if not any(pattern in str(f) for pattern in exclude_patterns)]
    
    def _get_line_context(self, content: str, line_num: int, context_lines: int = 2) -> str:
        """指定行の前後のコンテキストを取得"""
        lines = content.splitlines()
        start = max(0, line_num - context_lines - 1)
        end = min(len(lines), line_num + context_lines)
        return '\n'.join(lines[start:end])

class RefactoringExecutor:
    """リファクタリング実行クラス"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.analyzer = ProjectAnalyzer(project_root)
    
    def execute_refactoring(self, categories: List[str], dry_run: bool = True):
        """リファクタリングを実行"""
        print(f"🔧 リファクタリング実行 (dry_run={dry_run})")
        
        if 'components' in categories:
            self._refactor_components(dry_run)
        
        if 'types' in categories:
            self._refactor_types(dry_run)
        
        if 'utils' in categories:
            self._refactor_utils(dry_run)
        
        if 'imports' in categories:
            self._refactor_imports(dry_run)
    
    def _refactor_components(self, dry_run: bool):
        """コンポーネントリファクタリング"""
        print("🧩 コンポーネントリファクタリング実行中...")
        # 実際のリファクタリングロジックはここに実装
        # Claude Codeエージェントとの連携が必要
        pass
    
    def _refactor_types(self, dry_run: bool):
        """型定義リファクタリング"""
        print("📝 型定義リファクタリング実行中...")
        pass
    
    def _refactor_utils(self, dry_run: bool):
        """ユーティリティリファクタリング"""
        print("🛠️ ユーティリティリファクタリング実行中...")
        pass
    
    def _refactor_imports(self, dry_run: bool):
        """インポートリファクタリング"""
        print("📦 インポートリファクタリング実行中...")
        pass

def generate_report(analysis_results: Dict, output_path: str):
    """分析結果レポート生成"""
    
    report_content = f"""# 🔧 プロジェクトリファクタリング分析レポート

生成日時: {os.popen('date').read().strip()}

## 📊 プロジェクト統計

### ファイル統計
- 総ファイル数: {analysis_results['file_stats']['total_files']}
- 総コード行数: {analysis_results['file_stats']['total_lines']:,}
- 大きすぎるファイル数: {len(analysis_results['file_stats']['large_files'])}

### 🚨 検出された問題

#### 大きすぎるファイル (300行以上)
"""
    
    for large_file in analysis_results['file_stats']['large_files']:
        report_content += f"- `{large_file['path']}`: {large_file['lines']}行 ({large_file['severity']})\n"
    
    report_content += f"""
#### コンポーネントの問題
- 大きすぎるコンポーネント: {len(analysis_results['component_issues']['large_components'])}個
- 状態が多すぎるコンポーネント: {len(analysis_results['component_issues']['stateful_components'])}個

#### 型の問題
- any型の使用箇所: {len(analysis_results['type_issues']['any_usage'])}箇所
- インライン interface: {len(analysis_results['type_issues']['inline_interfaces'])}個

#### インポートの問題
- 未使用の可能性があるインポート: {len(analysis_results['import_issues']['unused_imports'])}個
- 長すぎるインポートパス: {len(analysis_results['import_issues']['long_import_paths'])}個

## 🎯 推奨リファクタリング

"""
    
    for suggestion in analysis_results['suggestions']:
        report_content += f"""### {suggestion.category}
- **優先度**: {suggestion.priority}
- **説明**: {suggestion.description}
- **推定工数**: {suggestion.estimated_effort}
- **効果**: {', '.join(suggestion.benefits)}

"""
    
    report_content += """
## 📋 実行コマンド

```bash
# 全体分析
/refactor --analyze-only

# コンポーネントリファクタリング
/refactor --components

# 型定義整理
/refactor --types

# 全体リファクタリング
/refactor --all
```

---
*このレポートは自動生成されました*
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print(f"📋 レポートが生成されました: {output_path}")

def main():
    parser = argparse.ArgumentParser(description='プロジェクトリファクタリング分析・実行')
    parser.add_argument('--project-root', default='.', help='プロジェクトルートディレクトリ')
    parser.add_argument('--analyze-only', action='store_true', help='分析のみ実行')
    parser.add_argument('--categories', nargs='+', 
                       choices=['components', 'types', 'utils', 'imports'], 
                       default=['components', 'types', 'utils', 'imports'],
                       help='リファクタリングカテゴリ')
    parser.add_argument('--dry-run', action='store_true', help='実際の変更は行わない')
    parser.add_argument('--output', default='refactor_report.md', help='レポート出力ファイル')
    
    args = parser.parse_args()
    
    # 分析実行
    analyzer = ProjectAnalyzer(args.project_root)
    results = analyzer.analyze_all()
    
    # レポート生成
    generate_report(results, args.output)
    
    # リファクタリング実行
    if not args.analyze_only:
        executor = RefactoringExecutor(args.project_root)
        executor.execute_refactoring(args.categories, args.dry_run)

if __name__ == "__main__":
    main()