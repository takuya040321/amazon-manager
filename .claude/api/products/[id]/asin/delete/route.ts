import { NextRequest, NextResponse } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const productId = params.id;

  if (!productId) {
    return NextResponse.json(
      { error: "商品IDが必要です" },
      { status: 400 }
    );
  }

  try {
    const supabase = await unifiedSupabase.getClient();

    // 商品のASINを削除（nullに設定）
    const { error } = await supabase
      .from("products")
      .update({ asin: null })
      .eq("id", productId);

    if (error) {
      console.error("ASIN削除エラー:", error);
      return NextResponse.json(
        { error: "ASIN削除に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "ASINを削除しました" });
  } catch (error) {
    console.error("ASIN削除エラー:", error);
    return NextResponse.json(
      { error: "ASIN削除に失敗しました" },
      { status: 500 }
    );
  }
}