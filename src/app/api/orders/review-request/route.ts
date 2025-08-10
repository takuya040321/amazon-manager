import { NextRequest, NextResponse } from "next/server"
import { reviewService } from "@/lib/review-service"
import { cacheService } from "@/lib/cache"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderIds, type = "batch", customTemplate } = body

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
        { error: "注文データが見つかりません。先に注文データを取得してください。" },
        { status: 404 }
      )
    }

    // 指定された注文IDの注文を取得
    const targetOrders = cachedOrders.orders.filter(order => 
      orderIds.includes(order.id)
    )

    if (targetOrders.length === 0) {
      return NextResponse.json(
        { error: "指定された注文IDの注文が見つかりません" },
        { status: 404 }
      )
    }

    // レビュー依頼対象の注文をフィルタリング
    const eligibleOrders = reviewService.getEligibleOrdersForReview(targetOrders)

    if (eligibleOrders.length === 0) {
      return NextResponse.json(
        { 
          error: "レビュー依頼可能な注文がありません",
          details: "発送済み、30日以内、未送信、メールアドレスありの条件を満たす注文がありません"
        },
        { status: 400 }
      )
    }

    if (type === "batch") {
      // 一斉送信
      const batchResult = await reviewService.sendBatchReviewRequests(eligibleOrders, customTemplate)
      
      return NextResponse.json({
        success: true,
        type: "batch",
        result: batchResult,
        message: `${batchResult.sentCount}件のレビュー依頼を送信しました（失敗: ${batchResult.failedCount}件）`
      })
    } else {
      // 個別送信（1件のみ）
      if (eligibleOrders.length > 1) {
        return NextResponse.json(
          { error: "個別送信の場合は1件の注文のみ指定してください" },
          { status: 400 }
        )
      }

      const reviewRequest = await reviewService.sendReviewRequest(eligibleOrders[0], customTemplate)
      
      return NextResponse.json({
        success: reviewRequest.status === "sent",
        type: "single",
        result: reviewRequest,
        message: reviewRequest.status === "sent" 
          ? "レビュー依頼を送信しました" 
          : `レビュー依頼の送信に失敗しました: ${reviewRequest.message}`
      })
    }

  } catch (error) {
    console.error("Review request API error:", error)
    return NextResponse.json(
      { 
        error: "レビュー依頼の送信に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}

// レビュー依頼対象の注文を取得するエンドポイント
export async function GET() {
  try {
    const cachedOrders = cacheService.getOrders()
    if (!cachedOrders) {
      return NextResponse.json(
        { error: "注文データが見つかりません" },
        { status: 404 }
      )
    }

    const eligibleOrders = reviewService.getEligibleOrdersForReview(cachedOrders.orders)
    
    return NextResponse.json({
      success: true,
      totalOrders: cachedOrders.orders.length,
      eligibleOrders: eligibleOrders.length,
      orders: eligibleOrders
    })
  } catch (error) {
    console.error("Get eligible orders error:", error)
    return NextResponse.json(
      { 
        error: "対象注文の取得に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}