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

#### 本番環境の場合
Amazon SP-APIの認証情報を取得済みの場合：

\`\`\`env
# Amazon SP-API Configuration
AMAZON_REFRESH_TOKEN=Atzr|IwEBIA...your_actual_refresh_token
AMAZON_CLIENT_ID=amzn1.application-oa2-client.your_client_id
AMAZON_CLIENT_SECRET=your_actual_client_secret
AMAZON_REGION=us-west-2
AMAZON_MARKETPLACE_ID=A1VC38T7YXB528

# 本番モード設定
USE_MOCK_DATA=false
DEBUG_API_CALLS=false
\`\`\`

#### 開発・テスト環境の場合
SP-API認証設定前でもモックデータでテストできます：

\`\`\`env
# Amazon SP-API Configuration（空でもOK）
AMAZON_REFRESH_TOKEN=
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REGION=us-west-2
AMAZON_MARKETPLACE_ID=A1VC38T7YXB528

# モックモード設定（開発時）
USE_MOCK_DATA=true
DEBUG_API_CALLS=true
\`\`\`

#### その他の設定

\`\`\`env
# Email Service Configuration（レビュー依頼用）
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

### 4. SP-API認証設定（本番環境）

本格的にAmazon SP-APIを使用する場合の設定手順：

1. **設定画面にアクセス**: アプリの「SP-API設定」メニューから設定ページを開く
2. **接続テスト実行**: 「接続テストを実行」ボタンで現在の設定状況を確認
3. **Amazon Developer Console**: 指示に従ってアプリケーション登録とLWA認証設定
4. **Seller Central**: アプリケーション承認とRefresh Token取得
5. **環境変数更新**: 取得した認証情報を`.env.local`に設定
6. **本番テスト**: 設定完了後、再度接続テストで実際のAPIを確認

詳細な手順は `docs/sp-api-setup.md` を参照してください。

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