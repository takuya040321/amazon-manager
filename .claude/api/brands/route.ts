import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// ブランド一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");
    
    const supabase = await createServerSupabaseClient();
    
    if (shopId) {
      // 特定ショップのブランド一覧取得
      const { data, error } = await supabase
        .from("shop_brands")
        .select(`
          *,
          brand:brands(*),
          shop:shops(*)
        `)
        .eq("shop_id", shopId)
        .eq("is_active", true);
      
      if (error) {
        console.error("ショップブランド取得エラー:", error);
        return NextResponse.json(
          { success: false, error: "ショップブランド取得に失敗しました" },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: data || []
      });
    } else {
      // 全ブランド一覧取得
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("is_active", true)
        .order("display_name");
      
      if (error) {
        console.error("ブランド取得エラー:", error);
        return NextResponse.json(
          { success: false, error: "ブランド取得に失敗しました" },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: data || []
      });
    }
  } catch (error) {
    console.error("API実行エラー:", error);
    return NextResponse.json(
      { success: false, error: "内部サーバーエラー" },
      { status: 500 }
    );
  }
}

// 新しいブランド作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, display_name, brand_id, description, official_url, logo_url } = body;
    
    // 必須フィールドの検証
    if (!name || !display_name) {
      return NextResponse.json(
        { success: false, error: "name と display_name は必須です" },
        { status: 400 }
      );
    }
    
    const supabase = await createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from("brands")
      .insert({
        name,
        display_name,
        brand_id,
        description,
        official_url,
        logo_url,
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      console.error("ブランド作成エラー:", error);
      
      // 重複エラーのハンドリング
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "このブランド名は既に存在します" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: "ブランド作成に失敗しました" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("API実行エラー:", error);
    return NextResponse.json(
      { success: false, error: "内部サーバーエラー" },
      { status: 500 }
    );
  }
}