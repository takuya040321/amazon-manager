"use client"

import { useState, useEffect, useCallback } from "react"
import { Order, OrdersResponse } from "@/types/order"

interface UseOrdersState {
  orders: Order[]
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
  totalCount: number
}

interface UseOrdersActions {
  refreshOrders: () => Promise<void>
  getEligibleOrdersForReview: () => Promise<Order[]>
}

export function useOrders(): UseOrdersState & UseOrdersActions {
  const [state, setState] = useState<UseOrdersState>({
    orders: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
    totalCount: 0,
  })

  const refreshOrders = useCallback(async (forceRefresh = false) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const url = forceRefresh ? "/api/orders?refresh=true" : "/api/orders"
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "注文データの取得に失敗しました")
      }

      const ordersData: OrdersResponse = await response.json()

      setState({
        orders: ordersData.orders,
        isLoading: false,
        error: null,
        lastUpdated: ordersData.lastUpdated,
        totalCount: ordersData.totalCount || ordersData.orders.length,
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "未知のエラーが発生しました",
      }))
    }
  }, [])

  const getEligibleOrdersForReview = useCallback(async (): Promise<Order[]> => {
    try {
      const response = await fetch("/api/orders/review-request")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "対象注文の取得に失敗しました")
      }

      const data = await response.json()
      return data.orders || []
    } catch (error) {
      console.error("Failed to get eligible orders:", error)
      return []
    }
  }, [])

  // 初回ロード時にデータを取得
  useEffect(() => {
    refreshOrders(false)
  }, [refreshOrders])

  return {
    ...state,
    refreshOrders: () => refreshOrders(true),
    getEligibleOrdersForReview,
  }
}