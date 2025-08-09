import { NextRequest } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";
import { ProductApiValidator, ShopValidationUtils, formatValidationErrors } from "@/lib/shared/validation/api-validators";
import { ResponseUtils } from "@/lib/api/response-utils";
import { ShopRepository } from "@/lib/database/repositories/shop-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log("📡 商品API呼び出し開始");
    
    const { searchParams } = new URL(request.url);
    const rawParams = {
      category: searchParams.get("category"),
      shopName: searchParams.get("shopName"),
      brandName: searchParams.get("brandName"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search")
    };

    // リクエストパラメータの検証
    const validationResult = ProductApiValidator.validateProductListRequest(rawParams);
    if (!validationResult.success) {
      console.log(`❌ バリデーションエラー: ${formatValidationErrors(validationResult.errors!)}`);
      return ResponseUtils.validationError(
        formatValidationErrors(validationResult.errors!),
        { invalidParams: rawParams, errors: validationResult.errors }
      );
    }

    const { category, shopName, brandName, page, limit, search } = validationResult.data!;

    // ショップ存在確認（category と shopName が両方指定されている場合）
    // ただし、楽天ショップの場合は初回API実行でショップが自動作成されるため、存在しなくてもOK
    if (category && shopName) {
      const shopRepository = new ShopRepository();
      const shopValidationResult = await ShopValidationUtils.validateShopCombination(
        category,
        shopName,
        shopRepository
      );
      
      if (!shopValidationResult.success) {
        // 楽天ショップの場合は、ショップが存在しなくても許可
        if (category === "rakuten") {
          console.log(`⚠️  楽天ショップ（${shopName}）が存在しませんが、初回API実行のため許可します`);
        } else {
          console.log(`❌ ショップ存在確認エラー: ${formatValidationErrors(shopValidationResult.errors!)}`);
          return ResponseUtils.validationError(
            formatValidationErrors(shopValidationResult.errors!),
            { 
              invalidShop: { category, shopName },
              availableCategories: ShopValidationUtils.VALID_CATEGORIES,
              suggestion: "有効なショップ組み合わせを確認してください"
            }
          );
        }
      } else {
        console.log(`✅ ショップ存在確認成功: ${category}/${shopName}`);
      }
    }

    const supabase = await unifiedSupabase.getClient();
    
    // 大量データ取得の場合は分割取得を実行
    if (limit >= 9999) {
      console.log("🔄 大量データ取得モード: 分割取得実行");
      const allProducts = [];
      let currentOffset = 0;
      const batchSize = 1000;
      
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let batchQuery = supabase
          .from("products")
          .select(`
            *,
            shops!inner (
              id,
              category,
              name,
              display_name
            ),
            brands (
              id,
              name,
              display_name,
              brand_id,
              official_url
            )
          `);

        // フィルタリング適用
        if (category && shopName) {
          batchQuery = batchQuery
            .eq("shops.category", category)
            .eq("shops.name", shopName);
        }

        // ブランド絞り込み
        if (brandName) {
          batchQuery = batchQuery.eq("brands.name", brandName);
        }

        if (search) {
          batchQuery = batchQuery.ilike("name", `%${search}%`);
        }

        // ソートと範囲設定
        batchQuery = batchQuery
          .order("display_order", { ascending: true })
          .range(currentOffset, currentOffset + batchSize - 1);

        const { data: batchProducts, error: batchError } = await batchQuery;
        
        if (batchError) {
          console.error("❌ バッチ取得エラー:", batchError);
          break;
        }

        if (!batchProducts || batchProducts.length === 0) {
          console.log(`✅ 分割取得完了: 総取得数=${allProducts.length}件`);
          break;
        }

        allProducts.push(...batchProducts);
        console.log(`📊 バッチ${Math.floor(currentOffset / batchSize) + 1}: ${batchProducts.length}件取得 (累計: ${allProducts.length}件)`);
        
        // 次のバッチへ
        currentOffset += batchSize;
        
        // 安全装置: 50,000件で停止
        if (allProducts.length >= 50000) {
          console.log("⚠️ 安全装置: 50,000件制限に達しました");
          break;
        }
      }

      // ASIN情報結合
      let productsWithAsin = allProducts;
      const asins = allProducts.filter(p => p.asin).map(p => p.asin);
      
      if (asins.length > 0) {
        const { data: asinInfos } = await supabase
          .from("asin_info")
          .select("*")
          .in("asin", asins);
        
        productsWithAsin = allProducts.map(product => ({
          ...product,
          asinInfo: asinInfos?.find(ai => ai.asin === product.asin) || null
        }));
      }

      const duration = Date.now() - startTime;
      
      console.log(`✅ 大量データ取得成功: ${productsWithAsin.length}件`);
      console.log(`⏱️ 大量データ処理時間: ${duration}ms`);

      return ResponseUtils.success({
        products: productsWithAsin,
        pagination: {
          page: 1,
          limit: productsWithAsin.length,
          total: productsWithAsin.length,
          totalPages: 1
        },
        metadata: {
          processedAt: new Date().toISOString(),
          duration,
          batchMode: true,
          appliedFilters: {
            category: category || null,
            shopName: shopName || null,
            brandName: brandName || null,
            search: search || null
          }
        }
      }, `大量データを${productsWithAsin.length}件取得しました`);
    }

    // 通常のページネーション処理
    let query = supabase
      .from("products")
      .select(`
        *,
        shops!inner (
          id,
          category,
          name,
          display_name
        ),
        brands (
          id,
          name,
          display_name,
          brand_id,
          official_url
        )
      `);

    // ショップフィルタリング
    if (category && shopName) {
      query = query
        .eq("shops.category", category)
        .eq("shops.name", shopName);
    }

    // ブランド絞り込み
    if (brandName) {
      query = query.eq("brands.name", brandName);
    }

    // 検索フィルタリング
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // ソート
    query = query.order("display_order", { ascending: true });

    // ページネーション
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: products, error } = await query;

    if (error) {
      console.error("❌ 商品取得エラー:", error);
      return ResponseUtils.error(
        "PRODUCTS_QUERY_ERROR",
        "商品データの取得に失敗しました",
        500,
        {
          error: error.message,
          code: error.code,
          filters: { category, shopName, brandName, search },
          pagination: { page, limit },
          suggestion: "クエリパラメータやフィルタ条件を確認してください"
        }
      );
    }

    // ASIN情報を別途取得して結合
    let productsWithAsin = products || [];
    if (products && products.length > 0) {
      const asins = products.filter(p => p.asin).map(p => p.asin);
      
      if (asins.length > 0) {
        const { data: asinInfos } = await supabase
          .from("asin_info")
          .select("*")
          .in("asin", asins);
        
        // ASIN情報を商品に結合
        productsWithAsin = products.map(product => ({
          ...product,
          asinInfo: asinInfos?.find(ai => ai.asin === product.asin) || null
        }));
      }
    }

    // 総数取得（ページネーション用）- shopフィルタがある場合はJOINが必要
    let countQuery = supabase
      .from("products")
      .select("*", { count: "exact", head: true });
    
    // ショップフィルタがある場合はJOINを含めてカウント
    if (category && shopName) {
      countQuery = supabase
        .from("products")
        .select(`
          id,
          shops!inner (
            id,
            category,
            name
          )
        `, { count: "exact", head: true })
        .eq("shops.category", category)
        .eq("shops.name", shopName);
    }
    
    // ブランドフィルタ
    if (brandName) {
      countQuery = countQuery.eq("brands.name", brandName);
    }
    
    // 検索フィルタ
    if (search) {
      countQuery = countQuery.ilike("name", `%${search}%`);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error("❌ カウントクエリエラー:", countError);
      return ResponseUtils.error(
        "COUNT_QUERY_ERROR",
        "商品総数の取得に失敗しました", 
        500,
        {
          error: countError.message,
          filters: { category, shopName, brandName, search },
          suggestion: "フィルタ条件を確認してください"
        }
      );
    }
    const total = count || 0;

    const duration = Date.now() - startTime;
    
    console.log(`✅ 商品データ取得成功: ${productsWithAsin.length}件`);
    console.log(`🔍 API統計: category=${category}, shopName=${shopName}, limit=${limit}, page=${page}`);
    console.log(`🔍 API統計: 総商品数=${total}, 返却商品数=${productsWithAsin.length}`);
    console.log(`⏱️ 処理時間: ${duration}ms`);

    // 標準化されたレスポンス
    return ResponseUtils.success({
      products: productsWithAsin,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      metadata: {
        processedAt: new Date().toISOString(),
        duration,
        appliedFilters: {
          category: category || null,
          shopName: shopName || null,
          brandName: brandName || null,
          search: search || null
        }
      }
    }, `商品データを${productsWithAsin.length}件取得しました`);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("❌ 商品APIエラー:", error);
    
    return ResponseUtils.error(
      "PRODUCTS_API_ERROR",
      "商品API内部でエラーが発生しました",
      500,
      {
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        duration,
        timestamp: new Date().toISOString(),
        suggestion: "しばらく時間をおいて再試行してください。問題が続く場合はサポートにお問い合わせください。"
      }
    );
  }
}