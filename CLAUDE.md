# CLAUDE.md

このファイルは、このリポジトリで作業する際にClaude Code (claude.ai/code) に指針を提供します。

## Claudeへの指示（日本語応答設定）

- すべての応答を日本語で出力してください。

## データベース管理方針

### マイグレーションファイル管理
- **保存場所**: `supabase/migrations/`
- **命名規則**: `YYYYMMDDHHmmss_説明.sql` 形式（タイムスタンプ＋わかりやすい英語説明）
- **作成方針**: 必ず「新規ファイル」として作成（既存ファイルの上書きは禁止）
- **履歴管理**: 一つのファイルの使い回しや上書き保存は禁止、履歴に沿って新規作成を徹底

**命名例**:
```
20250801090000_add_users_table.sql
20250802093000_update_email_column.sql
```

### スキーマファイル管理
- **保存場所**: `supabase/schema/`
- **役割**: 現時点のデータベース構造の設計図（スナップショット）
- **命名規則**: 内容が明確に分かるわかりやすい名前（英語表記、スネークケース形式）
- **タイムスタンプ**: 含めない（マイグレーションファイルとの区別）
- **内容**: DDL定義のみ、機密情報は含めない

**命名例**:
```
core-tables-schema.sql       # 基本テーブル群
product-management-schema.sql # 商品管理関連
api-integration-schema.sql   # API連携関連
```

### ドキュメント連携
- マイグレーションやスキーマ定義の変更点は、必ず `docs/database-design.md` または関連する仕様ドキュメントにも反映
- スキーマファイルの変更・更新時は関連仕様書も同時更新

## プロジェクト情報

### プロジェクト概要
プロジェクトの詳細な仕様や構成については、以下を参照してください：

- **README.md**: プロジェクトの基本情報、セットアップ方法
- **docs/**: 詳細な仕様書とドキュメント
  - `docs/system-specification.md`: システム仕様書
  - `docs/api-specification.md`: API仕様書
  - `docs/database-design.md`: データベース設計書
  - `docs/architecture-diagram.md`: アーキテクチャ図
  - その他技術ドキュメント

### 仕様書更新方針
- **今後の仕様書更新は `docs/` ディレクトリの該当ファイルに記載してください**
- CLAUDE.mdではなく、適切な仕様書ファイルを更新してください
- 新機能や変更は関連するドキュメントファイルに反映してください

## 開発コマンド

### 基本コマンド
- `npm run dev` - 開発サーバー起動 (localhost:3000)
- `npm run build` - 本番ビルド
- `npm run start` - 本番サーバー起動
- `npm run lint` - Next.js リンティング実行
- `npm run format` - ESLint修正とPrettier整形実行

### テスト・品質管理
- 特定のテストコマンドは設定されていません - 必要に応じてユーザーに確認
- リンティングはNext.js組み込みのESLint設定で処理
- Prettierがコード整形に設定済み

## 環境設定

### 必要な環境変数
`.env.local`に以下の環境変数を設定：

#### 統一プロキシ設定（スクレイピング・データベース共用）
```
USE_PROXY=true|false
PROXY_SERVER=http://150.61.8.70:10080
PROXY_USER=your_username
PROXY_PASS=your_password
```

**重要**: 
- `USE_PROXY=false` でプロキシを完全に無効化できます
- 統一プロキシ設定により、スクレイピングとデータベースアクセスで同じプロキシ設定を使用します

#### プロキシ設定の優先順位
1. `USE_PROXY=false` による無効化（最優先）
2. 環境変数 (`PROXY_SERVER`, `PROXY_USER`, `PROXY_PASS`)
3. データベース内設定 (`proxy_settings`テーブル)
4. プロキシなし（直接接続）

## 開発ガイドライン

### TypeScript設定
- パスエイリアス: `@/*`は`./src/*`にマップ
- 柔軟性のためストリクトモードは無効
- 主要な型は`src/types/product.ts`で定義

### コード品質
- NEVER assume that a given library is available, even if it is well known
- When creating new components, follow existing patterns and conventions
- Always follow security best practices
- DO NOT ADD COMMENTS unless asked

### Next.jsベストプラクティス
- **サーバーコンポーネントの優先使用**: クライアントコンポーネント（"use client"）は必要な場合のみ使用
- **静的生成の活用**: 可能な限りSSG（Static Site Generation）を活用
- **適切なフェッチング**: Server ComponentsではfetchまたはReact Query、Client ComponentsではSWRまたはReact Queryを使用
- **レイアウトとページの適切な使い分け**: 共通部分はlayout.tsxに記述
- **パフォーマンス最適化**: 
  - 画像はnext/imageを使用
  - 動的インポートを活用
  - バンドルサイズを意識

### アーキテクチャ原則

#### 関心の分離（UI/ロジック分離）
- **UIコンポーネント**: 表示ロジックのみに専念
- **カスタムフック**: ビジネスロジックと状態管理を担当
- **サービス層**: API通信やデータ処理を分離
- **型定義**: ビジネスロジックに関わる型は独立して定義

#### 制御フロー
- **早期リターン**: if文でのネストを避け、条件不一致時は早期リターンを実行
- **ガード節の活用**: 異常系や前提条件チェックは関数の最初で処理
- **三項演算子の制限**: 複雑な条件分岐は避け、可読性を優先

### コーディング規約
- **文字列リテラル**: 文字列をコードに記述する際は、シングルクォート（'）ではなく**ダブルクォート（"）**を使用してください
- **条件分岐**: ネストが深くならないよう早期リターンを実施

### 重要な注意事項
- **仕様変更や新機能の追加時は、必ず `docs/` の該当する仕様書を更新してください**
- コミット前に関連ドキュメントの更新も含めてください
- 大きな変更の場合は複数の仕様書ファイルの更新が必要な場合があります

### ドキュメント作成・更新ガイドライン
- **コードサンプルを含めない**: `docs/` ディレクトリの仕様書にはTypeScript、JavaScript、SQL、JSON等のコードサンプルを記載しないでください
- **日本語説明で記述**: 技術的な内容は日本語の説明文で記載し、具体的なコード例は避けてください
- **mermaid図の使用可**: アーキテクチャ図やシーケンス図などのmermaid記法は使用可能です
- **簡潔で明確な文書**: 可読性を重視し、構造化された日本語ドキュメントを作成してください