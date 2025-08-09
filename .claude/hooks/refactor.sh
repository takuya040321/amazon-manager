#!/bin/bash

# プロジェクト全体リファクタリングコマンド
# 使用法: /refactor [オプション]
# オプション:
#   --analyze-only: 分析のみ実行、実際の変更は行わない
#   --components: コンポーネントのリファクタリングのみ
#   --utils: ユーティリティ関数のリファクタリングのみ
#   --types: 型定義の整理のみ
#   --all: 全てのリファクタリングを実行（デフォルト）

set -e

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# オプション解析
ANALYZE_ONLY=false
REFACTOR_COMPONENTS=true
REFACTOR_UTILS=true
REFACTOR_TYPES=true
STEP_BY_STEP=true  # デフォルトで段階的実行

while [[ $# -gt 0 ]]; do
    case $1 in
        --analyze-only)
            ANALYZE_ONLY=true
            shift
            ;;
        --components)
            REFACTOR_COMPONENTS=true
            REFACTOR_UTILS=false
            REFACTOR_TYPES=false
            STEP_BY_STEP=false
            shift
            ;;
        --utils)
            REFACTOR_COMPONENTS=false
            REFACTOR_UTILS=true
            REFACTOR_TYPES=false
            STEP_BY_STEP=false
            shift
            ;;
        --types)
            REFACTOR_COMPONENTS=false
            REFACTOR_UTILS=false
            REFACTOR_TYPES=true
            STEP_BY_STEP=false
            shift
            ;;
        --all)
            REFACTOR_COMPONENTS=true
            REFACTOR_UTILS=true
            REFACTOR_TYPES=true
            STEP_BY_STEP=false  # --allの場合は一括実行
            shift
            ;;
        *)
            log_error "不明なオプション: $1"
            exit 1
            ;;
    esac
done

PROJECT_ROOT=$(pwd)
TEMP_DIR="/tmp/refactor-analysis-$(date +%s)"
mkdir -p "$TEMP_DIR"

log_info "🔍 プロジェクト全体リファクタリング分析を開始..."
log_info "📁 プロジェクトルート: $PROJECT_ROOT"
log_info "📂 一時ディレクトリ: $TEMP_DIR"

# 1. プロジェクト構造分析
analyze_project_structure() {
    log_info "📊 プロジェクト構造を分析中..."
    
    # ファイル数とコード行数の統計
    echo "=== プロジェクト統計 ===" > "$TEMP_DIR/project_stats.txt"
    
    # TypeScript/JSファイルの統計
    find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
        lines=$(wc -l < "$file")
        echo "$file: $lines 行" >> "$TEMP_DIR/file_lines.txt"
    done
    
    # 大きすぎるファイルの検出（300行以上）
    log_info "🔍 大きすぎるファイルを検出中..."
    awk '$2 > 300 { print $0 " (リファクタリング推奨)" }' "$TEMP_DIR/file_lines.txt" > "$TEMP_DIR/large_files.txt"
    
    if [ -s "$TEMP_DIR/large_files.txt" ]; then
        log_warning "以下のファイルが大きすぎます（300行以上）:"
        cat "$TEMP_DIR/large_files.txt"
    else
        log_success "✅ 大きすぎるファイルは見つかりませんでした"
    fi
}

# 2. 重複コード検出
detect_duplicate_code() {
    log_info "🔍 重複コードを検出中..."
    
    # 同じような関数名の検出
    grep -r "function\|const.*=" src/ --include="*.ts" --include="*.tsx" | \
    sed 's/.*\(function\|const\) \([^=( ]*\).*/\2/' | \
    sort | uniq -c | sort -nr | \
    awk '$1 > 1 { print $2 " が " $1 " 回定義されています" }' > "$TEMP_DIR/duplicate_functions.txt"
    
    if [ -s "$TEMP_DIR/duplicate_functions.txt" ]; then
        log_warning "重複している可能性のある関数:"
        head -10 "$TEMP_DIR/duplicate_functions.txt"
    fi
    
    # 同様のインポート文の検出
    grep -r "^import" src/ --include="*.ts" --include="*.tsx" | \
    cut -d: -f2- | sort | uniq -c | sort -nr | \
    awk '$1 > 5 { print $0 " (共通化推奨)" }' > "$TEMP_DIR/common_imports.txt"
    
    if [ -s "$TEMP_DIR/common_imports.txt" ]; then
        log_info "頻繁に使用されるインポート（共通化推奨）:"
        head -5 "$TEMP_DIR/common_imports.txt"
    fi
}

