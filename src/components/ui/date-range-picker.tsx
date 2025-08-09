"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  startDate?: Date
  endDate?: Date
  onStartDateChange?: (date: Date | undefined) => void
  onEndDateChange?: (date: Date | undefined) => void
  onClear?: () => void
  className?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  className,
}: DateRangePickerProps) {
  const [startOpen, setStartOpen] = React.useState(false)
  const [endOpen, setEndOpen] = React.useState(false)

  const formatDate = (date: Date | undefined) => {
    return date ? format(date, "yyyy/MM/dd", { locale: ja }) : ""
  }

  const hasDateSelection = startDate || endDate

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">期間:</span>
        
        {/* 開始日選択 */}
        <Popover open={startOpen} onOpenChange={setStartOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? formatDate(startDate) : "開始日"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => {
                onStartDateChange?.(date)
                setStartOpen(false)
              }}
              disabled={(date) => {
                // Amazon SP-API制限により、2分前より後の日付は無効
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
                return date > twoMinutesAgo || (endDate && date > endDate)
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground">〜</span>

        {/* 終了日選択 */}
        <Popover open={endOpen} onOpenChange={setEndOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? formatDate(endDate) : "終了日"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => {
                onEndDateChange?.(date)
                setEndOpen(false)
              }}
              disabled={(date) => {
                // Amazon SP-API制限により、2分前より後の日付は無効
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
                return date > twoMinutesAgo || (startDate && date < startDate)
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* クリアボタン */}
        {hasDateSelection && onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}