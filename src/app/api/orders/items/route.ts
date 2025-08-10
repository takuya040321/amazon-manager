import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"
import { cacheService } from "@/lib/cache"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "有効な注文IDリストを指定してください" },
        { status: 400 }
      )
    }

    // キャッシュから注文データを取得
    const cachedOrders = cacheService.getOrders()
    if (!cachedOrders) {
      return NextResponse.json(
        { error: "注文データが見つかりません" },
        { status: 404 }
      )
    }

    const updatedItems: { [orderId: string]: any[] } = {}

    // 指定された注文IDの商品詳細を取得
    for (const orderId of orderIds.slice(0, 10)) { // 一度に最大10件まで処理
      try {
        const order = cachedOrders.orders.find(o => o.amazonOrderId === orderId)
        if (!order) {
          console.warn(`Order not found: ${orderId}`)
          continue
        }

        console.log(`[DEBUG] 商品詳細取得開始: ${orderId}`)
        const items = await amazonApiService.getOrderItems(orderId)
        updatedItems[orderId] = items

        // キャッシュ内の注文情報を更新
        const orderIndex = cachedOrders.orders.findIndex(o => o.amazonOrderId === orderId)
        if (orderIndex !== -1) {
          cachedOrders.orders[orderIndex].items = items
        }

        console.log(`[DEBUG] 商品詳細取得完了: ${orderId}, 商品数: ${items.length}`)

        // API制限対応: 1秒間隔
        if (orderIds.indexOf(orderId) < Math.min(orderIds.length, 10) - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`商品詳細取得エラー ${orderId}:`, error)
        updatedItems[orderId] = [{
          id: "error",
          title: "商品情報取得エラー",
          asin: "",
          quantity: 1,
          price: 0,
          imageUrl: "",
        }]
      }
    }

    // 更新されたキャッシュを保存
    cacheService.setOrders(cachedOrders)

    return NextResponse.json({
      success: true,
      updatedItems,
      processedCount: Object.keys(updatedItems).length
    })

  } catch (error) {
    console.error("Order items API error:", error)
    return NextResponse.json(
      { 
        error: "商品詳細の取得に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}