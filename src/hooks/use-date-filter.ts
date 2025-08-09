"use client"

import { useState, useCallback } from "react"

interface DateFilter {
  startDate: Date | undefined
  endDate: Date | undefined
}

interface UseDateFilterState extends DateFilter {
  isDateRangeSelected: boolean
}

interface UseDateFilterActions {
  setStartDate: (date: Date | undefined) => void
  setEndDate: (date: Date | undefined) => void
  setDateRange: (startDate: Date | undefined, endDate: Date | undefined) => void
  clearDateFilter: () => void
  getDateFilterParams: () => { createdAfter?: string; createdBefore?: string }
}

export function useDateFilter(): UseDateFilterState & UseDateFilterActions {
  const [state, setState] = useState<DateFilter>({
    startDate: undefined,
    endDate: undefined,
  })

  const setStartDate = useCallback((date: Date | undefined) => {
    setState(prev => ({ ...prev, startDate: date }))
  }, [])

  const setEndDate = useCallback((date: Date | undefined) => {
    setState(prev => ({ ...prev, endDate: date }))
  }, [])

  const setDateRange = useCallback((startDate: Date | undefined, endDate: Date | undefined) => {
    setState({ startDate, endDate })
  }, [])

  const clearDateFilter = useCallback(() => {
    setState({ startDate: undefined, endDate: undefined })
  }, [])

  const getDateFilterParams = useCallback(() => {
    const params: { createdAfter?: string; createdBefore?: string } = {}
    
    if (state.startDate) {
      params.createdAfter = state.startDate.toISOString()
    }
    
    if (state.endDate) {
      // 終了日は23:59:59に設定
      const endOfDay = new Date(state.endDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      // Amazon SP-API制限：CreatedBeforeは現在時刻から2分前より古い必要がある
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
      const finalEndDate = endOfDay > twoMinutesAgo ? twoMinutesAgo : endOfDay
      
      params.createdBefore = finalEndDate.toISOString()
    }
    
    return params
  }, [state.startDate, state.endDate])

  const isDateRangeSelected = !!(state.startDate || state.endDate)

  return {
    ...state,
    isDateRangeSelected,
    setStartDate,
    setEndDate,
    setDateRange,
    clearDateFilter,
    getDateFilterParams,
  }
}