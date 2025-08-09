import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"

export async function GET(request: NextRequest) {
  try {
    console.log("SP-API認証テスト開始...")

    // 環境変数の確認
    const config = {
      hasRefreshToken: !!process.env.AMAZON_REFRESH_TOKEN,
      hasClientId: !!process.env.AMAZON_CLIENT_ID,
      hasClientSecret: !!process.env.AMAZON_CLIENT_SECRET,
      region: process.env.AMAZON_REGION || "us-west-2",
      marketplace: process.env.AMAZON_MARKETPLACE_ID || "A1VC38T7YXB528",
      useMockData: process.env.USE_MOCK_DATA === "true",
      debugMode: process.env.DEBUG_API_CALLS === "true",
    }

    console.log("環境変数確認:", config)

    // モックモードではない場合のみ必須設定チェック
    if (!config.useMockData && (!config.hasRefreshToken || !config.hasClientId || !config.hasClientSecret)) {
      return NextResponse.json({
        success: false,
        error: "SP-API認証設定が不完全です",
        config: {
          ...config,
          refreshToken: config.hasRefreshToken ? "設定済み" : "未設定",
          clientId: config.hasClientId ? "設定済み" : "未設定",
          clientSecret: config.hasClientSecret ? "設定済み" : "未設定",
        },
        message: "必要な環境変数を.env.localに設定してください（またはUSE_MOCK_DATA=trueでモックモードを使用）"
      }, { status: 400 })
    }

    // モックモードの場合
    if (config.useMockData) {
      console.log("モックモードでテスト実行")
      const mockOrders = await amazonApiService.getOrders()
      
      return NextResponse.json({
        success: true,
        mode: "mock",
        message: "モックデータでの接続テスト成功",
        config,
        data: {
          ordersCount: mockOrders.orders.length,
          lastUpdated: mockOrders.lastUpdated,
        }
      })
    }

    // 実際のAPI接続テスト
    console.log("実際のSP-APIに接続テスト開始...")
    
    // 過去7日間の注文を少量取得してテスト
    const testDate = new Date()
    testDate.setDate(testDate.getDate() - 7)
    
    const testOrders = await amazonApiService.getOrders({
      createdAfter: testDate.toISOString(),
      maxResultsPerPage: 5, // テストなので少量
    })

    console.log("SP-API接続テスト成功")

    return NextResponse.json({
      success: true,
      mode: "live",
      message: "SP-API認証・接続テスト成功",
      config: {
        region: config.region,
        marketplace: config.marketplace,
        debugMode: config.debugMode,
      },
      data: {
        ordersCount: testOrders.orders.length,
        lastUpdated: testOrders.lastUpdated,
        sampleOrder: testOrders.orders.length > 0 ? {
          id: testOrders.orders[0].amazonOrderId,
          date: testOrders.orders[0].purchaseDate,
          status: testOrders.orders[0].orderStatus,
          amount: testOrders.orders[0].totalAmount,
        } : null,
      }
    })

  } catch (error) {
    console.error("SP-API認証テストエラー:", error)
    
    const errorMessage = error instanceof Error ? error.message : "未知のエラー"
    
    // エラータイプに応じた詳細なメッセージ
    let troubleshooting = "一般的なエラーです。"
    
    if (errorMessage.includes("Token refresh failed")) {
      troubleshooting = "Refresh Tokenが無効または期限切れです。Amazon Developer Consoleで新しいトークンを取得してください。"
    } else if (errorMessage.includes("Access Denied")) {
      troubleshooting = "SP-APIへのアクセス権限がありません。Seller Centralでアプリケーションが承認されているか確認してください。"
    } else if (errorMessage.includes("Invalid Marketplace")) {
      troubleshooting = "マーケットプレイスIDが正しくないか、該当マーケットプレイスでの販売権限がありません。"
    } else if (errorMessage.includes("設定が不完全")) {
      troubleshooting = "環境変数が正しく設定されていません。.env.localファイルを確認してください。"
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      troubleshooting,
      timestamp: new Date().toISOString(),
      config: {
        hasRefreshToken: !!process.env.AMAZON_REFRESH_TOKEN,
        hasClientId: !!process.env.AMAZON_CLIENT_ID,
        hasClientSecret: !!process.env.AMAZON_CLIENT_SECRET,
        region: process.env.AMAZON_REGION || "us-west-2",
        marketplace: process.env.AMAZON_MARKETPLACE_ID || "A1VC38T7YXB528",
      }
    }, { status: 500 })
  }
}