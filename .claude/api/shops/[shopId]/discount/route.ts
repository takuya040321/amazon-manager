import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { DiscountSettings, DiscountCreateRequest } from "@/types/discount";

export const dynamic = "force-dynamic";

// 割引設定取得（JSONB版）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    
    console.log(`📊 割引設定取得: shopId=${shopId}`);
    
    // shopIdの妥当性チェック
    if (!shopId || typeof shopId !== "string") {
      console.error("❌ 無効なshopId:", shopId);
      return Response.json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "無効なshopIDです" }
      }, { status: 400 });
    }
    
    // UUID形式の検証
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(shopId)) {
      console.error("❌ shopIdがUUID形式ではありません:", shopId);
      return Response.json({
        success: false,
        error: { 
          code: "VALIDATION_ERROR", 
          message: "shopIDはUUID形式である必要があります",
          details: `受信したshopId: ${shopId}` 
        }
      }, { status: 400 });
    }
    
    let supabase;
    try {
      supabase = await createServerSupabaseClient();
      console.log("🔍 Supabaseクライアント取得完了");
    } catch (clientError) {
      console.error("❌ Supabaseクライアント取得エラー:", clientError);
      return Response.json({
        success: false,
        error: { 
          code: "CLIENT_ERROR", 
          message: "データベース接続に失敗しました",
          details: clientError instanceof Error ? clientError.message : "不明なエラー"
        }
      }, { status: 500 });
    }
    
    const { data, error } = await supabase
      .from("shop_discount_settings")
      .select("settings")
      .eq("shop_id", shopId)
      .maybeSingle();
    
    console.log("🔍 クエリ結果:", { data, error, hasError: !!error });
    
    if (error) {
      console.error("❌ 割引設定取得エラー:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return Response.json({
        success: false,
        error: { 
          code: "DATABASE_ERROR", 
          message: "割引設定の取得に失敗しました",
          details: error.message 
        }
      }, { status: 500 });
    }
    
    // デフォルト設定
    const defaultSettings: DiscountSettings = {
      discount_type: "percentage",
      discount_value: 0,
      is_active: false
    };
    
    console.log("✅ 割引設定取得完了");
    
    return Response.json({
      success: true,
      data: data?.settings || defaultSettings
    });
    
  } catch (error) {
    console.error("❌ 割引設定API エラー:", error);
    return Response.json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "システムエラーが発生しました" }
    }, { status: 500 });
  }
}

// 割引設定更新/作成（JSONB版）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    const settings: DiscountCreateRequest = await request.json();
    
    console.log(`📝 割引設定更新: shopId=${shopId}`);
    
    // バリデーション
    const validation = validateDiscountSettings(settings);
    if (!validation.isValid) {
      return Response.json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: validation.error }
      }, { status: 400 });
    }
    
    const supabase = await createServerSupabaseClient();
    
    // UPSERT で設定を更新
    const { data, error } = await supabase
      .from("shop_discount_settings")
      .upsert({
        shop_id: shopId,
        settings,
        updated_at: new Date().toISOString()
      }, { onConflict: "shop_id" })
      .select("settings")
      .single();
    
    if (error) {
      console.error("❌ 割引設定更新エラー:", error);
      return Response.json({
        success: false,
        error: { code: "DATABASE_ERROR", message: "設定の更新に失敗しました" }
      }, { status: 500 });
    }
    
    console.log("✅ 割引設定更新完了");
    
    return Response.json({
      success: true,
      data: data.settings,
      message: "割引設定を保存しました"
    });
    
  } catch (error) {
    console.error("❌ 割引設定更新API エラー:", error);
    return Response.json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "システムエラーが発生しました" }
    }, { status: 500 });
  }
}

// バリデーション関数
function validateDiscountSettings(settings: any): { isValid: boolean; error?: string } {
  if (!settings.discount_type || !["percentage", "fixed_amount"].includes(settings.discount_type)) {
    return { isValid: false, error: "割引タイプが正しくありません" };
  }
  
  if (typeof settings.discount_value !== "number" || settings.discount_value < 0) {
    return { isValid: false, error: "割引値は0以上の数値で入力してください" };
  }
  
  if (settings.discount_type === "percentage" && settings.discount_value > 100) {
    return { isValid: false, error: "割引率は100%以下で入力してください" };
  }
  
  return { isValid: true };
}

// 割引設定削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId } = await params;
    
    console.log(`🗑️ 割引設定削除: shopId=${shopId}`);
    
    const supabase = await createServerSupabaseClient();
    
    const { error } = await supabase
      .from("shop_discount_settings")
      .delete()
      .eq("shop_id", shopId);
    
    if (error) {
      console.error("❌ 割引設定削除エラー:", error);
      return Response.json({
        success: false,
        error: { code: "DATABASE_ERROR", message: "設定の削除に失敗しました" }
      }, { status: 500 });
    }
    
    console.log("✅ 割引設定削除完了");
    
    return Response.json({
      success: true,
      message: "割引設定を削除しました"
    });
    
  } catch (error) {
    console.error("❌ 割引設定削除API エラー:", error);
    return Response.json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "システムエラーが発生しました" }
    }, { status: 500 });
  }
}