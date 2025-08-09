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
        throw new Error(data.error || "レビュー依頼の送信に失敗しました")
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
        throw new Error(data.error || "一斉レビュー依頼の送信に失敗しました")
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