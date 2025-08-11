import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()
    
    if (!Array.isArray(orderIds)) {
      return NextResponse.json(
        { error: "orderIds must be an array" },
        { status: 400 }
      )
    }

    console.log(`[DEBUG] 商品詳細取得開始: ${orderIds.length}件`)

    // 注文IDから商品詳細を取得して更新
    const enrichedOrders = await amazonApiService.enrichOrdersByIds(orderIds)

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      count: enrichedOrders.length
    })
  } catch (error) {
    console.error("Orders enrichment error:", error)
    return NextResponse.json(
      { 
        error: "商品詳細の取得に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}