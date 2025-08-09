import { NextRequest } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { amazonPrice } = body;

    if (typeof amazonPrice !== "number" || amazonPrice < 0) {
      return Response.json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Amazon価格は0以上の数値で指定してください"
        }
      }, { status: 400 });
    }

    // 統一プロキシ対応クライアント取得
    const supabase = await unifiedSupabase.getClient();

    // 商品存在確認とASIN取得
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("asin")
      .eq("id", id)
      .single();

    if (productError || !product) {
      return Response.json({
        success: false,
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "指定された商品が見つかりません"
        }
      }, { status: 404 });
    }

    if (!product.asin) {
      return Response.json({
        success: false,
        error: {
          code: "ASIN_NOT_SET",
          message: "ASINが設定されていません。先にASINを設定してください。"
        }
      }, { status: 400 });
    }

    // ASIN情報存在確認
    const { data: asinInfo, error: asinError } = await supabase
      .from("asin_info")
      .select("asin")
      .eq("asin", product.asin)
      .single();

    if (asinError || !asinInfo) {
      return Response.json({
        success: false,
        error: {
          code: "ASIN_INFO_NOT_FOUND",
          message: `指定されたASIN「${product.asin}」の情報が登録されていません。先にASIN情報をアップロードしてください。`
        }
      }, { status: 400 });
    }

    // ASIN情報のAmazon価格を更新
    const { error: updateError } = await supabase
      .from("asin_info")
      .update({ 
        amazon_price: amazonPrice,
        updated_at: new Date().toISOString()
      })
      .eq("asin", product.asin);

    if (updateError) {
      console.error("❌ Amazon価格更新エラー:", updateError.message);
      return Response.json({
        success: false,
        error: {
          code: "UPDATE_ERROR",
          message: "Amazon価格の更新に失敗しました"
        }
      }, { status: 500 });
    }

    console.log(`✅ Amazon価格を更新しました: ${product.asin} → ¥${amazonPrice}`);

    return Response.json({
      success: true,
      data: {
        productId: id,
        asin: product.asin,
        amazonPrice
      },
      message: "Amazon価格を更新しました"
    });

  } catch (error) {
    console.error("❌ Amazon価格更新で予期しないエラー:", error);
    return Response.json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "システムエラーが発生しました"
      }
    }, { status: 500 });
  }
}