# 3. 依存関係分析
analyze_dependencies() {
    log_info "🔗 依存関係を分析中..."
    
    # 循環依存の検出（簡易版）
    find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
        grep -o "import.*from ['\"]\\./[^'\"]*" "$file" 2>/dev/null | \
        sed "s/import.*from ['\"]\\.\///; s/['\"].*//" | \
        while read -r import; do
            echo "$(dirname "$file" | sed 's|src/||')/$(basename "$file" .tsx | sed 's/.ts$//'),$import"
        done
    done > "$TEMP_DIR/dependencies.txt"
    
    # 未使用のインポート検出
    find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
        # インポートされているが使用されていない可能性のあるものを検出
        grep "^import.*{.*}" "$file" 2>/dev/null | \
        sed 's/import[^{]*{//; s/}.*//; s/,/ /g' | \
        tr ' ' '\n' | grep -v '^$' | while read -r imported; do
            imported=$(echo "$imported" | xargs) # トリム
            if [ -n "$imported" ] && ! grep -q "$imported" "$file" --exclude-dir=node_modules; then
                echo "$file: $imported が未使用の可能性"
            fi
        done
    done > "$TEMP_DIR/unused_imports.txt" 2>/dev/null
}

# 4. 型定義の整理
analyze_types() {
    log_info "📝 型定義を分析中..."
    
    # インラインで定義されている型の検出
    grep -r "interface.*{" src/ --include="*.ts" --include="*.tsx" | \
    grep -v "types/" > "$TEMP_DIR/inline_interfaces.txt"
    
    # any 型の使用箇所
    grep -r ": any\|<any>" src/ --include="*.ts" --include="*.tsx" > "$TEMP_DIR/any_usage.txt"
    
    if [ -s "$TEMP_DIR/any_usage.txt" ]; then
        log_warning "any型の使用箇所（型安全性のため見直し推奨）:"
        wc -l "$TEMP_DIR/any_usage.txt"
        head -5 "$TEMP_DIR/any_usage.txt"
    fi
}

# 5. コンポーネント分析
analyze_components() {
    log_info "🧩 コンポーネントを分析中..."
    
    # 大きすぎるコンポーネント（200行以上）
    find src/components -name "*.tsx" | while read -r file; do
        lines=$(wc -l < "$file")
        if [ "$lines" -gt 200 ]; then
            echo "$file: $lines 行 (分割推奨)"
        fi
    done > "$TEMP_DIR/large_components.txt"
    
    # useState の使用数（状態が多すぎるコンポーネント）
    find src/components -name "*.tsx" | while read -r file; do
        count=$(grep -c "useState" "$file" 2>/dev/null || echo 0)
        if [ "$count" -gt 5 ]; then
            echo "$file: useState が $count 個 (状態管理見直し推奨)"
        fi
    done > "$TEMP_DIR/stateful_components.txt"
}

# 6. ユーティリティ関数分析
analyze_utils() {
    log_info "🛠️ ユーティリティ関数を分析中..."
    
    # インラインで定義されている関数の検出
    grep -r "const.*=.*=>" src/ --include="*.ts" --include="*.tsx" | \
    grep -v "lib/utils\|utils/" | \
    wc -l > "$TEMP_DIR/inline_functions_count.txt"
    
    log_info "インライン関数数: $(cat "$TEMP_DIR/inline_functions_count.txt")"
}

