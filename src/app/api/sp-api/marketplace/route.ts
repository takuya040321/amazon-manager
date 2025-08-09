import { NextRequest, NextResponse } from "next/server"

// 主要なマーケットプレイス情報
const MARKETPLACE_INFO = {
  "A1VC38T7YXB528": {
    name: "Amazon.co.jp",
    country: "日本",
    region: "us-west-2",
    endpoint: "https://sellingpartnerapi-fe.amazon.com",
    currency: "JPY",
    language: "ja-JP"
  },
  "ATVPDKIKX0DER": {
    name: "Amazon.com",
    country: "アメリカ",
    region: "us-east-1", 
    endpoint: "https://sellingpartnerapi-na.amazon.com",
    currency: "USD",
    language: "en-US"
  },
  "A1PA6795UKMFR9": {
    name: "Amazon.de", 
    country: "ドイツ",
    region: "eu-west-1",
    endpoint: "https://sellingpartnerapi-eu.amazon.com",
    currency: "EUR",
    language: "de-DE"
  },
  "A13V1IB3VIYZZH": {
    name: "Amazon.fr",
    country: "フランス", 
    region: "eu-west-1",
    endpoint: "https://sellingpartnerapi-eu.amazon.com",
    currency: "EUR",
    language: "fr-FR"
  },
  "A1F83G8C2ARO7P": {
    name: "Amazon.co.uk",
    country: "イギリス",
    region: "eu-west-1", 
    endpoint: "https://sellingpartnerapi-eu.amazon.com",
    currency: "GBP",
    language: "en-GB"
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const marketplaceId = searchParams.get("id")

    // 特定のMarketplace IDの情報を取得
    if (marketplaceId) {
      const info = MARKETPLACE_INFO[marketplaceId as keyof typeof MARKETPLACE_INFO]
      
      if (!info) {
        return NextResponse.json({
          success: false,
          error: "指定されたMarketplace IDが見つかりません",
          marketplaceId,
          message: "有効なMarketplace IDを指定してください"
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        marketplaceId,
        ...info,
        currentConfig: {
          configuredRegion: process.env.AMAZON_REGION || "未設定",
          configuredMarketplace: process.env.AMAZON_MARKETPLACE_ID || "未設定",
          isCorrectConfiguration: 
            process.env.AMAZON_REGION === info.region &&
            process.env.AMAZON_MARKETPLACE_ID === marketplaceId
        }
      })
    }

    // 全Marketplace一覧を返す
    return NextResponse.json({
      success: true,
      message: "利用可能なMarketplace一覧",
      marketplaces: Object.entries(MARKETPLACE_INFO).map(([id, info]) => ({
        id,
        ...info
      })),
      currentConfig: {
        configuredRegion: process.env.AMAZON_REGION || "未設定",
        configuredMarketplace: process.env.AMAZON_MARKETPLACE_ID || "未設定"
      },
      usage: {
        getAllMarketplaces: "GET /api/sp-api/marketplace",
        getSpecificMarketplace: "GET /api/sp-api/marketplace?id=A1VC38T7YXB528"
      }
    })

  } catch (error) {
    console.error("Marketplace info error:", error)
    
    return NextResponse.json({
      success: false,
      error: "マーケットプレイス情報の取得に失敗しました",
      details: error instanceof Error ? error.message : "未知のエラー"
    }, { status: 500 })
  }
}