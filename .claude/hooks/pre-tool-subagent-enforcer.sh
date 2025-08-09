#!/bin/bash

# PreToolUse Hook: サブエージェント必須化
# Task tool使用時にサブエージェント未指定の場合は実行を拒否

set -e

# カラー出力用
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ログ関数
log_info() {
    echo -e "${BLUE}[SUBAGENT]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[ENFORCER]${NC} $1"
}

log_error() {
    echo -e "${RED}[BLOCKED]${NC} $1"
}

log_tip() {
    echo -e "${CYAN}[TIP]${NC} $1"
}

# 標準入力からTool呼び出し情報を読み取り
TOOL_INPUT=$(cat)

# Task toolの呼び出しかチェック
if echo "$TOOL_INPUT" | grep -q '"tool_name":\s*"Task"'; then
    
    # subagent_typeが指定されているかチェック
    if echo "$TOOL_INPUT" | grep -q '"subagent_type"'; then
        # 指定されている場合: 実行を許可
        SUBAGENT_TYPE=$(echo "$TOOL_INPUT" | grep '"subagent_type"' | sed 's/.*"subagent_type":\s*"\([^"]*\)".*/\1/')
        log_success "✅ サブエージェント指定確認: $SUBAGENT_TYPE"
        
        # JSON応答: 実行を許可
        echo '{"permissionDecision": "allow"}'
        exit 0
        
    else
        # 指定されていない場合: 実行を拒否
        log_error "🚫 Task tool実行時はサブエージェントの指定が必須です"
        echo ""
        log_warning "❌ このTask実行はブロックされました"
        echo ""
        log_info "🤖 AIは以下から適切なサブエージェントを必ず選択してください:"
        echo ""
        
        # エージェント一覧を簡潔に表示
        log_tip "📝 開発・コード: typescript-pro, javascript-pro, frontend-developer, backend-architect"
        log_tip "🔍 調査・分析: search-specialist, error-detective, debugger, general-purpose"
        log_tip "🛠️ インフラ・データ: deployment-engineer, network-engineer, database-admin, data-engineer"
        log_tip "🎨 設計・テスト: ui-ux-designer, test-automator, api-documenter"
        log_tip "🔒 セキュリティ・AI: security-auditor, incident-responder, ai-engineer"
        log_tip "🚀 その他: graphql-architect, dx-optimizer, context-manager"
        echo ""
        
        log_error "💡 AIは必ずタスクに最適なサブエージェントを指定してTask toolを再実行してください"
        
        # JSON応答: 実行を拒否
        echo '{
            "permissionDecision": "deny",
            "permissionDecisionReason": "🚫 Task tool実行時はサブエージェントの指定が必須です。AIは以下から適切なサブエージェントを選択してTask toolを再実行してください:\n\n📝 開発・コード: typescript-pro, javascript-pro, frontend-developer, backend-architect\n🔍 調査・分析: search-specialist, error-detective, debugger, general-purpose\n🛠️ インフラ・データ: deployment-engineer, network-engineer, database-admin, data-engineer\n🎨 設計・テスト: ui-ux-designer, test-automator, api-documenter\n🔒 セキュリティ・AI: security-auditor, incident-responder, ai-engineer\n🚀 その他: graphql-architect, dx-optimizer, context-manager\n\n💡 タスクの内容に基づいて最適なサブエージェントを必ず指定してください。"
        }'
        exit 0
    fi
else
    # Task tool以外の場合は通常通り実行
    echo '{"permissionDecision": "allow"}'
    exit 0
fi