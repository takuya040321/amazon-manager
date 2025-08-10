"use client"

import { useState, useCallback } from "react"
import { Order } from "@/types/order"

interface EligibilityResult {
  [orderId: string]: {
    eligible: boolean
    reason?: string
  }
}

interface UseEligibilityCheckState {
  isChecking: boolean
  error: string | null
  results: EligibilityResult | null
}

interface UseEligibilityCheckActions {
  checkEligibility: (orderIds: string[]) => Promise<EligibilityResult | null>
  clearResults: () => void
}

export function useEligibilityCheck(): UseEligibilityCheckState & UseEligibilityCheckActions {
  const [state, setState] = useState<UseEligibilityCheckState>({
    isChecking: false,
    error: null,
    results: null,
  })

  const checkEligibility = useCallback(async (orderIds: string[]): Promise<EligibilityResult | null> => {
    if (orderIds.length === 0) return null

    setState(prev => ({ ...prev, isChecking: true, error: null }))

    try {
      const response = await fetch("/api/orders/check-eligibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderIds }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "送信可能状態の確認に失敗しました")
      }

      setState({
        isChecking: false,
        error: null,
        results: data.results,
      })

      return data.results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知のエラーが発生しました"
      setState(prev => ({
        ...prev,
        isChecking: false,
        error: errorMessage,
      }))
      return null
    }
  }, [])

  const clearResults = useCallback(() => {
    setState({
      isChecking: false,
      error: null,
      results: null,
    })
  }, [])

  return {
    ...state,
    checkEligibility,
    clearResults,
  }
}