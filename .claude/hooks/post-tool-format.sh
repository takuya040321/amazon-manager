#!/bin/bash

# PostToolUse Hook: フォーマッターと型チェック実行
# Write, Edit, MultiEdit ツール使用後に自動実行

set -e

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[FORMAT]${NC} $1"
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

# プロジェクトルートに移動
cd "$CLAUDE_PROJECT_DIR" || exit 1

# package.jsonの存在確認
if [ ! -f "package.json" ]; then
    log_info "package.json not found, skipping format and type check"
    exit 0
fi

log_info "🔧 PostToolUse Hook実行中..."

# 1. フォーマッター実行
if npm run format >/dev/null 2>&1; then
    log_success "✨ コードフォーマット完了"
else
    log_warning "⚠️ フォーマット実行できませんでした (npm run format)"
fi

# 2. 型チェック実行
if command -v tsc >/dev/null 2>&1; then
    if tsc --noEmit >/dev/null 2>&1; then
        log_success "✅ 型チェック通過"
    else
        log_error "❌ 型エラーが検出されました"
        # 型エラーの詳細は表示しない（邪魔になるため）
    fi
elif npm run typecheck >/dev/null 2>&1; then
    log_success "✅ 型チェック完了 (npm run typecheck)"
else
    log_info "ℹ️ 型チェックツールが見つかりません"
fi

# 3. リンター実行（軽量）
if npm run lint >/dev/null 2>&1; then
    log_success "🧹 リンティング完了"
else
    log_info "ℹ️ リンター実行をスキップ"
fi

log_info "🎉 PostToolUse Hook完了"