# Amazon SP-API 認証設定ガイド

## 概要

Amazon SP-APIを使用するには、Amazon Developer Consoleでアプリケーションを登録し、必要な認証情報を取得する必要があります。

## 必要な認証情報

1. **LWA Client ID**: Login with Amazon クライアントID
2. **LWA Client Secret**: Login with Amazon クライアントシークレット
3. **Refresh Token**: アクセストークン取得用のリフレッシュトークン
4. **Marketplace ID**: 対象マーケットプレイスのID
5. **Region**: API エンドポイントのリージョン

## 設定手順

### Step 1: Amazon Developer Console でアプリケーション登録

1. **Amazon Developer Console にアクセス**
   - https://developer.amazon.com/ にアクセス
   - Amazon セラーアカウントでサインイン

2. **新しいアプリケーションを作成**
   - 「アプリ&サービス」→「Login with Amazon」を選択
   - 「新しいセキュリティプロファイルを作成」をクリック

3. **セキュリティプロファイルの設定**
   - **名前**: Amazon Manager（任意の名前）
   - **説明**: Amazon SP-API連携Webアプリケーション
   - **プライバシー規約URL**: https://yoursite.com/privacy（後で設定可能）

4. **Client ID と Client Secret を取得**
   - 作成後、「Client ID」と「Client Secret」をメモ

### Step 2: SP-API アクセス権限の設定

1. **Seller Central にアクセス**
   - https://sellercentral.amazon.co.jp/ にログイン
   
2. **アプリケーションの承認**
   - 「設定」→「ユーザー権限」
   - 「サードパーティ開発者およびアプリを管理する」
   - 先ほど作成したアプリケーションを承認

3. **Refresh Token の取得**
   - 承認プロセス中に表示されるRefresh Tokenをメモ

### Step 3: マーケットプレイス情報の確認

#### Marketplace ID の確認方法

1. **Seller Central で確認**：
   - https://sellercentral.amazon.co.jp/ にログイン
   - 「設定」→「アカウント情報」→「ビジネス情報」
   - 「Amazon マーケットプレイス Web サービス」セクションにMarketplace IDが記載

2. **よく使用される日本のMarketplace ID**：
   - **A1VC38T7YXB528**: Amazon.co.jp（日本）
   - ただし、実際のIDは上記方法で確認することを推奨

3. **その他の地域**（参考）：
   - **ATVPDKIKX0DER**: Amazon.com（アメリカ）
   - **A1PA6795UKMFR9**: Amazon.de（ドイツ）
   - **A13V1IB3VIYZZH**: Amazon.fr（フランス）

#### SP-APIエンドポイント設定

日本のAmazonの場合：
- **Region**: `us-west-2`（これは正しい設定です）
- **Base URL**: `https://sellingpartnerapi-fe.amazon.com`
- **Marketplace ID**: 上記方法で確認したID

### Step 4: 環境変数の設定

`.env.local` ファイルに以下を設定：

```env
# Amazon SP-API Configuration
AMAZON_REFRESH_TOKEN=Atzr|IwEBIA...（取得したRefresh Token）
AMAZON_CLIENT_ID=amzn1.application-oa2-client.xxx（取得したClient ID）
AMAZON_CLIENT_SECRET=abcd1234...（取得したClient Secret）
AMAZON_REGION=us-west-2
AMAZON_MARKETPLACE_ID=A1VC38T7YXB528

# Email Service (後で設定)
EMAIL_API_KEY=
EMAIL_FROM=
```

## トラブルシューティング

### よくある問題

1. **「Access Denied」エラー**
   - Seller Central でアプリケーションが正しく承認されているか確認
   - Refresh Token が正しく設定されているか確認

2. **「Invalid Marketplace」エラー**
   - Marketplace ID が正しいか確認
   - 対象マーケットプレイスでの販売権限があるか確認

3. **「Token Expired」エラー**
   - Refresh Token の有効期限切れ
   - 新しいRefresh Tokenを取得する必要あり

### デバッグ用エンドポイント

認証テスト用のエンドポイントを作成し、接続テストを行うことができます：

```
GET /api/sp-api/test
```

## 注意事項

- **Refresh Token は機密情報**です。絶対に公開しないでください
- Token の有効期限は通常1年間です
- 本番環境では適切なエラーハンドリングを実装してください
- Rate Limit（API呼び出し制限）に注意してください

## 参考リンク

- [Amazon SP-API Developer Guide](https://developer-docs.amazon.com/sp-api/)
- [Login with Amazon Developer Guide](https://developer.amazon.com/ja/docs/login-with-amazon/documentation-overview.html)
- [SP-API Endpoints](https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints)