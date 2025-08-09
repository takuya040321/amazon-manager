import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { RakutenShopConfig } from "@/types/rakuten";

// サイドバー用：アクティブな楽天ショップ設定のみ取得
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: configs, error } = await supabase
      .from("rakuten_shop_configs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("アクティブ楽天ショップ設定取得エラー:", error);
      
      // テーブルが存在しない場合の特別な処理
      if (error.code === "42P01" || error.message.includes("relation \"rakuten_shop_configs\" does not exist")) {
        return NextResponse.json({
          success: false,
          error: "楽天ショップ設定テーブルが作成されていません。",
          needsMigration: true
        }, { status: 503 });
      }
      
      return NextResponse.json(
        { success: false, error: `設定の取得に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: configs as RakutenShopConfig[]
    });

  } catch (error) {
    console.error("アクティブ楽天ショップ設定取得エラー:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}