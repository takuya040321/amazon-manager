"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Order, OrdersResponse } from "@/types/order"

interface UseOrdersState {
  orders: Order[]
  isLoading: boolean
  error: string | null
  lastUpdated: string | null
  totalCount: number
  nextToken?: string | null
  hasMorePages: boolean
  // ページネーション状態
  currentPage: number
  itemsPerPage: number
  totalPages: number
}

interface UseOrdersActions {
  refreshOrders: (dateParams?: { createdAfter?: string; createdBefore?: string }) => Promise<void>
  getEligibleOrdersForReview: () => Promise<Order[]>
  goToNextPage: () => Promise<void>
  goToPreviousPage: () => Promise<void>
  goToPage: (page: number) => Promise<void>
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
    currentPage: 1,
    itemsPerPage: 100,
    totalPages: 1,
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const refreshOrders = useCallback(async (dateParams?: { createdAfter?: string; createdBefore?: string }, forceRefresh = true) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const searchParams = new URLSearchParams()
      if (forceRefresh) {
        searchParams.set("refresh", "true")
      }
      
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
        currentPage: 1,
        itemsPerPage: 100,
        totalPages: Math.ceil((ordersData.totalCount || sortedOrders.length) / 100),
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "注文データの取得に失敗しました",
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

  const goToNextPage = useCallback(async () => {
    setState(prev => {
      if (!prev.nextToken || prev.isLoading) return prev
      
      // 非同期処理を開始
      const fetchNextPage = async () => {
        try {
          const searchParams = new URLSearchParams()
          searchParams.set("nextToken", prev.nextToken!)
          searchParams.set("refresh", "true") // キャッシュを回避
          
          const response = await fetch(`/api/orders?${searchParams.toString()}`)
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "次のページの取得に失敗しました")
          }
          
          const ordersData: OrdersResponse = await response.json()
          
          const sortedOrders = ordersData.orders.sort((a, b) => 
            new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
          )
          
          setState(current => ({
            ...current,
            orders: sortedOrders,
            isLoading: false,
            currentPage: current.currentPage + 1,
            nextToken: ordersData.nextToken,
            hasMorePages: !!ordersData.nextToken,
          }))
        } catch (error) {
          setState(current => ({
            ...current,
            isLoading: false,
            error: error instanceof Error ? error.message : "次のページの取得に失敗しました",
          }))
        }
      }
      
      fetchNextPage()
      
      return {
        ...prev,
        isLoading: true,
        error: null
      }
    })
  }, [])

  const goToPreviousPage = useCallback(async () => {
    setState(prev => {
      if (prev.currentPage <= 1 || prev.isLoading) return prev
      
      // 前のページへの移動は複雑なため、単純に最初からフェッチし直す（保存データを優先）
      refreshOrders(undefined, false)
      
      return prev
    })
  }, [refreshOrders])

  const goToPage = useCallback(async (page: number) => {
    setState(prev => {
      if (page === prev.currentPage || prev.isLoading) return prev
      
      // 指定ページへの移動は複雑なため、最初からフェッチし直す（保存データを優先）
      refreshOrders(undefined, false)
      
      return prev
    })
  }, [refreshOrders])

  const filterByDateRange = useCallback(async (startDate?: string, endDate?: string) => {
    await refreshOrders({
      createdAfter: startDate,
      createdBefore: endDate
    })
  }, [refreshOrders])


  // 初回ロード時にデータ取得（保存されたデータを優先）
  const loadInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const searchParams = new URLSearchParams()
      // 初回ロードでは強制リフレッシュしない（保存データを優先）
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
      
      const totalCount = ordersData.totalCount || sortedOrders.length
      
      setState({
        orders: sortedOrders,
        isLoading: false,
        error: null,
        lastUpdated: ordersData.lastUpdated,
        totalCount,
        nextToken: ordersData.nextToken,
        hasMorePages: !!ordersData.nextToken,
        currentPage: 1,
        itemsPerPage: 100,
        totalPages: Math.ceil(totalCount / 100),
      })
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "データの取得に失敗しました",
      }))
    }
  }, [])

  // クリーンアップ
  const cleanup = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // 初回ロード時にデータを取得
  useEffect(() => {
    loadInitialData()
  }, [])

  // クリーンアップ用のuseEffect
  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return {
    ...state,
    refreshOrders,
    getEligibleOrdersForReview,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    filterByDateRange,
  }
}