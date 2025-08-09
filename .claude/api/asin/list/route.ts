import { NextRequest } from "next/server";
import { AsinApiHandler, ApiResponse } from "@/lib/api/base-api-handler";
import { getAsinRepository } from "@/lib/database/repositories";
import { AsinInfo } from "@/lib/database/repositories/asin-repository";

export const dynamic = "force-dynamic";

interface AsinListResponse {
  asins: AsinInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class AsinListHandler extends AsinApiHandler {
  async handleRequest(request: NextRequest): Promise<ApiResponse<AsinListResponse>> {
    const startTime = Date.now();
    
    console.log("📡 ASIN一覧API呼び出し開始");
    
    const { searchParams } = new URL(request.url);
    
    // パラメータ取得
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const search = searchParams.get("search")?.trim() || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
    
    // フィルタリングパラメータ
    const brandFilter = searchParams.get("brand")?.trim();
    const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined;
    const minSales = searchParams.get("minSales") ? parseInt(searchParams.get("minSales")!) : undefined;
    const maxSales = searchParams.get("maxSales") ? parseInt(searchParams.get("maxSales")!) : undefined;
    const hasPrice = searchParams.get("hasPrice") === "true";
    const hasSales = searchParams.get("hasSales") === "true";
    const isHazardous = searchParams.get("isHazardous") === "true";
    const hasAmazon = searchParams.get("hasAmazon") === "true";
    const hasOfficial = searchParams.get("hasOfficial") === "true";

    console.log(`🔍 検索パラメータ: page=${page}, limit=${limit}, search="${search}", sortBy=${sortBy}, sortOrder=${sortOrder}`);
    
    try {
      const asinRepo = getAsinRepository();
      
      // 検索条件を構築
      const queryOptions = {
        page,
        limit,
        sortBy,
        sortOrder,
        search: search || undefined,
        searchFields: search ? asinRepo.getSearchFields() : undefined
      };

      let asins: AsinInfo[] = [];

      // 価格範囲での検索が指定されている場合
      if (minPrice !== undefined || maxPrice !== undefined) {
        asins = await asinRepo.findByPriceRange(minPrice, maxPrice, queryOptions);
      }
      // 月間売上範囲での検索が指定されている場合
      else if (minSales !== undefined || maxSales !== undefined) {
        asins = await asinRepo.findByMonthlySalesRange(minSales, maxSales, queryOptions);
      }
      // ブランド検索が指定されている場合
      else if (brandFilter) {
        asins = await asinRepo.findByBrand(brandFilter, queryOptions);
      }
      // 危険物フラグでの検索
      else if (isHazardous) {
        asins = await asinRepo.findByHazardousFlag(true, queryOptions);
      }
      // 通常の検索・一覧取得
      else {
        // 基本フィルター条件
        const filters: Record<string, any> = {};
        
        if (hasAmazon) {
          filters.has_amazon = true;
        }
        
        if (hasOfficial) {
          filters.has_official = true;
        }
        
        // 価格有無フィルタ
        if (hasPrice) {
          // 価格がnullでないもののみ
          const client = await asinRepo.getClient();
          let query = client
            .from("asin_info")
            .select(`
              asin,
              amazon_title,
              amazon_url,
              amazon_image_url,
              amazon_price,
              monthly_sales,
              selling_fee_rate,
              fba_fee,
              ean_codes,
              brand,
              hidden,
              memo,
              is_hazardous,
              no_partner_carrier,
              has_amazon,
              has_official,
              complaint_count,
              keepa_imported_at,
              created_at,
              updated_at
            `)
            .not("amazon_price", "is", null);

          // 追加フィルタ適用
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });

          // 検索適用
          if (search) {
            query = query.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%,brand.ilike.%${search}%`);
          }

          // ソート適用
          query = query.order(sortBy, { ascending: sortOrder === "asc" });

          // ページネーション適用
          const offset = (page - 1) * limit;
          query = query.range(offset, offset + limit - 1);

          const { data, error } = await query;
          
          if (error) {
            console.error("❌ ASIN一覧取得エラー:", error);
            return this.createDatabaseErrorResponse("ASIN一覧の取得に失敗しました");
          }
          
          asins = data as AsinInfo[] || [];
        }
        // 売上有無フィルタ
        else if (hasSales) {
          // 月間売上がnullでないもののみ
          const client = await asinRepo.getClient();
          let query = client
            .from("asin_info")
            .select(`
              asin,
              amazon_title,
              amazon_url,
              amazon_image_url,
              amazon_price,
              monthly_sales,
              selling_fee_rate,
              fba_fee,
              ean_codes,
              brand,
              hidden,
              memo,
              is_hazardous,
              no_partner_carrier,
              has_amazon,
              has_official,
              complaint_count,
              keepa_imported_at,
              created_at,
              updated_at
            `)
            .not("monthly_sales", "is", null);

          // 追加フィルタ適用
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });

          // 検索適用
          if (search) {
            query = query.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%,brand.ilike.%${search}%`);
          }

          // ソート適用
          query = query.order(sortBy, { ascending: sortOrder === "asc" });

          // ページネーション適用
          const offset = (page - 1) * limit;
          query = query.range(offset, offset + limit - 1);

          const { data, error } = await query;
          
          if (error) {
            console.error("❌ ASIN一覧取得エラー:", error);
            return this.createDatabaseErrorResponse("ASIN一覧の取得に失敗しました");
          }
          
          asins = data as AsinInfo[] || [];
        }
        // 通常の検索
        else {
          asins = await asinRepo.findMany(filters, queryOptions);
        }
      }
      
