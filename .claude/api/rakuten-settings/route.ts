import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { RakutenShopConfig, CreateRakutenShopConfigRequest } from "@/types/rakuten";

// 楽天ショップ設定一覧取得
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: configs, error } = await supabase
      .from("rakuten_shop_configs")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("楽天ショップ設定取得エラー:", error);
      
      // テーブルが存在しない場合の特別な処理
      if (error.code === "42P01" || error.message.includes("relation \"rakuten_shop_configs\" does not exist")) {
        return NextResponse.json({
          success: false,
          error: "楽天ショップ設定テーブルが作成されていません。データベースマイグレーションを実行してください。",
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
    console.error("楽天ショップ設定取得エラー:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 楽天ショップ設定作成
export async function POST(request: NextRequest) {
  try {
    const body: CreateRakutenShopConfigRequest = await request.json();
    
    // バリデーション
    if (!body.shop_name || !body.display_name || !body.shop_code) {
      return NextResponse.json(
        { success: false, error: "必須フィールドが不足しています" },
        { status: 400 }
      );
    }

    // shop_nameの重複チェック
    const supabase = await createServerSupabaseClient();
    
    const { data: existingConfig, error: checkError } = await supabase
      .from("rakuten_shop_configs")
      .select("id")
      .eq("shop_name", body.shop_name)
      .single();

    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = not found
      console.error("重複チェックエラー:", checkError);
      return NextResponse.json(
        { success: false, error: "設定の確認に失敗しました" },
        { status: 500 }
      );
    }

    if (existingConfig) {
      return NextResponse.json(
        { success: false, error: "同じショップ名が既に存在します" },
        { status: 409 }
      );
    }

    // 新規作成
    const { data: newConfig, error: insertError } = await supabase
      .from("rakuten_shop_configs")
      .insert({
        shop_name: body.shop_name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        display_name: body.display_name,
        shop_code: body.shop_code,
        genre_id: body.genre_id || null,
        keyword: body.keyword || null,
        is_active: body.is_active ?? true
      })
      .select()
      .single();

    if (insertError) {
      console.error("楽天ショップ設定作成エラー:", insertError);
      return NextResponse.json(
        { success: false, error: "設定の作成に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newConfig as RakutenShopConfig
    });

  } catch (error) {
    console.error("楽天ショップ設定作成エラー:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}