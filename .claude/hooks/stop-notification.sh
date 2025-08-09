#!/bin/bash

# Stop Hook: Claude Code停止時の通知音
# Claude Code停止時に自動実行

set -e

# カラー出力用
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[NOTIFY]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_info "🔔 Claude Code停止通知中..."

# macOS通知音を再生
if command -v afplay >/dev/null 2>&1; then
    # システム通知音の再生 (macOS)
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || \
    afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || \
    afplay /System/Library/Sounds/Purr.aiff 2>/dev/null || \
    osascript -e 'beep 2' 2>/dev/null
    
    log_success "🎵 通知音再生完了"
    
elif command -v osascript >/dev/null 2>&1; then
    # AppleScript経由でシステムbeep (macOS)
    osascript -e 'beep 2' 2>/dev/null
    log_success "🔔 システムbeep完了"
    
elif command -v paplay >/dev/null 2>&1; then
    # Linux (PulseAudio)
    paplay /usr/share/sounds/alsa/Front_Left.wav 2>/dev/null || \
    echo -e '\a' # ターミナルベル
    log_success "🔔 通知音再生完了 (Linux)"
    
else
    # フォールバック: ターミナルベル
    echo -e '\a'
    log_success "🔔 ターミナルベル完了"
fi

# オプション: macOS通知センターへの通知
if command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "Claude Code processing completed" with title "Claude Code" sound name "Glass"' 2>/dev/null || true
    log_success "📱 通知センター通知完了"
fi

log_info "✨ Stop Hook完了"