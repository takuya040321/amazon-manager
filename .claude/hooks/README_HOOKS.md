# 🪝 Claude Code Hooks設定ガイド

## 概要

このプロジェクトには、Claude Codeの効率性と安全性を向上させる4つのHookが設定されています。

## 🔧 設定済みHooks

### 1. PreToolUse Hook - サブエージェント強制化
**ファイル**: `.claude/hooks/pre-tool-subagent-enforcer.sh`
**対象**: Task tool使用前
**動作**: サブエージェント未指定時に実行を拒否

```bash
🚫 Task tool実行時はサブエージェントの指定が必須です
❌ このTask実行はブロックされました

💡 AIは必ずタスクに最適なサブエージェントを指定してTask toolを再実行してください
```

**利用可能なサブエージェント**:
- 📝 開発・コード: `typescript-pro`, `javascript-pro`, `frontend-developer`, `backend-architect`
- 🔍 調査・分析: `search-specialist`, `error-detective`, `debugger`, `general-purpose`
- 🛠️ インフラ・データ: `deployment-engineer`, `network-engineer`, `database-admin`, `data-engineer`
- 🎨 設計・テスト: `ui-ux-designer`, `test-automator`, `api-documenter`
- 🔒 セキュリティ・AI: `security-auditor`, `incident-responder`, `ai-engineer`
- 🚀 その他: `graphql-architect`, `dx-optimizer`, `context-manager`

### 2. PreToolUse Hook - コード編集安全チェック
**ファイル**: `.claude/hooks/pre-tool-code-safety.sh`
**対象**: Write, Edit, MultiEdit tool使用前
**動作**: 重要ファイル・危険ディレクトリの編集を制御

**保護対象**:
- 重要ファイル: `package.json`, `tsconfig.json`, `.env*` など
- 危険ディレクトリ: `node_modules`, `.git`, `.next` など

### 3. PostToolUse Hook - 自動フォーマット・型チェック
**ファイル**: `.claude/hooks/post-tool-format.sh`
**対象**: Write, Edit, MultiEdit tool使用後
**動作**: コード品質の自動チェック

```bash
✨ npm run format (コードフォーマット)
✅ tsc --noEmit (型チェック)
🧹 npm run lint (リンティング)
```

### 4. Stop Hook - 処理完了通知
**ファイル**: `.claude/hooks/stop-notification.sh`
**対象**: Claude Code停止時
**動作**: システム通知音＋通知センター表示

```bash
🎵 macOS通知音再生 (Glass.aiff)
📱 通知センターへの通知表示
```

## 🎯 効果

### 品質向上
- **必須サブエージェント**: タスクに最適な専門エージェントが必ず使用される
- **コード品質**: 編集後の自動フォーマット・型チェック
- **安全性**: 重要ファイルの誤編集防止

### 開発体験向上
- **専門性**: 25種類の専門エージェントによる高品質な処理
- **通知**: 処理完了の確実な通知
- **自動化**: 手動でのフォーマット・チェックが不要

## 📋 設定ファイル

**グローバル設定**: `~/.config/claude-code/settings.json`
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-tool-subagent-enforcer.sh"}]
      },
      {
        "matcher": "Write|Edit|MultiEdit", 
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-tool-code-safety.sh"}]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/post-tool-format.sh"}]
      }
    ],
    "Stop": [
      {
        "hooks": [{"type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-notification.sh"}]
      }
    ]
  }
}
```

## 🔧 カスタマイズ

各Hookスクリプトは用途に応じてカスタマイズ可能です:
- エージェント一覧の追加/削除
- 保護ファイルリストの変更
- フォーマットコマンドの調整
- 通知音の変更

---

*これらのHooksにより、Claude Codeはより安全で効率的な開発アシスタントとして機能します*