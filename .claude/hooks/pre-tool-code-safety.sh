#!/bin/bash

# PreToolUse Hook: コード編集前の安全チェック
# Write, Edit, MultiEdit実行前に重要ファイルの保護チェック

set -e

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ログ関数
log_info() {
    echo -e "${BLUE}[SAFETY]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[DANGER]${NC} $1"
}

# 標準入力からTool呼び出し情報を読み取り
TOOL_INPUT=$(cat)

# ファイルパスを抽出
FILE_PATH=""
if echo "$TOOL_INPUT" | grep -q '"file_path"'; then
    FILE_PATH=$(echo "$TOOL_INPUT" | grep '"file_path"' | sed 's/.*"file_path":\s*"\([^"]*\)".*/\1/')
fi

# 重要ファイルのリスト
CRITICAL_FILES=(
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "next.config.js"
    ".env"
    ".env.local"
    ".env.production"
    "supabase/config.toml"
    "CLAUDE.md"
)

# 重要ディレクトリのリスト
CRITICAL_DIRS=(
    "node_modules"
    ".git"
    ".next"
    "dist"
    "build"
)

if [ -n "$FILE_PATH" ]; then
    FILENAME=$(basename "$FILE_PATH")
    
    # 重要ファイルのチェック
    for critical_file in "${CRITICAL_FILES[@]}"; do
        if [ "$FILENAME" = "$critical_file" ]; then
            log_warning "⚠️ 重要ファイルの編集: $critical_file"
            log_info "💡 このファイルの変更はプロジェクトに大きな影響を与える可能性があります"
            
            echo '{
                "permissionDecision": "ask",
                "permissionDecisionReason": "重要な設定ファイル ('$critical_file') を編集しようとしています。この変更はプロジェクト全体に影響する可能性があります。続行しますか？"
            }'
            exit 0
        fi
    done
    
    # 重要ディレクトリのチェック
    for critical_dir in "${CRITICAL_DIRS[@]}"; do
        if echo "$FILE_PATH" | grep -q "/$critical_dir/" || echo "$FILE_PATH" | grep -q "^$critical_dir/"; then
            log_error "🚨 危険: $critical_dir ディレクトリ内のファイル編集"
            
            echo '{
                "permissionDecision": "deny",
                "permissionDecisionReason": "危険なディレクトリ ('$critical_dir') 内のファイル編集はブロックされました。手動で編集してください。"
            }'
            exit 0
        fi
    done
    
    log_success "✅ ファイル編集の安全性チェック通過: $FILENAME"
fi

# 通常の実行を許可
echo '{"permissionDecision": "allow"}'
exit 0