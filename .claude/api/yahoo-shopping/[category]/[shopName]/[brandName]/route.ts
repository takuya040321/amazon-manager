import { NextRequest } from "next/server";
import { ScrapingApiHandler } from "@/lib/api/base-api-handler";
import { scrapingApiMiddleware } from "@/lib/api/middleware";
import { getShopRepository } from "@/lib/database/repositories";
import { OperationResponseUtils } from "@/lib/api/response-utils";
import { YahooShoppingClient } from "@/lib/api-clients/yahoo-shopping-client";
import { ASINPreservingScraper, ScrapingResult } from "@/lib/scrapers/asin-preserving-scraper";
import { ScrapedProduct } from "@/types/product";
import { createServerSupabaseClient } from "@/lib/supabase";

class YahooShoppingBrandHandler extends ScrapingApiHandler {
  async handleRequest(
    request: NextRequest,
    params: { category: string; shopName: string; brandName: string }
  ): Promise<any> {
    const startTime = Date.now();
    const { category, shopName, brandName } = params;
    
    // パラメータ検証（yahooカテゴリのみ許可）
    if (category !== "yahoo") {
      return this.createValidationErrorResponse(
        "Yahoo Shopping APIは 'yahoo' カテゴリのみサポートしています"
      );
    }
    
    const { preserveAsins = true } = await request.json().catch(() => ({}));
    
    // ブランド情報の取得
    const { shop, brand, shopBrand } = await this.getShopAndBrandInfo(category, shopName, brandName);
    
    // Yahoo Shopping API経由でブランド商品データを取得
    const { products } = await this.executeYahooAPIBrandProcess(shop, shopBrand);
    
    // ASIN保持型 vs 全削除型の選択
    let result: ScrapingResult;
    
    if (preserveAsins) {
      // ASIN保持型処理（ブランド対応）
      const asinPreservingScraper = new ASINPreservingScraper();
      result = await asinPreservingScraper.processShopProducts(
        shop.id, 
        products,
        { brandId: brand.id }  // ブランドIDを渡す
      );
    } else {
      // 従来の全削除型処理（ブランド対応）
      result = await this.legacyBrandReplaceProcessing(shop.id, brand.id, products);
    }
    
    // ショップの最終更新時刻更新
    const shopRepo = getShopRepository();
    await shopRepo.updateLastScrapedAt(shop.id);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Yahoo Shopping ブランド商品取得完了: ${category}/${shopName}/${brandName} (${duration}ms)`);
    
    return OperationResponseUtils.scrapingCompleted({
      shopId: shop.id,
      brandId: brand.id,
      scrapedCount: products.length,
      newCount: result.newProducts,
      updatedCount: result.updatedProducts,
      preservedAsins: result.preservedAsins,
      removedCount: result.removedProducts,
      duration,
      preserveAsins,
      source: `Yahoo Shopping API v3 (${brand.display_name})`
    });
  }

  // ショップとブランド情報の取得
  private async getShopAndBrandInfo(category: string, shopName: string, brandName: string) {
    const supabase = await createServerSupabaseClient();
    
    // ショップ情報の取得
    const { data: shops, error: shopError } = await supabase
      .from("shops")
      .select("*")
      .eq("category", category)
      .eq("name", shopName)
      .single();
    
    if (shopError || !shops) {
      throw new Error(`ショップが見つかりません: ${category}/${shopName}`);
    }
    
    // ブランド情報の取得
    const { data: brands, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("name", brandName)
      .single();
    
    if (brandError || !brands) {
      throw new Error(`ブランドが見つかりません: ${brandName}`);
    }
    
    // ショップ-ブランド関連の取得
    const { data: shopBrands, error: shopBrandError } = await supabase
      .from("shop_brands")
      .select("*")
      .eq("shop_id", shops.id)
      .eq("brand_id", brands.id)
      .single();
    
    if (shopBrandError || !shopBrands) {
      throw new Error(`ショップ-ブランド関連が見つかりません: ${shopName}/${brandName}`);
    }
    
    return {
      shop: shops,
      brand: brands,
      shopBrand: shopBrands
    };
  }

  // Yahoo Shopping API ブランド処理の実行
  private async executeYahooAPIBrandProcess(
    shop: any, 
    shopBrand: any
  ): Promise<{ products: ScrapedProduct[] }> {
    try {
      console.log("🔄 Yahoo Shopping API ブランドクライアント初期化...");
      
      //環境変数確認
      if (!process.env.YAHOO_APP_ID) {
        throw new Error("YAHOO_APP_ID環境変数が設定されていません");
      }
      
      // ショップのscraping_configからstoreIdを取得
      const storeId = shop.scraping_config?.store_id;
      if (!storeId) {
        throw new Error("ショップ設定にstore_idが見つかりません");
      }
      
      // ブランドのexternal_brand_idを取得
      const brandId = shopBrand.external_brand_id;
      if (!brandId) {
        throw new Error("ブランド設定にexternal_brand_idが見つかりません");
      }
      
      console.log(`📡 Yahoo Shopping API からブランド商品データを取得中: store=${storeId}, brand=${brandId}`);
      const products = await YahooShoppingClient.fetchBrandProducts(storeId, brandId);
      
      if (!products || products.length === 0) {
        console.log("⚠️ ブランド商品が見つかりませんでした");
        return { products: [] };
      }
      
      console.log(`✅ Yahoo Shopping API ブランド商品取得成功: ${products.length}件`);
      return { products };
      
    } catch (error) {
      console.error("❌ Yahoo Shopping API ブランド取得エラー:", error);
      
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
          "Yahoo Shopping API ブランド取得エラー: " + error.message,
          500
        );
      }
      
      return this.createErrorResponse(
        "UNKNOWN_ERROR",
        "Yahoo Shopping API ブランド取得中に不明なエラーが発生しました",
        500
      );
    }
  }

  // ブランド対応の全削除型処理
  private async legacyBrandReplaceProcessing(
    shopId: string,
    brandId: string,
    products: ScrapedProduct[]
  ): Promise<ScrapingResult> {
    const supabase = await createServerSupabaseClient();
    
    console.log("🗑️ 既存ブランド商品データを削除中...");
    
    // 既存のブランド商品削除
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("shop_id", shopId)
      .eq("brand_id", brandId);
    
    if (deleteError) {
      throw new Error(`既存ブランド商品の削除に失敗しました: ${deleteError.message}`);
    }
    
    console.log("💾 新規ブランド商品データを保存中...");
    
    // 新規商品挿入（ブランドID付き）
    const productsToInsert = products.map((product, index) => {
      // sale_priceがpriceより高い場合はnullに設定（DB制約対応）
      let validSalePrice = product.sale_price;
      if (validSalePrice !== undefined && validSalePrice >= product.price) {
        validSalePrice = undefined;
      }
      
      return {
        shop_id: shopId,
        brand_id: brandId,  // ブランドIDを設定
        name: product.name,
        image_url: product.image_url,
        price: product.price,
        sale_price: validSalePrice,
        metadata: product.metadata || {},
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
    
    console.log(`📦 ブランド商品を${batches.length}バッチに分割して処理`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📥 バッチ ${batchIndex + 1}/${batches.length} 処理中 (${batch.length}件)`);
      
      const { error: insertError } = await supabase
        .from("products")
        .insert(batch);
      
      if (insertError) {
        throw new Error(`ブランド商品データの保存に失敗しました (バッチ ${batchIndex + 1}): ${insertError.message}`);
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
  { params }: { params: Promise<{ category: string; shopName: string; brandName: string }> }
) {
  const resolvedParams = await params;
  const middleware = scrapingApiMiddleware();
  const middlewareResult = await middleware.execute(request);
  
  if (!middlewareResult.success) {
    return middlewareResult.response!;
  }

  const handler = new YahooShoppingBrandHandler();
  return handler.execute(request, resolvedParams);
}