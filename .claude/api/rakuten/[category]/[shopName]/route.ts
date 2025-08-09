import { NextRequest } from "next/server";
import { RakutenProductFetcher, RakutenFetchConfig } from "@/lib/scrapers/rakuten-product-fetcher";
import { ASINPreservingScraper } from "@/lib/scrapers/asin-preserving-scraper";
import { ProxyController } from "@/lib/proxy/proxy-controller";
import { BaseApiHandler } from "@/lib/api/base-api-handler";

import { createServerSupabaseClient } from "@/lib/supabase";
import { RakutenShopConfig } from "@/types/rakuten";

class RakutenApiHandler extends BaseApiHandler {
  protected getEndpointName(): string {
    return "楽天API";
  }

  async handleRequest(request: NextRequest, params: { category: string; shopName: string }) {
    const { category, shopName } = params;
    
    // カテゴリ検証
    if (category !== "rakuten") {
      return this.createErrorResponse("VALIDATION_ERROR", "無効なカテゴリです", 400);
    }

    // データベースから楽天ショップ設定を取得
    const supabase = await createServerSupabaseClient();
    const { data: shopConfig, error: configError } = await supabase
      .from("rakuten_shop_configs")
      .select("*")
      .eq("shop_name", shopName)
      .eq("is_active", true)
      .single();

    if (configError || !shopConfig) {
      return this.createErrorResponse("VALIDATION_ERROR", `楽天ショップ設定が見つかりません: ${shopName}`, 404);
    }

    // 楽天フェッチ設定を作成
    const fetchConfig: RakutenFetchConfig = {
      shopCode: shopConfig.shop_code,
      genreId: shopConfig.genre_id || undefined,
      keyword: shopConfig.keyword || undefined
    };

    // 楽天API キーの確認
    const rakutenApiKey = process.env.RAKUTEN_APPLICATION_ID;
    if (!rakutenApiKey) {
      return this.createErrorResponse("CONFIGURATION_ERROR", "楽天API キーが設定されていません", 500);
    }

    try {
      const result = await this.executeFetchProcess(rakutenApiKey, fetchConfig, category, shopName);
      
      return this.createSuccessResponse({
        message: "楽天商品取得が完了しました",
        shopName,
        category,
        ...result
      });

    } catch (error) {
      console.error("楽天商品取得エラー:", error);
      return this.createErrorResponse(
        "SCRAPING_ERROR",
        error instanceof Error ? error.message : "楽天商品取得に失敗しました",
        500
      );
    }
  }

  private async executeFetchProcess(
    rakutenApiKey: string,
    fetchConfig: RakutenFetchConfig,
    category: string,
    shopName: string
  ) {
    // プロキシ設定を取得
    const dbConfig = await ProxyController.getDatabaseConfig();
    console.log(dbConfig.logMessage);

    // 楽天商品取得処理を初期化
    const fetcher = new RakutenProductFetcher(
      {
        enabled: !!dbConfig.proxyAgent,
        url: process.env.PROXY_SERVER || "",
        username: process.env.PROXY_USER || "",
        password: process.env.PROXY_PASS || ""
      },
      rakutenApiKey,
      fetchConfig
    );

    console.log(`🔄 楽天商品取得開始: ${category}/${shopName}`);
    
    // 商品データを取得
    const scrapedProducts = await fetcher.fetchProducts();
    
    if (!scrapedProducts || !Array.isArray(scrapedProducts) || scrapedProducts.length === 0) {
      throw new Error(`商品データが取得できませんでした。
設定を確認してください:
- ショップコード: ${fetchConfig.shopCode}
- genreId: ${fetchConfig.genreId || "未設定"}
- keyword: ${fetchConfig.keyword || "未設定"}

可能な原因:
1. ショップコードが間違っている
2. genreIdが存在しない
3. 該当商品がない
4. ショップが一時的に利用不可`);
    }

    console.log(`✅ 楽天API取得完了: ${scrapedProducts.length}件`);

    // ショップIDを取得または作成
    const shopId = await this.getOrCreateShopId(category, shopName);
    
    // ASIN保持型スクレイパーでデータベースに保存
    const asinScraper = new ASINPreservingScraper();
    const result = await asinScraper.processShopProducts(shopId, scrapedProducts);

    console.log("✅ データベース更新完了:", result);

    return result;
  }

  private async getOrCreateShopId(category: string, shopName: string): Promise<string> {
    const { unifiedSupabase } = await import("@/lib/database/unified-supabase");
    const client = await unifiedSupabase.getClient();

    // 既存ショップを検索
    const { data: existingShops, error: searchError } = await client
      .from("shops")
      .select("id")
      .eq("category", category)
      .eq("name", shopName)
      .limit(1);

    if (searchError) {
      throw new Error(`ショップ検索エラー: ${searchError.message}`);
    }

    if (existingShops && existingShops.length > 0) {
      return existingShops[0].id;
    }

    // ショップが存在しない場合は作成
    const displayName = this.getShopDisplayName(shopName);
    
    const { data: newShop, error: createError } = await client
      .from("shops")
      .insert({
        category,
        name: shopName,
        display_name: displayName,
        is_active: true,
      })
      .select("id")
      .single();

    if (createError || !newShop) {
      throw new Error(`ショップ作成エラー: ${createError?.message || "不明なエラー"}`);
    }

    console.log(`📍 新しいショップを作成: ${displayName} (${newShop.id})`);
    return newShop.id;
  }

  private getShopDisplayName(shopName: string): string {
    const displayNames: Record<string, string> = {
      "muji": "無印良品 楽天市場店",
    };

    return displayNames[shopName] || shopName;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ category: string; shopName: string }> }
) {
  const resolvedParams = await params;
  const handler = new RakutenApiHandler();
  return handler.execute(request, resolvedParams);
}