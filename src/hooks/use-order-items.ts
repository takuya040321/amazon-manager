"use client"

import { useState, useCallback } from "react"

interface UseOrderItemsState {
  isLoading: boolean
  error: string | null
  loadingItems: Set<string> // 現在読み込み中の注文ID
}

interface UseOrderItemsActions {
  loadOrderItems: (orderIds: string[]) => Promise<{ [orderId: string]: any[] } | null>
}

export function useOrderItems(): UseOrderItemsState & UseOrderItemsActions {
  const [state, setState] = useState<UseOrderItemsState>({
    isLoading: false,
    error: null,
    loadingItems: new Set(),
  })

  const loadOrderItems = useCallback(async (orderIds: string[]): Promise<{ [orderId: string]: any[] } | null> => {
    if (orderIds.length === 0) return null

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      loadingItems: new Set([...prev.loadingItems, ...orderIds])
    }))

    try {
      const response = await fetch("/api/orders/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderIds }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "商品詳細の取得に失敗しました")
      }

      setState(prev => ({
        isLoading: false,
        error: null,
        loadingItems: new Set([...prev.loadingItems].filter(id => !orderIds.includes(id)))
      }))

      return data.updatedItems
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知のエラーが発生しました"
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        loadingItems: new Set([...prev.loadingItems].filter(id => !orderIds.includes(id)))
      }))
      return null
    }
  }, [])

  return {
    ...state,
    loadOrderItems,
  }
}