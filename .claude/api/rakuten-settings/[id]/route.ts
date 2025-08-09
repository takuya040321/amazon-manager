import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { RakutenShopConfig, UpdateRakutenShopConfigRequest } from "@/types/rakuten";

// 個別設定取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    
    const { data: config, error } = await supabase
      .from("rakuten_shop_configs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("楽天ショップ設定取得エラー:", error);
      return NextResponse.json(
        { success: false, error: "設定が見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config as RakutenShopConfig
    });

  } catch (error) {
    console.error("楽天ショップ設定取得エラー:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 設定更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateRakutenShopConfigRequest = await request.json();
    
    const supabase = await createServerSupabaseClient();
    
    // 更新データの準備
    const updateData: any = {};
    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.shop_code !== undefined) updateData.shop_code = body.shop_code;
    if (body.genre_id !== undefined) updateData.genre_id = body.genre_id || null;
    if (body.keyword !== undefined) updateData.keyword = body.keyword || null;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data: updatedConfig, error } = await supabase
      .from("rakuten_shop_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("楽天ショップ設定更新エラー:", error);
      return NextResponse.json(
        { success: false, error: "設定の更新に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedConfig as RakutenShopConfig
    });

  } catch (error) {
    console.error("楽天ショップ設定更新エラー:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 設定削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    
    const { error } = await supabase
      .from("rakuten_shop_configs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("楽天ショップ設定削除エラー:", error);
      return NextResponse.json(
        { success: false, error: "設定の削除に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "設定を削除しました"
    });

  } catch (error) {
    console.error("楽天ショップ設定削除エラー:", error);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}