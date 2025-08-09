import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"
import { cacheService } from "@/lib/cache"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const forceRefresh = searchParams.get("refresh") === "true"

  try {
    // キャッシュから取得を試みる（リフレッシュが指定されていない場合）
    if (!forceRefresh) {
      const cachedOrders = cacheService.getOrders()
      if (cachedOrders) {
        return NextResponse.json(cachedOrders)
      }
    }

    // Amazon APIから新しいデータを取得
    const createdAfter = searchParams.get("createdAfter") || 
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 過去90日

    const ordersResponse = await amazonApiService.getOrders({
      createdAfter,
      maxResultsPerPage: 100,
    })

    // キャッシュに保存
    cacheService.setOrders(ordersResponse)

    return NextResponse.json(ordersResponse)
  } catch (error) {
    console.error("Orders API error:", error)
    return NextResponse.json(
      { 
        error: "注文データの取得に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}