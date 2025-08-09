import { NextRequest } from "next/server";
import { ScrapingApiHandler } from "@/lib/api/base-api-handler";
import { scrapingApiMiddleware } from "@/lib/api/middleware";
import { getShopRepository } from "@/lib/database/repositories";
import { OperationResponseUtils } from "@/lib/api/response-utils";
import { DHCScraper } from "@/lib/scrapers/dhc-scraper";
import { VTCosmeticsScraper } from "@/lib/scrapers/vt-cosmetics-scraper";
import { InnisfreeScraper } from "@/lib/scrapers/innisfree-scraper";
import { SampleShopScraper } from "@/lib/scrapers/sample-shop-scraper";
import { BaseScraper } from "@/lib/scrapers/base-scraper";
import { ASINPreservingScraper, ScrapingResult } from "@/lib/scrapers/asin-preserving-scraper";
import { ProxyConfig, ScrapedProduct } from "@/types/product";
import { ProxyController } from "@/lib/proxy/proxy-controller";
import { createServerSupabaseClient } from "@/lib/supabase";

class ShopScrapingHandler extends ScrapingApiHandler {
  async handleRequest(
    request: NextRequest,
    params: { category: string; shopName: string }
  ): Promise<any> {
    const startTime = Date.now();
    const { category, shopName } = params;
    
    // パラメータ検証
    this.validateShopParams(category, shopName);
    
    const { preserveAsins = true } = await request.json().catch(() => ({}));
    
    // スクレイピング実行
    const { scrapedProducts } = await this.executeScrapingProcess(category, shopName);
    
    // ショップ情報の取得または作成
    const shopRepo = getShopRepository();
    const shop = await shopRepo.findOrCreate(category, shopName, shopName);
    
    // ASIN保持型 vs 全削除型の選択
    let result: ScrapingResult;
    
    if (preserveAsins) {
      // ASIN保持型スクレイピング
      const asinPreservingScraper = new ASINPreservingScraper();
      result = await asinPreservingScraper.processShopProducts(shop.id, scrapedProducts);
    } else {
      // 従来の全削除型スクレイピング
      result = await this.legacyFullReplaceProcessing(shop.id, scrapedProducts);
    }
    
    // ショップの最終更新時刻更新
    await shopRepo.updateLastScrapedAt(shop.id);
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ スクレイピング完了: ${category}/${shopName} (${duration}ms)`);
    
    return OperationResponseUtils.scrapingCompleted({
      shopId: shop.id,
      scrapedCount: scrapedProducts.length,
      newCount: result.newProducts,
      updatedCount: result.updatedProducts,
      preservedAsins: result.preservedAsins,
      removedCount: result.removedProducts,
      duration,
      preserveAsins
    });
  }

  // スクレイピング処理の実行
  private async executeScrapingProcess(
    category: string, 
    shopName: string
  ): Promise<{ scrapedProducts: ScrapedProduct[] }> {
    // 事前プロキシ判定（新しい設計）
    const scrapingConfig = ProxyController.getScrapingConfig();
    
    // ProxyConfigに変換
    const proxyConfig: ProxyConfig = {
      enabled: scrapingConfig.useProxy,
      url: scrapingConfig.proxyUrl || "",
      username: scrapingConfig.proxyAuth?.username || "",
      password: scrapingConfig.proxyAuth?.password || ""
    };
    
    // スクレイパー選択
    let scraper: BaseScraper;
    
    if (category === "official" && shopName === "dhc") {
      scraper = new DHCScraper(proxyConfig);
    } else if (category === "official" && shopName === "vt-cosmetics") {
      scraper = new VTCosmeticsScraper(proxyConfig);
    } else if (category === "official" && shopName === "innisfree") {
      scraper = new InnisfreeScraper(proxyConfig);
    } else if (category === "ec" && shopName === "sampleShop") {
      scraper = new SampleShopScraper(proxyConfig);
    } else {
      return this.createValidationErrorResponse(
        `サポートされていないショップです: ${category}/${shopName}`
      );
    }
    
    // スクレイピング実行
    const scrapedProducts = await scraper.scrape();
    
    if (!scrapedProducts || scrapedProducts.length === 0) {
      return this.createErrorResponse(
        "NO_DATA",
        "商品データが取得できませんでした",
        500
      );
    }

    return { scrapedProducts };
  }

  // 従来の全削除型処理（後方互換性のため残存）
  private async legacyFullReplaceProcessing(
    shopId: string, 
    scrapedProducts: ScrapedProduct[]
  ): Promise<ScrapingResult> {
    const supabase = await createServerSupabaseClient();
    
    // 既存商品削除
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("shop_id", shopId);
    
    if (deleteError) {
      throw new Error(`既存商品の削除に失敗しました: ${deleteError.message}`);
    }
    
    // 新規商品挿入（バッチ処理対応）
    const productsToInsert = scrapedProducts.map((product, index) => {
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
      newProducts: scrapedProducts.length,
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

  const handler = new ShopScrapingHandler();
  return handler.execute(request, resolvedParams);
}

