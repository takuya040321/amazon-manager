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
  // バックグラウンド取得状態
  isBackgroundLoading: boolean
  backgroundProgress: {
    current: number
    total: number
    status: string
  }
  cachedTotalCount: number
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
    isBackgroundLoading: false,
    backgroundProgress: {
      current: 0,
      total: 0,
      status: "待機中"
    },
    cachedTotalCount: 0,
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const backgroundJobRef = useRef<{ cancel: boolean }>({ cancel: false })
  const allOrdersCacheRef = useRef<Order[]>([])

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
    if (state.isLoading) return
    
    // キャッシュから優先的に表示
    const currentDisplayCount = state.orders.length
    const availableInCache = allOrdersCacheRef.current.length
    
    if (availableInCache > currentDisplayCount) {
      // キャッシュから即座に表示
      const additionalCount = Math.min(100, availableInCache - currentDisplayCount)
      const additionalOrders = allOrdersCacheRef.current
        .slice(currentDisplayCount, currentDisplayCount + additionalCount)
      
      setState(prev => ({
        ...prev,
        orders: [...prev.orders, ...additionalOrders],
        totalCount: prev.totalCount + additionalOrders.length,
        hasMorePages: availableInCache > currentDisplayCount + additionalCount || !!prev.nextToken
      }))
      
      console.log(`[DEBUG] キャッシュから${additionalOrders.length}件を即座に表示`)
      return
    }
    
    // キャッシュに十分なデータがない場合はAPI取得
    if (!state.nextToken) return
    
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
        
        // キャッシュも更新
        const cacheExistingIds = new Set(allOrdersCacheRef.current.map(order => order.id))
        const newCacheOrders = newOrders.filter(order => !cacheExistingIds.has(order.id))
        allOrdersCacheRef.current = [...allOrdersCacheRef.current, ...newCacheOrders]
        
        return {
          ...prev,
          orders: allOrders,
          isLoading: false,
          error: null,
          lastUpdated: ordersData.lastUpdated,
          totalCount: (prev.totalCount || 0) + newOrders.length,
          nextToken: ordersData.nextToken,
          hasMorePages: !!ordersData.nextToken,
          cachedTotalCount: allOrdersCacheRef.current.length
        }
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "未知のエラーが発生しました",
      }))
    }
  }, [state.nextToken, state.isLoading, state.orders.length])

  const filterByDateRange = useCallback(async (startDate?: string, endDate?: string) => {
    const dateParams: { createdAfter?: string; createdBefore?: string } = {}
    if (startDate) dateParams.createdAfter = startDate
    if (endDate) dateParams.createdBefore = endDate
    
    // 既存のバックグラウンド処理をキャンセル
    backgroundJobRef.current.cancel = true
    
    // キャッシュをクリア（日付フィルタの場合は別データセット）
    allOrdersCacheRef.current = []
    
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
      searchParams.set("maxResults", "100") // 100件表示に変更
      
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
      
      setState(prev => ({
        ...prev,
        orders: sortedOrders,
        isLoading: false,
        error: null,
        lastUpdated: ordersData.lastUpdated || new Date().toISOString(),
        totalCount: sortedOrders.length,
        nextToken: ordersData.nextToken,
        hasMorePages: !!ordersData.nextToken,
      }))
      
      // キャッシュを更新
      allOrdersCacheRef.current = [...sortedOrders]
      
      // バックグラウンド取得を開始
      if (ordersData.nextToken && sortedOrders.length >= 100) {
        console.log("[DEBUG] バックグラウンドでの追加データ取得を開始")
        startBackgroundFetching(ordersData.nextToken)
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "未知のエラーが発生しました",
      }))
    }
  }, [])

  // バックグラウンドでの追加データ取得
  const startBackgroundFetching = useCallback(async (initialNextToken: string, dateParams?: { createdAfter?: string; createdBefore?: string }) => {
    // 既に実行中の場合はキャンセル
    backgroundJobRef.current.cancel = true
    await new Promise(resolve => setTimeout(resolve, 100))
    backgroundJobRef.current = { cancel: false }
    
    setState(prev => ({
      ...prev,
      isBackgroundLoading: true,
      backgroundProgress: {
        current: prev.totalCount,
        total: 0,
        status: "追加データ取得中..."
      }
    }))
    
    let nextToken = initialNextToken
    let pageCount = 1
    
    try {
      while (nextToken && !backgroundJobRef.current.cancel) {
        console.log(`[DEBUG] バックグラウンド取得 - ページ${pageCount}を取得中...`)
        
        setState(prev => ({
          ...prev,
          backgroundProgress: {
            ...prev.backgroundProgress,
            status: `追加データ取得中... (ページ${pageCount})`
          }
        }))
        
        const searchParams = new URLSearchParams()
        searchParams.set("nextToken", nextToken)
        if (dateParams?.createdAfter) {
          searchParams.set("createdAfter", dateParams.createdAfter)
        }
        if (dateParams?.createdBefore) {
          searchParams.set("createdBefore", dateParams.createdBefore)
        }
        
        const url = `/api/orders?${searchParams.toString()}`
        const response = await fetch(url)
        
        if (!response.ok) {
          console.error(`[DEBUG] バックグラウンド取得エラー - ページ${pageCount}:`, response.statusText)
          break
        }
        
        const ordersData: OrdersResponse = await response.json()
        
        if (!ordersData.orders || ordersData.orders.length === 0) {
          console.log(`[DEBUG] バックグラウンド取得完了 - データなし`)
          break
        }
        
        // キャッシュに追加
        const newOrders = ordersData.orders.filter(order => 
          !allOrdersCacheRef.current.some(cached => cached.id === order.id)
        )
        
        allOrdersCacheRef.current = [...allOrdersCacheRef.current, ...newOrders]
        
        setState(prev => ({
          ...prev,
          cachedTotalCount: allOrdersCacheRef.current.length,
          backgroundProgress: {
            current: allOrdersCacheRef.current.length,
            total: 0,
            status: `${allOrdersCacheRef.current.length}件をキャッシュ済み`
          }
        }))
        
        console.log(`[DEBUG] バックグラウンド - ページ${pageCount}: ${newOrders.length}件追加 (累計キャッシュ: ${allOrdersCacheRef.current.length}件)`)
        
        nextToken = ordersData.nextToken
        pageCount++
        
        // レート制限対応
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error("[DEBUG] バックグラウンド取得エラー:", error)
    } finally {
      setState(prev => ({
        ...prev,
        isBackgroundLoading: false,
        backgroundProgress: {
          current: allOrdersCacheRef.current.length,
          total: allOrdersCacheRef.current.length,
          status: `完了 - ${allOrdersCacheRef.current.length}件をキャッシュ`
        }
      }))
      
      console.log(`[DEBUG] バックグラウンド取得完了: 総計${allOrdersCacheRef.current.length}件をキャッシュ`)
    }
  }, [])

  // キャッシュから日付範囲でフィルタリング
  const getFilteredOrdersFromCache = useCallback((startDate?: string, endDate?: string): Order[] => {
    if (!startDate && !endDate) {
      return allOrdersCacheRef.current
    }
    
    return allOrdersCacheRef.current.filter(order => {
      const orderDate = new Date(order.purchaseDate)
      
      if (startDate) {
        const start = new Date(startDate)
        if (orderDate < start) return false
      }
      
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // その日の終わりまで含める
        if (orderDate > end) return false
      }
      
      return true
    })
  }, [])

  // クリーンアップ
  const cleanup = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    backgroundJobRef.current.cancel = true
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
    loadMoreOrders,
    filterByDateRange,
    getFilteredOrdersFromCache,
    startBackgroundFetching,
  }
}