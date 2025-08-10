"use client"

import { useState, useCallback } from "react"
import { Order, ReviewRequest, ReviewRequestBatch } from "@/types/order"

interface UseReviewRequestsState {
  isLoading: boolean
  error: string | null
  lastResult: ReviewRequest | ReviewRequestBatch | null
}

interface UseReviewRequestsActions {
  sendSingleReviewRequest: (orderId: string) => Promise<ReviewRequest | null>
  sendBatchReviewRequests: (orderIds: string[]) => Promise<ReviewRequestBatch | null>
  getEligibleOrders: () => Promise<Order[]>
}

export function useReviewRequests(): UseReviewRequestsState & UseReviewRequestsActions {
  const [state, setState] = useState<UseReviewRequestsState>({
    isLoading: false,
    error: null,
    lastResult: null,
  })

  const sendSingleReviewRequest = useCallback(async (orderId: string): Promise<ReviewRequest | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch("/api/orders/review-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds: [orderId],
          type: "single",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // キャッシュデータがない場合の特別処理
        if (data.error && data.error.includes("注文データが見つかりません")) {
          throw new Error("注文データが読み込まれていません。画面を更新して注文データを取得してからレビュー依頼を送信してください。")
        }
        throw new Error(data.error || "レビュー依頼の送信に失敗しました")
      }

      // レスポンスが成功でも、実際の送信が失敗した場合の処理
      if (!data.success && data.result?.message) {
        // Amazon側で対象外と判定された場合の適切なメッセージ
        if (data.result.message.includes("対象ではありません")) {
          throw new Error("Amazon側でレビュー依頼対象外と判定されました。この注文は既にレビュー依頼済みか、期限切れ、または対象外カテゴリです。")
        }
      }

      setState({
        isLoading: false,
        error: null,
        lastResult: data.result,
      })

      return data.result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知のエラーが発生しました"
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      return null
    }
  }, [])

  const sendBatchReviewRequests = useCallback(async (orderIds: string[]): Promise<ReviewRequestBatch | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch("/api/orders/review-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderIds,
          type: "batch",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // キャッシュデータがない場合の特別処理
        if (data.error && data.error.includes("注文データが見つかりません")) {
          throw new Error("注文データが読み込まれていません。画面を更新して注文データを取得してからレビュー依頼を送信してください。")
        }
        throw new Error(data.error || "一斉レビュー依頼の送信に失敗しました")
      }

      // バッチ処理の結果をより詳細に処理
      if (data.success && data.result) {
        const { sentCount, failedCount, totalCount } = data.result
        if (sentCount === 0 && failedCount === totalCount) {
          throw new Error("選択した注文はすべてAmazon側でレビュー依頼対象外と判定されました。既にレビュー依頼済み、期限切れ、または対象外カテゴリの可能性があります。")
        }
      }

      setState({
        isLoading: false,
        error: null,
        lastResult: data.result,
      })

      return data.result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知のエラーが発生しました"
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      return null
    }
  }, [])

  const getEligibleOrders = useCallback(async (): Promise<Order[]> => {
    try {
      const response = await fetch("/api/orders/review-request")

      if (!response.ok) {
        throw new Error("対象注文の取得に失敗しました")
      }

      const data = await response.json()
      return data.orders || []
    } catch (error) {
      console.error("Failed to get eligible orders:", error)
      return []
    }
  }, [])

  return {
    ...state,
    sendSingleReviewRequest,
    sendBatchReviewRequests,
    getEligibleOrders,
  }
}