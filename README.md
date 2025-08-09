# Amazon Manager

Amazon SP-API連携Webアプリケーション

## 概要

AmazonセラーのためのWebアプリケーションです。Amazon SP-APIと連携して注文情報の取得・管理を行い、レビュー依頼の自動送信機能を提供します。

## 主要機能

### ✨ レビュー依頼機能
- **自動対象抽出**: 発送済み・30日以内・未送信の注文を自動判定
- **一斉送信**: 複数注文に対するバッチレビュー依頼送信
- **送信状況管理**: レビュー依頼の送信状況を追跡・管理
- **カスタマイズ可能メール**: 日本語対応の丁寧なレビュー依頼メール

### 📦 注文管理機能
- Amazon SP-APIからのリアルタイム注文データ取得
- 注文一覧表示とフィルタリング
- 統計情報ダッシュボード
- キャッシュ機能による高速データ表示

### 🚀 パフォーマンス機能
- **スマートキャッシュ**: アプリ起動時に自動データ取得・30分間キャッシュ
- **画面遷移高速化**: キャッシュデータによる瞬時画面表示
- **バッチ処理**: 大量データの効率的処理

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS + shadcn/ui
- **API連携**: Amazon SP-API（直接連携）
- **状態管理**: React Hooks + カスタムフック
- **データ管理**: メモリベースキャッシュ（データベース不使用）

## セットアップ

### 1. 環境変数の設定

`.env.local`ファイルを作成し、以下を設定：

\`\`\`env
# Amazon SP-API Configuration
AMAZON_REFRESH_TOKEN=your_refresh_token_here
AMAZON_CLIENT_ID=your_client_id_here
AMAZON_CLIENT_SECRET=your_client_secret_here
AMAZON_REGION=us-east-1
AMAZON_MARKETPLACE_ID=A1VC38T7YXB528

# Email Service Configuration
EMAIL_API_KEY=your_email_api_key_here
EMAIL_FROM=noreply@yourdomain.com

# プロキシ設定（オプション）
USE_PROXY=false
PROXY_SERVER=http://150.61.8.70:10080
PROXY_USER=your_username
PROXY_PASS=your_password
\`\`\`

### 2. 依存関係のインストール

\`\`\`bash
npm install
\`\`\`

### 3. 開発サーバーの起動

\`\`\`bash
npm run dev
\`\`\`

[http://localhost:3000](http://localhost:3000)でアプリにアクセス

## 使用方法

### レビュー依頼の送信

1. **注文管理画面**にアクセス
2. **レビュー依頼可能**な注文を確認（青いバッジ表示）
3. 送信したい注文にチェック
4. **「選択した○件にレビュー依頼」**ボタンをクリック
5. 送信完了後、ステータスが**「送信済み」**に更新

### 対象条件
- ✅ 発送済み・配送中・完了ステータス
- ✅ 30日以内の注文
- ✅ レビュー依頼未送信
- ✅ 顧客メールアドレス有り

## 開発コマンド

\`\`\`bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# リンティング
npm run lint

# 本番サーバー起動
npm start
\`\`\`

## プロジェクト構造

\`\`\`
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   └── orders/        # 注文API
│   ├── orders/            # 注文管理画面
│   └── ...
├── components/            # UIコンポーネント
├── hooks/                 # カスタムフック
├── lib/                   # ユーティリティ
│   ├── amazon-api.ts     # Amazon SP-API連携
│   ├── cache.ts          # キャッシュシステム
│   └── review-service.ts # レビュー依頼サービス
└── types/                 # 型定義
    └── order.ts          # 注文関連型
\`\`\`

## 主要な設計原則

### アーキテクチャ
- **関心の分離**: UI/ロジック/データアクセスを明確に分離
- **型安全性**: TypeScriptによる厳密な型定義
- **再利用性**: カスタムフックによるロジック共有

### パフォーマンス
- **キャッシュファースト**: APIコール最小化
- **バッチ処理**: 大量データ効率処理
- **レスポンシブUI**: ローディング状態の適切な表示

### セキュリティ
- **環境変数管理**: 機密情報の安全な分離
- **API認証**: 適切なトークン管理
- **エラーハンドリング**: 堅牢なエラー処理

## 貢献・サポート

このプロジェクトについて質問や提案がある場合は、Issueを作成してください。

## ライセンス

MIT License