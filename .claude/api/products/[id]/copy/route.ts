import { NextRequest } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await unifiedSupabase.getClient();

    // 元商品取得
    const { data: sourceProduct, error: sourceError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (sourceError || !sourceProduct) {
      return Response.json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "指定された商品が見つかりません"
        }
      }, { status: 404 });
    }

    // コピー回数計算
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("source_product_id", id);

    const copyIndex = (count || 0) + 1;

    // ASINは初期状態ではコピーしない（1商品1ASIN制約）
    const newProduct = {
      shop_id: sourceProduct.shop_id,
      name: sourceProduct.name,
      image_url: sourceProduct.image_url,
      price: sourceProduct.price,
      sale_price: sourceProduct.sale_price,
      asin: null, // ASINはコピーしない
      source_product_id: id,
      copy_index: copyIndex,
      metadata: sourceProduct.metadata || {}
    };

    // 新商品作成
    const { data: createdProduct, error: createError } = await supabase
      .from("products")
      .insert([newProduct])
      .select()
      .single();

    if (createError) {
      console.error("❌ 商品コピー作成エラー:", createError.message);
      return Response.json({
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "商品のコピーに失敗しました"
        }
      }, { status: 500 });
    }

    console.log(`✅ 商品をコピーしました: ${sourceProduct.name} → ${createdProduct.name}`);

    return Response.json({
      success: true,
      data: {
        product: createdProduct,
        sourceProduct: sourceProduct,
        copyIndex
      },
      message: "商品をコピーしました"
    });

  } catch (error) {
    console.error("❌ 商品コピーで予期しないエラー:", error);
    return Response.json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "システムエラーが発生しました"
      }
    }, { status: 500 });
  }
}