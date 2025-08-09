import { NextRequest } from "next/server";
import { ScrapingApiHandler } from "@/lib/api/base-api-handler";
import { scrapingApiMiddleware } from "@/lib/api/middleware";
import { getShopRepository } from "@/lib/database/repositories";
import { OperationResponseUtils } from "@/lib/api/response-utils";
import { YahooShoppingClient } from "@/lib/api-clients/yahoo-shopping-client";
import { ASINPreservingScraper, ScrapingResult } from "@/lib/scrapers/asin-preserving-scraper";
import { ScrapedProduct } from "@/types/product";
import { createServerSupabaseClient } from "@/lib/supabase";

class YahooShoppingHandler extends ScrapingApiHandler {
  async handleRequest(
    request: NextRequest,
    params: { category: string; shopName: string }
  ): Promise<any> {
    const startTime = Date.now();
    const { category, shopName } = params;
    
    // パラメータ検証（yahooカテゴリのみ許可）
    if (category !== "yahoo") {
      return this.createValidationErrorResponse(
        "Yahoo Shopping APIは 'yahoo' カテゴリのみサポートしています"
      );
    }
    
    // 現在はvt-cosmeticsのみサポート
    if (shopName !== "vt-cosmetics") {
      return this.createValidationErrorResponse(
        "現在サポートされているYahooショップは 'vt-cosmetics' のみです"
      );
    }
    
    const { preserveAsins = true } = await request.json().catch(() => ({}));
    
    // Yahoo Shopping API経由で商品データを取得
    const { products } = await this.executeYahooAPIProcess();
    
    // ショップ情報の取得または作成
    const shopRepo = getShopRepository();
    const shop = await shopRepo.findOrCreate(category, shopName, "VT Cosmetics Yahoo店");
    
    // ASIN保持型 vs 全削除型の選択
    let result: ScrapingResult;
    
    if (preserveAsins) {
      // ASIN保持型処理
      const asinPreservingScraper = new ASINPreservingScraper();
      result = await asinPreservingScraper.processShopProducts(shop.id, products);
    } else {
      // 従来の全削除型処理
      result = await this.legacyFullReplaceProcessing(shop.id, products);
    }
    
    // ショップの最終更新時刻更新
    await shopRepo.updateLastScrapedAt(shop.id);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Yahoo Shopping API取得完了: ${category}/${shopName} (${duration}ms)`);
    
    return OperationResponseUtils.scrapingCompleted({
      shopId: shop.id,
      scrapedCount: products.length,
      newCount: result.newProducts,
      updatedCount: result.updatedProducts,
      preservedAsins: result.preservedAsins,
      removedCount: result.removedProducts,
      duration,
      preserveAsins,
      source: "Yahoo Shopping API v3"
    });
  }

  // Yahoo Shopping API処理の実行
  private async executeYahooAPIProcess(): Promise<{ products: ScrapedProduct[] }> {
    try {
      console.log("🔄 Yahoo Shopping API クライアント初期化...");
      
      //環境変数確認
      if (!process.env.YAHOO_APP_ID) {
        throw new Error("YAHOO_APP_ID環境変数が設定されていません");
      }
      
      const yahooClient = new YahooShoppingClient();
      
      console.log("📡 Yahoo Shopping API から商品データを取得中...");
      const products = await yahooClient.fetchAllProducts();
      
      if (!products || products.length === 0) {
        return this.createErrorResponse(
          "NO_DATA",
          "Yahoo Shopping APIから商品データが取得できませんでした",
          500
        );
      }
      
      console.log(`✅ Yahoo Shopping API取得成功: ${products.length}件`);
      return { products };
      
    } catch (error) {
      console.error("❌ Yahoo Shopping API取得エラー:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("YAHOO_APP_ID")) {
          return this.createErrorResponse(
            "CONFIG_ERROR",
            "Yahoo Shopping API設定エラー: " + error.message,
            500
          );
        }
        
        return this.createErrorResponse(
          "API_ERROR",
          "Yahoo Shopping API取得エラー: " + error.message,
          500
        );
      }
      
      return this.createErrorResponse(
        "UNKNOWN_ERROR",
        "Yahoo Shopping API取得中に不明なエラーが発生しました",
        500
      );
    }
  }

  // 従来の全削除型処理（後方互換性のため残存）
  private async legacyFullReplaceProcessing(
    shopId: string, 
    products: ScrapedProduct[]
  ): Promise<ScrapingResult> {
    const supabase = await createServerSupabaseClient();
    
    console.log("🗑️ 既存商品データを削除中...");
    
    // 既存商品削除
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("shop_id", shopId);
    
    if (deleteError) {
      throw new Error(`既存商品の削除に失敗しました: ${deleteError.message}`);
    }
    
    console.log("💾 新規商品データを保存中...");
    
    // 新規商品挿入（バッチ処理対応）
    const productsToInsert = products.map((product, index) => {
      // sale_priceがpriceより高い場合はnullに設定（DB制約対応）
      let validSalePrice = product.sale_price;
      if (validSalePrice !== undefined && validSalePrice >= product.price) {
        validSalePrice = undefined;
      }
      
      return {
        shop_id: shopId,
        name: product.name,
        image_url: product.image_url,
        price: product.price,
        sale_price: validSalePrice,
        display_order: index + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        scraped_at: new Date().toISOString()
      };
    });
    
    // バッチサイズ1000件で分割処理
    const batchSize = 1000;
    const batches = [];
    for (let i = 0; i < productsToInsert.length; i += batchSize) {
      batches.push(productsToInsert.slice(i, i + batchSize));
    }
    
    console.log(`📦 商品を${batches.length}バッチに分割して処理`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📥 バッチ ${batchIndex + 1}/${batches.length} 処理中 (${batch.length}件)`);
      
      const { error: insertError } = await supabase
        .from("products")
        .insert(batch);
      
      if (insertError) {
        throw new Error(`商品データの保存に失敗しました (バッチ ${batchIndex + 1}): ${insertError.message}`);
      }
      
      console.log(`✅ バッチ ${batchIndex + 1} 完了: ${batch.length}件保存`);
      
      // バッチ間の待機時間（API制限対策）
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      newProducts: products.length,
      updatedProducts: 0,
      preservedAsins: 0,
      removedProducts: 0,
      duration: 0
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ category: string; shopName: string }> }
) {
  const resolvedParams = await params;
  const middleware = scrapingApiMiddleware();
  const middlewareResult = await middleware.execute(request);
  
  if (!middlewareResult.success) {
    return middlewareResult.response!;
  }

  const handler = new YahooShoppingHandler();
  return handler.execute(request, resolvedParams);
}