      // 総数取得（フィルタ条件に応じて）
      let total = 0;
      
      try {
        if (minPrice !== undefined || maxPrice !== undefined) {
          // 価格範囲での総数取得
          const client = await asinRepo.getClient();
          let countQuery = client
            .from("asin_info")
            .select("*", { count: "exact", head: true });

          if (minPrice !== undefined) {
            countQuery = countQuery.gte("amazon_price", minPrice);
          }
          if (maxPrice !== undefined) {
            countQuery = countQuery.lte("amazon_price", maxPrice);
          }
          if (search) {
            countQuery = countQuery.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%,brand.ilike.%${search}%`);
          }

          const { count } = await countQuery;
          total = count || 0;
        }
        else if (minSales !== undefined || maxSales !== undefined) {
          // 月間売上範囲での総数取得
          const client = await asinRepo.getClient();
          let countQuery = client
            .from("asin_info")
            .select("*", { count: "exact", head: true });

          if (minSales !== undefined) {
            countQuery = countQuery.gte("monthly_sales", minSales);
          }
          if (maxSales !== undefined) {
            countQuery = countQuery.lte("monthly_sales", maxSales);
          }
          if (search) {
            countQuery = countQuery.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%,brand.ilike.%${search}%`);
          }

          const { count } = await countQuery;
          total = count || 0;
        }
        else if (brandFilter) {
          // ブランド検索での総数取得
          const client = await asinRepo.getClient();
          let countQuery = client
            .from("asin_info")
            .select("*", { count: "exact", head: true })
            .eq("brand", brandFilter);

          if (search) {
            countQuery = countQuery.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%`);
          }

          const { count } = await countQuery;
          total = count || 0;
        }
        else if (hasPrice || hasSales || isHazardous) {
          // 特殊フィルタでの総数取得
          const client = await asinRepo.getClient();
          let countQuery = client
            .from("asin_info")
            .select("*", { count: "exact", head: true });

          if (hasPrice) {
            countQuery = countQuery.not("amazon_price", "is", null);
          }
          if (hasSales) {
            countQuery = countQuery.not("monthly_sales", "is", null);
          }
          if (isHazardous) {
            countQuery = countQuery.eq("is_hazardous", true);
          }
          if (hasAmazon) {
            countQuery = countQuery.eq("has_amazon", true);
          }
          if (hasOfficial) {
            countQuery = countQuery.eq("has_official", true);
          }
          if (search) {
            countQuery = countQuery.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%,brand.ilike.%${search}%`);
          }

          const { count } = await countQuery;
          total = count || 0;
        }
        else {
          // 通常の総数取得
          const filters: Record<string, any> = {};
          
          if (hasAmazon) {
            filters.has_amazon = true;
          }
          if (hasOfficial) {
            filters.has_official = true;
          }

          const client = await asinRepo.getClient();
          let countQuery = client
            .from("asin_info")
            .select("*", { count: "exact", head: true });

          Object.entries(filters).forEach(([key, value]) => {
            countQuery = countQuery.eq(key, value);
          });

          if (search) {
            countQuery = countQuery.or(`asin.ilike.%${search}%,amazon_title.ilike.%${search}%,brand.ilike.%${search}%`);
          }

          const { count } = await countQuery;
          total = count || 0;
        }
      } catch (countError) {
        console.warn("⚠️ 総数取得でエラーが発生しましたが、処理を継続します:", countError);
        total = asins.length; // フォールバック
      }

      const totalPages = Math.ceil(total / limit);
      const duration = Date.now() - startTime;

      console.log(`✅ ASIN一覧取得成功: ${asins.length}件 (総数: ${total}件, ${duration}ms)`);
      console.log(`🔍 フィルタ統計: page=${page}, limit=${limit}, totalPages=${totalPages}`);

      return this.createSuccessResponse<AsinListResponse>({
        asins,
        total,
        page,
        limit,
        totalPages
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ ASIN一覧取得エラー (${duration}ms):`, error);
      
      return this.createErrorResponse(
        "ASIN_LIST_ERROR",
        "ASIN一覧の取得に失敗しました",
        500,
        error.message
      );
    }
  }
}

export async function GET(request: NextRequest) {
  const handler = new AsinListHandler();
  return handler.execute(request);
}