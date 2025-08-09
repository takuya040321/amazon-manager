import { NextRequest, NextResponse } from "next/server";
import { RakutenClient, RakutenItemSearchParams } from "@/lib/api-clients/rakuten-client";

export async function POST(request: NextRequest) {
  try {
    const { shopCode, genreId, keyword } = await request.json();
    
    // パラメータ検証
    if (!shopCode) {
      return NextResponse.json(
        { success: false, error: "shopCodeは必須です" },
        { status: 400 }
      );
    }

    // 楽天API キーの確認
    const rakutenApiKey = process.env.RAKUTEN_APPLICATION_ID;
    if (!rakutenApiKey) {
      return NextResponse.json(
        { success: false, error: "楽天API キー(RAKUTEN_APPLICATION_ID)が設定されていません" },
        { status: 500 }
      );
    }

    console.log("🧪 楽天API直接テスト開始");
    console.log("📋 パラメータ:", { shopCode, genreId, keyword });

    // 楽天クライアント初期化
    const client = new RakutenClient();

    // API リクエストパラメータ構築
    const searchParams: RakutenItemSearchParams = {
      applicationId: rakutenApiKey,
      shopCode: shopCode,
      ...(genreId && { genreId }),
      ...(keyword && { keyword }),
      page: 1,
      hits: 30,
      sort: "standard"
    };

    // リクエストURL構築（表示用）
    const baseUrl = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
    const urlParams = new URLSearchParams({
      applicationId: rakutenApiKey,
      format: "json",
      formatVersion: "2",
      shopCode: shopCode,
      ...(genreId && { genreId }),
      ...(keyword && { keyword }),
      page: "1",
      hits: "30",
      sort: "standard",
    });
    const fullRequestUrl = `${baseUrl}?${urlParams.toString()}`;

    console.log("🌐 リクエストURL:", fullRequestUrl);

    // 楽天API実行
    const startTime = Date.now();
    const response = await client.searchItems(searchParams);
    const duration = Date.now() - startTime;

    console.log(`✅ 楽天API完了 (${duration}ms)`);
    console.log("📊 取得結果:", {
      商品数: response.Items?.length || 0,
      ページ: response.page,
      総ページ数: response.pageCount,
      ヒット数: response.hits
    });

    // レスポンス情報をログ出力
    if (response.Items && response.Items.length > 0) {
      console.log("🔍 APIレスポンス構造確認:");
      console.log("- 全体構造:", JSON.stringify(response.Items[0], null, 2));
      console.log("🔍 最初の商品例:", {
        商品名: response.Items[0]?.itemName,
        価格: response.Items[0]?.itemPrice,
        ショップ: response.Items[0]?.shopName,
        ブランド: response.Items[0]?.brandName || "未設定",
        画像URL: response.Items[0]?.mediumImageUrls?.[0]
      });
    }

    return NextResponse.json({
      success: true,
      message: "楽天API直接テスト完了",
      requestUrl: fullRequestUrl,
      requestParams: searchParams,
      duration: `${duration}ms`,
      data: response,
      summary: {
        商品数: response.Items?.length || 0,
        ページ: response.page,
        総ページ数: response.pageCount,
        ヒット数: response.hits,
        取得時間: `${duration}ms`
      }
    });

  } catch (error) {
    console.error("❌ 楽天API直接テストエラー:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "楽天APIテストに失敗しました",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}