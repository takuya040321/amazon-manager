import { NextRequest, NextResponse } from "next/server"
import { ordersStorage } from "@/lib/orders-storage"

export async function GET(request: NextRequest) {
  try {
    console.log("[DEBUG] JSONファイルからの注文データ読み込み開始")
    
    // JSONファイルから注文データを読み込み
    const orders = await ordersStorage.loadOrders()
    const stats = await ordersStorage.getStorageStats()
    
    console.log(`[DEBUG] 読み込み完了: ${orders.length}件`)
    
    return NextResponse.json({
      orders,
      totalCount: orders.length,
      lastUpdated: stats.lastUpdated,
      dataFetchedAt: stats.dataFetchedAt,
      isValid: stats.isValid,
      fromStorage: true
    })
  } catch (error) {
    console.error("[ERROR] JSONファイル読み込みエラー:", error)
    
    return NextResponse.json(
      { 
        error: "保存データの読み込みに失敗しました",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}