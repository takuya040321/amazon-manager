"use client"

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Eye, Package, Download, Mail, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { useOrders } from "@/hooks/use-orders"
import { useReviewRequests } from "@/hooks/use-review-requests"
import { useDateFilter } from "@/hooks/use-date-filter"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Order } from "@/types/order"

function getStatusColor(status: string) {
  switch (status) {
    case "完了":
      return "bg-green-100 text-green-800"
    case "発送済み":
      return "bg-blue-100 text-blue-800"
    case "配送中":
      return "bg-yellow-100 text-yellow-800"
    case "処理中":
      return "bg-orange-100 text-orange-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getFulfillmentChannelLabel(channel: string) {
  return channel === "AFN" ? "FBA" : "FBM"
}

export default function OrdersPage() {
  const { 
    orders, 
    isLoading, 
    error, 
    lastUpdated, 
    totalCount, 
    hasMorePages,
    refreshOrders, 
    loadMoreOrders,
    filterByDateRange 
  } = useOrders()
  const { sendBatchReviewRequests, isLoading: isReviewLoading } = useReviewRequests()
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  
  // 日付フィルター
  const {
    startDate,
    endDate,
    isDateRangeSelected,
    setStartDate,
    setEndDate,
    clearDateFilter,
    getDateFilterParams,
  } = useDateFilter()

  // 日付フィルターが変更された時の処理
  const handleDateFilterApply = async () => {
    const params = getDateFilterParams()
    await filterByDateRange(params.createdAfter, params.createdBefore)
  }

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev => 
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    )
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const eligibleOrderIds = orders
        .filter(order => canSendReviewRequest(order))
        .map(order => order.id)
      setSelectedOrders(eligibleOrderIds)
    } else {
      setSelectedOrders([])
    }
  }

  const handleSendReviewRequests = async () => {
    if (selectedOrders.length === 0) return

    const result = await sendBatchReviewRequests(selectedOrders)
    if (result) {
      alert(`${result.sentCount}件のレビュー依頼を送信しました（失敗: ${result.failedCount}件）`)
      setSelectedOrders([])
      refreshOrders()
    }
  }

  const canSendReviewRequest = (order: Order): boolean => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const orderDate = new Date(order.purchaseDate)
    
    return (
      orderDate >= thirtyDaysAgo &&
      ["発送済み", "完了", "配送中"].includes(order.orderStatus) &&
      !order.reviewRequestSent &&
      !!(order.customer.email || order.customer.buyerInfo?.buyerEmail)
    )
  }

  const stats = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
    averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0,
    processingOrders: orders.filter(order => order.orderStatus === "処理中").length,
    eligibleForReview: orders.filter(canSendReviewRequest).length,
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => refreshOrders()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              再試行
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">レビュー依頼</h1>
            <p className="text-muted-foreground">
              Amazon注文からレビュー依頼を送信（今日から過去1週間の10件を表示）
              {lastUpdated && (
                <span className="ml-2 text-sm">
                  （最終更新: {new Date(lastUpdated).toLocaleString("ja-JP")}）
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedOrders.length > 0 && (
              <Button 
                onClick={handleSendReviewRequests} 
                disabled={isReviewLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="mr-2 h-4 w-4" />
                {isReviewLoading ? "送信中..." : `選択した${selectedOrders.length}件にレビュー依頼`}
              </Button>
            )}
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              エクスポート
            </Button>
            <Button onClick={() => refreshOrders()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              更新
            </Button>
          </div>
        </div>

        {/* 期間選択フィルター */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">期間フィルター</CardTitle>
              {isDateRangeSelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearDateFilter()
                    refreshOrders()
                  }}
                  disabled={isLoading}
                >
                  全期間表示
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={() => {
                  clearDateFilter()
                  refreshOrders()
                }}
                className="flex-1"
              />
              <Button
                onClick={handleDateFilterApply}
                disabled={isLoading || (!startDate && !endDate)}
                className="ml-4"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    検索中...
                  </>
                ) : (
                  "期間で絞り込み"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総注文数</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                {isDateRangeSelected ? "選択期間" : "過去3ヶ月間"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総売上</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {isDateRangeSelected ? "選択期間" : "過去3ヶ月間"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均注文金額</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{Math.round(stats.averageOrderValue).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                1注文あたり
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">処理中注文</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processingOrders}</div>
              <p className="text-xs text-muted-foreground">
                要処理の注文
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">レビュー依頼可能</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.eligibleForReview}</div>
              <p className="text-xs text-muted-foreground">
                送信可能な注文
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>レビュー依頼対象注文</CardTitle>
            <CardDescription>
              発送済み・30日以内・未送信の注文（チェックした注文にレビュー依頼を送信できます）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                注文データを取得中...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                注文データが見つかりません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length > 0 && selectedOrders.length === orders.filter(canSendReviewRequest).length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>注文ID</TableHead>
                    <TableHead>注文日</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>金額</TableHead>
                    <TableHead>商品数</TableHead>
                    <TableHead>配送方法</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>レビュー依頼</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order, index) => {
                    const eligible = canSendReviewRequest(order)
                    return (
                      <TableRow key={`${order.amazonOrderId}-${order.id}-${index}`}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                            disabled={!eligible}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.amazonOrderId}
                        </TableCell>
                        <TableCell>
                          {new Date(order.purchaseDate).toLocaleDateString("ja-JP")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {order.items.length > 0 && order.items[0].imageUrl ? (
                              <img
                                src={order.items[0].imageUrl}
                                alt={order.items[0].title}
                                className="w-10 h-10 object-cover rounded border"
                                onError={(e) => {
                                  // 画像読み込みエラー時はPackageアイコンを表示
                                  const target = e.currentTarget
                                  target.style.display = 'none'
                                  const fallback = target.nextElementSibling as HTMLElement
                                  if (fallback) fallback.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <div className="w-10 h-10 bg-gray-200 rounded border flex items-center justify-center" style={{ display: order.items.length > 0 && order.items[0].imageUrl ? 'none' : 'flex' }}>
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {order.items.length > 0 ? order.items[0].title : "商品情報取得中"}
                              </div>
                              {order.items.length > 1 && (
                                <div className="text-xs text-muted-foreground">
                                  他{order.items.length - 1}点
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>¥{order.totalAmount.toLocaleString()}</TableCell>
                        <TableCell>{order.numberOfItemsShipped + order.numberOfItemsUnshipped}個</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFulfillmentChannelLabel(order.fulfillmentChannel)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.orderStatus)}>
                            {order.orderStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.reviewRequestSent ? (
                            <Badge className="bg-green-100 text-green-800">送信済み</Badge>
                          ) : eligible ? (
                            <Badge className="bg-blue-100 text-blue-800">送信可能</Badge>
                          ) : (
                            <Badge variant="outline">対象外</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                            詳細
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ページネーション */}
        {hasMorePages && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={loadMoreOrders}
              disabled={isLoading}
              className="px-6"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  読み込み中...
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  さらに読み込む
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}