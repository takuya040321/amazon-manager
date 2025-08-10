import { NextRequest, NextResponse } from "next/server"
import { reviewService } from "@/lib/review-service"
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

    const cachedOrders = cacheService.getOrders()
    if (!cachedOrders) {
      return NextResponse.json(
        { error: "注文データが見つかりません" },
        { status: 404 }
      )
    }

    const eligibilityResults: { [orderId: string]: { eligible: boolean; reason?: string } } = {}

    // 指定された注文IDについてAmazon APIで実際のレビュー依頼可能状態をチェック
    for (const orderId of orderIds) {
      const order = cachedOrders.orders.find(o => o.id === orderId)
      if (!order) {
        eligibilityResults[orderId] = { eligible: false, reason: "注文が見つかりません" }
        continue
      }

      // 基本条件チェック
      const basicEligible = reviewService.getEligibleOrdersForReview([order]).length > 0
      if (!basicEligible) {
        eligibilityResults[orderId] = { eligible: false, reason: "基本条件不適合（期限切れ、未発送、メール不明等）" }
        continue
      }

      // Amazon APIで実際の送信可能状態をチェック
      const apiEligible = await reviewService.checkSolicitationEligibility(order)
      eligibilityResults[orderId] = {
        eligible: apiEligible,
        reason: apiEligible ? "送信可能" : "Amazon側で対象外（送信済み、対象外カテゴリ等）"
      }

      // APIレート制限対応（毎秒1リクエスト）
      if (orderIds.indexOf(orderId) < orderIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      results: eligibilityResults
    })

  } catch (error) {
    console.error("Eligibility check API error:", error)
    return NextResponse.json(
      { 
        error: "送信可能状態の確認に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}