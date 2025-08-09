import { NextRequest, NextResponse } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const name = searchParams.get("name");

    const supabase = await unifiedSupabase.getClient();
    
    let query = supabase
      .from("shops")
      .select("*");

    if (category) {
      query = query.eq("category", category);
    }

    if (name) {
      query = query.eq("name", name);
    }

    const { data: shops, error } = await query;

    if (error) {
      console.error("❌ ショップ取得エラー:", error);
      return NextResponse.json({
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "ショップ情報の取得に失敗しました"
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: shops || []
    });

  } catch (error) {
    console.error("❌ ショップAPI エラー:", error);
    return NextResponse.json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "システムエラーが発生しました"
      }
    }, { status: 500 });
  }
}