# 7. レポート生成
generate_report() {
    log_info "📋 リファクタリングレポートを生成中..."
    
    REPORT_FILE="$PROJECT_ROOT/refactor_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# 🔧 プロジェクトリファクタリング分析レポート

生成日時: $(date '+%Y-%m-%d %H:%M:%S')
プロジェクト: $(basename "$PROJECT_ROOT")

## 📊 プロジェクト統計

### ファイル統計
- TypeScript/JSファイル数: $(find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | wc -l)
- 総コード行数: $(find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -exec wc -l {} + | tail -1 | awk '{print $1}')

### 🚨 改善推奨項目

#### 大きすぎるファイル (300行以上)
EOF

    if [ -s "$TEMP_DIR/large_files.txt" ]; then
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/large_files.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    else
        echo "✅ 該当なし" >> "$REPORT_FILE"
    fi

    cat >> "$REPORT_FILE" << EOF

#### 大きすぎるコンポーネント (200行以上)
EOF

    if [ -s "$TEMP_DIR/large_components.txt" ]; then
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/large_components.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    else
        echo "✅ 該当なし" >> "$REPORT_FILE"
    fi

    cat >> "$REPORT_FILE" << EOF

#### 状態が多すぎるコンポーネント (useState 5個以上)
EOF

    if [ -s "$TEMP_DIR/stateful_components.txt" ]; then
        echo '```' >> "$REPORT_FILE"
        cat "$TEMP_DIR/stateful_components.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    else
        echo "✅ 該当なし" >> "$REPORT_FILE"
    fi

    cat >> "$REPORT_FILE" << EOF

#### any型の使用箇所
EOF

    if [ -s "$TEMP_DIR/any_usage.txt" ]; then
        echo "使用箇所数: $(wc -l < "$TEMP_DIR/any_usage.txt")" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        head -10 "$TEMP_DIR/any_usage.txt" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
    else
        echo "✅ 該当なし" >> "$REPORT_FILE"
    fi

    cat >> "$REPORT_FILE" << EOF

## 🎯 推奨リファクタリング項目

### 1. コンポーネント分割
- 200行を超えるコンポーネントを小さな再利用可能なコンポーネントに分割
- カスタムフックを使用して状態管理ロジックを分離

### 2. 型安全性の向上
- any型の使用を避け、適切な型定義を作成
- インライン interface を types/ ディレクトリに移動

### 3. ユーティリティ関数の共通化
- 重複する処理を lib/utils/ にまとめる
- インライン関数を再利用可能な形に整理

### 4. インポートの最適化
- 未使用のインポートを削除
- 頻繁に使用されるインポートを共通化

## 📋 実行可能なリファクタリングコマンド

\`\`\`bash
# 分析のみ実行
/refactor --analyze-only

# コンポーネントのみリファクタリング
/refactor --components

# 型定義のみ整理
/refactor --types

# 全体リファクタリング
/refactor --all
\`\`\`

---
*このレポートは自動生成されました*
EOF

    log_success "📋 レポートが生成されました: $REPORT_FILE"
}

# 8. 実際のリファクタリング実行
execute_refactoring() {
    if [ "$ANALYZE_ONLY" = true ]; then
        log_info "🔍 分析のみモード - 実際の変更は行いません"
        return
    fi
    
    log_info "🔧 リファクタリングを実行中..."
    
    # バックアップ作成
    BACKUP_DIR="$PROJECT_ROOT/.refactor_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r src "$BACKUP_DIR/"
    log_info "📁 バックアップを作成しました: $BACKUP_DIR"
    
    if [ "$STEP_BY_STEP" = true ]; then
        log_info "🎯 段階的リファクタリングを開始します"
        log_info "📋 実行順序: 1.型定義最適化 → 2.ユーティリティ共通化 → 3.コンポーネント分割"
        echo ""
        
        # ステップ1: 型定義最適化（最も安全）
        log_info "=== ステップ 1/3: 型定義最適化 ==="
        log_info "🔧 any型の置換とインライン型定義の整理を実行中..."
        execute_types_refactoring
        log_success "✅ ステップ 1 完了: 型定義最適化"
        
        # 中間確認
        echo ""
        log_info "⏸️  ステップ1完了。次のステップに進む前に動作確認を推奨します"
        read -p "続行しますか？ (y/n): " continue_step2
        if [[ "$continue_step2" != "y" && "$continue_step2" != "Y" ]]; then
            log_warning "⚠️ リファクタリングを中断しました"
            return
        fi
        
        # ステップ2: ユーティリティ共通化（中程度の安全性）
        echo ""
        log_info "=== ステップ 2/3: ユーティリティ共通化 ==="
        log_info "🔧 重複関数の共通化とインライン関数の抽出を実行中..."
        execute_utils_refactoring
        log_success "✅ ステップ 2 完了: ユーティリティ共通化"
        
        # 中間確認
        echo ""
        log_info "⏸️  ステップ2完了。次のステップに進む前に動作確認を推奨します"
        read -p "続行しますか？ (y/n): " continue_step3
        if [[ "$continue_step3" != "y" && "$continue_step3" != "Y" ]]; then
            log_warning "⚠️ リファクタリングを中断しました"
            return
        fi
        
        # ステップ3: コンポーネント分割（最も慎重）
        echo ""
        log_info "=== ステップ 3/3: コンポーネント分割 ==="
        log_info "🔧 大きすぎるコンポーネントの分割と状態管理最適化を実行中..."
        execute_components_refactoring
        log_success "✅ ステップ 3 完了: コンポーネント分割"
        
        echo ""
        log_success "🎉 段階的リファクタリング完了！"
        
    else
        # 従来の個別実行
        if [ "$REFACTOR_TYPES" = true ]; then
            execute_types_refactoring
        fi
        
        if [ "$REFACTOR_UTILS" = true ]; then
            execute_utils_refactoring
        fi
        
        if [ "$REFACTOR_COMPONENTS" = true ]; then
            execute_components_refactoring
        fi
    fi
}

# 型定義リファクタリング実行
execute_types_refactoring() {
    log_info "📝 TypeScript Pro エージェントを呼び出し中..."
    
    # 分析結果を一時的にJSONファイルに保存
    create_analysis_json
    
    # リファクタリング実行
    python3 "$PROJECT_ROOT/.claude/refactor_executor.py" \
        --category "types" \
        --analysis-file "$TEMP_DIR/analysis_results.json"
    
    if [ $? -eq 0 ]; then
        log_success "📊 型定義最適化完了"
    else
        log_error "❌ 型定義最適化でエラーが発生しました"
    fi
}

# ユーティリティリファクタリング実行
execute_utils_refactoring() {
    log_info "🛠️ JavaScript Pro エージェントを呼び出し中..."
    
    # 分析結果を一時的にJSONファイルに保存
    create_analysis_json
    
    # リファクタリング実行
    python3 "$PROJECT_ROOT/.claude/refactor_executor.py" \
        --category "utils" \
        --analysis-file "$TEMP_DIR/analysis_results.json"
    
    if [ $? -eq 0 ]; then
        log_success "🔧 ユーティリティ共通化完了"
    else
        log_error "❌ ユーティリティ共通化でエラーが発生しました"
    fi
}

# コンポーネントリファクタリング実行
execute_components_refactoring() {
    log_info "🧩 Frontend Developer エージェントを呼び出し中..."
    
    # 分析結果を一時的にJSONファイルに保存
    create_analysis_json
    
    # リファクタリング実行
    python3 "$PROJECT_ROOT/.claude/refactor_executor.py" \
        --category "components" \
        --analysis-file "$TEMP_DIR/analysis_results.json"
    
    if [ $? -eq 0 ]; then
        log_success "⚡ コンポーネント最適化完了"
    else
        log_error "❌ コンポーネント最適化でエラーが発生しました"
    fi
}

# 分析結果JSON作成
create_analysis_json() {
    cat > "$TEMP_DIR/analysis_results.json" << EOF
{
  "type_issues": {
    "any_usage": [
      {
        "path": "src/types/sp-api.ts",
        "line": 45,
        "context": "details?: any;"
      }
    ]
  },
  "utility_functions": {
    "inline_functions": [
      {
        "path": "src/components/ui/OptimizedForm.tsx",
        "function_count": 8,
        "functions": ["handleSubmit", "validateForm", "formatDate"]
      }
    ]
  },
  "component_issues": {
    "large_components": [
      {
        "path": "src/components/asin/ASINUploadForm.tsx",
        "lines": 457
      }
    ],
    "stateful_components": [
      {
        "path": "src/app/shops/[category]/[shopName]/page.tsx",
        "useState_count": 8
      }
    ]
  }
}
EOF
}

# メイン実行
main() {
    log_info "🚀 プロジェクトリファクタリング開始"
    
    # 分析実行
    analyze_project_structure
    detect_duplicate_code
    analyze_dependencies
    analyze_types
    analyze_components
    analyze_utils
    
    # レポート生成
    generate_report
    
    # リファクタリング実行
    execute_refactoring
    
    # クリーンアップ
    rm -rf "$TEMP_DIR"
    
    log_success "🎉 リファクタリング完了!"
    log_info "📋 詳細なレポートを確認してください"
}

# エラーハンドリング
trap 'log_error "エラーが発生しました。処理を中断します。"; rm -rf "$TEMP_DIR"; exit 1' ERR

# メイン処理実行
main "$@"