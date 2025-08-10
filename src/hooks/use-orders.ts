"use client"

import { useState, useEffect, useCallback } from "react"
import { Order, OrdersResponse } from "@/types/order"

interface UseOrdersState {
  orders: Order[]
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
  totalCount: number
  nextToken?: string | null
  hasMorePages: boolean
}

interface UseOrdersActions {
  refreshOrders: (dateParams?: { createdAfter?: string; createdBefore?: string }) => Promise<void>
  getEligibleOrdersForReview: () => Promise<Order[]>
  loadMoreOrders: () => Promise<void>
  filterByDateRange: (startDate?: string, endDate?: string) => Promise<void>
}

export function useOrders(): UseOrdersState & UseOrdersActions {
  const [state, setState] = useState<UseOrdersState>({
    orders: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
    totalCount: 0,
    nextToken: null,
    hasMorePages: false,
  })

  const refreshOrders = useCallback(async (dateParams?: { createdAfter?: string; createdBefore?: string }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const searchParams = new URLSearchParams()
      searchParams.set("refresh", "true")
      
      if (dateParams?.createdAfter) {
        searchParams.set("createdAfter", dateParams.createdAfter)
      }
      if (dateParams?.createdBefore) {
        searchParams.set("createdBefore", dateParams.createdBefore)
      }
      
      const url = `/api/orders?${searchParams.toString()}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "注文データの取得に失敗しました")
      }

      const ordersData: OrdersResponse = await response.json()

      // 注文日時で新しい順（降順）にソート
      const sortedOrders = ordersData.orders.sort((a, b) => 
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      )

      setState({
        orders: sortedOrders,
        isLoading: false,
        error: null,
        lastUpdated: ordersData.lastUpdated,
        totalCount: ordersData.totalCount || sortedOrders.length,
        nextToken: ordersData.nextToken,
        hasMorePages: !!ordersData.nextToken,
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "未知のエラーが発生しました",
      }))
    }
  }, [])

  const loadMoreOrders = useCallback(async () => {
    if (!state.nextToken || state.isLoading) return

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const url = `/api/orders?nextToken=${encodeURIComponent(state.nextToken)}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "追加注文データの取得に失敗しました")
      }

      const ordersData: OrdersResponse = await response.json()

      setState(prev => {
        // 重複を防ぐため、既存の注文IDをセットに保存
        const existingOrderIds = new Set(prev.orders.map(order => order.id))
        const newOrders = ordersData.orders.filter(order => !existingOrderIds.has(order.id))
        
        // 結合した注文リストを新しい順（降順）でソート
        const allOrders = [...prev.orders, ...newOrders].sort((a, b) => 
          new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        )
        
        return {
          ...prev,
          orders: allOrders,
          isLoading: false,
          error: null,
          lastUpdated: ordersData.lastUpdated,
          totalCount: (prev.totalCount || 0) + newOrders.length,
          nextToken: ordersData.nextToken,
          hasMorePages: !!ordersData.nextToken,
        }
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "未知のエラーが発生しました",
      }))
    }
  }, [state.nextToken, state.isLoading])

  const filterByDateRange = useCallback(async (startDate?: string, endDate?: string) => {
    const dateParams: { createdAfter?: string; createdBefore?: string } = {}
    if (startDate) dateParams.createdAfter = startDate
    if (endDate) dateParams.createdBefore = endDate
    
    await refreshOrders(dateParams)
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

  // 初回ロード時にデータ取得（簡素化）
  const loadInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const searchParams = new URLSearchParams()
      searchParams.set("refresh", "true")
      searchParams.set("maxResults", "100")
      
      const url = `/api/orders?${searchParams.toString()}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(300000)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "レスポンスの解析に失敗しました" }))
        throw new Error(errorData.error || `HTTP ${response.status}: 注文データの取得に失敗しました`)
      }
      
      const ordersData: OrdersResponse = await response.json()
      
      // 注文日時で新しい順（降順）にソート
      const sortedOrders = (ordersData.orders || []).sort((a, b) => 
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      )
      
      setState({
        orders: sortedOrders,
        isLoading: false,
        error: null,
        lastUpdated: ordersData.lastUpdated || new Date().toISOString(),
        totalCount: sortedOrders.length,
        nextToken: ordersData.nextToken,
        hasMorePages: !!ordersData.nextToken,
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "未知のエラーが発生しました",
      }))
    }
  }, [])

  // 初回ロード時にデータを取得
  useEffect(() => {
    loadInitialData()
  }, [])

  return {
    ...state,
    refreshOrders,
    getEligibleOrdersForReview,
    loadMoreOrders,
    filterByDateRange,
  }
}