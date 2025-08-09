import { NextRequest } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";
import { validateASIN } from "@/lib/utils/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  
  try {
    const { asin } = await request.json();
    
    console.log(`ASIN設定: ${id} -> ${asin}`);

    // ASIN形式バリデーション
    if (!asin || !validateASIN(asin)) {
      return Response.json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "ASINは10桁の英数字で入力してください"
        }
      }, { status: 400 });
    }

    // 統一プロキシ対応クライアント取得
    const supabase = await unifiedSupabase.getClient();

    // 商品存在確認（READ操作）
    console.log(`📖 商品存在確認: ${id}`);
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (productError || !product) {
      console.error("❌ 商品取得失敗:", {
        productId: id,
        error: productError,
        details: productError?.message || "商品が見つかりません"
      });
      return Response.json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "指定された商品が見つかりません"
        }
      }, { status: 404 });
    }
    console.log(`✅ 商品取得成功: ${product.name}`);

    // ASIN情報存在確認（ASIN情報テーブルに存在しなくても商品テーブルに保存可能）
    console.log(`🔍 ASIN情報確認: ${asin}`);
    const { data: asinInfo, error: asinError } = await supabase
      .from("asin_info")
      .select("asin, amazon_title")
      .eq("asin", asin)
      .single();

    if (asinError || !asinInfo) {
      console.log(`⚠️ ASIN情報未登録: ${asin} - ASIN情報テーブルに存在しませんが、商品テーブルに保存します`);
    } else {
      console.log(`✅ ASIN情報確認済み: ${asinInfo.amazon_title}`);
    }

    // 商品テーブルに直接ASIN設定（ASIN情報テーブルの外部キー制約を削除し、直接保存）
    console.log(`📝 ASIN設定実行: ${id} -> ${asin}`);
    const { data: updateResult, error: updateError } = await supabase
      .from("products")
      .update({ asin: asin })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ ASIN設定エラー:", updateError.message);
      return Response.json({
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "ASIN設定に失敗しました"
        }
      }, { status: 500 });
    }

    const hasAsinInfo = asinInfo ? true : false;
    const duration = Date.now() - startTime;
    console.log(`✅ ASIN設定完了: ${duration}ms (ASIN情報${hasAsinInfo ? "あり" : "なし"})`);

    return Response.json({
      success: true,
      data: {
        product: updateResult,
        asinInfo: asinInfo || null,
        hasAsinInfo: hasAsinInfo
      },
      message: hasAsinInfo 
        ? "ASINを設定し、Amazon情報を取得しました" 
        : "ASINを設定しました（Amazon情報は未登録）"
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ASIN設定API エラー (${duration}ms):`, error);
    
    return Response.json({
      success: false,
      error: { 
        code: "INTERNAL_ERROR", 
        message: error instanceof Error ? error.message : "システムエラーが発生しました"
      }
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  
  try {
    console.log(`🗑️ ASIN削除開始: 商品ID=${id}`);
    
    // 統一プロキシ対応クライアント取得
    const supabase = await unifiedSupabase.getClient();

    // 商品存在確認
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (productError || !product) {
      return Response.json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "指定された商品が見つかりません"
        }
      }, { status: 404 });
    }

    // 商品のASINを削除
    const { error: updateError } = await supabase
      .from("products")
      .update({ asin: null })
      .eq("id", id);

    if (updateError) {
      console.error("❌ 商品ASIN削除エラー:", updateError.message);
      return Response.json({
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "ASINの削除に失敗しました"
        }
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ ASIN削除完了 (${duration}ms): ${id}`);

    return Response.json({
      success: true,
      data: {
        product: { ...product, asin: null }
      },
      message: "ASINを削除しました"
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ASIN削除API エラー (${duration}ms):`, error);
    return Response.json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "システムエラーが発生しました"
      }
    }, { status: 500 });
  }
}