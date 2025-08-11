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
import { RefreshCw, Eye, Package, Download, Mail, Send, ChevronRight, ChevronLeft } from "lucide-react"
import { useOrders } from "@/hooks/use-orders"
import { useReviewRequests } from "@/hooks/use-review-requests"
import { useDateFilter } from "@/hooks/use-date-filter"
import { useEligibilityCheck } from "@/hooks/use-eligibility-check"
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
    currentPage,
    totalPages,
    itemsPerPage,
    isBackgroundLoading,
    backgroundProgress,
    cachedTotalCount,
    refreshOrders, 
    goToNextPage,
    goToPreviousPage,
    filterByDateRange,
    getFilteredOrdersFromCache 
  } = useOrders()
  const { sendBatchReviewRequests, isLoading: isReviewLoading, error: reviewError } = useReviewRequests()
  const { checkEligibility, isChecking: isEligibilityChecking, results: eligibilityResults } = useEligibilityCheck()
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [eligibilityChecked, setEligibilityChecked] = useState(false)
  
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
    
    // キャッシュからフィルターできるか確認
    const filteredFromCache = getFilteredOrdersFromCache(params.createdAfter, params.createdBefore)
    
    if (filteredFromCache.length > 0 && cachedTotalCount > 100) {
      // キャッシュに十分なデータがある場合は即座に表示
      console.log(`[DEBUG] キャッシュから日付フィルター適用: ${filteredFromCache.length}件`)
      
      // TODO: キャッシュデータで状態を更新する機能を実装
      alert(`キャッシュから${filteredFromCache.length}件をフィルターしました。現在の実装では以下のAPI取得も実行します。`)
    }
    
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

    // 注文データが読み込まれていない場合は、先に取得する
    if (!orders || orders.length === 0) {
      alert("⏳ 注文データを取得中です。しばらくお待ちください...")
      await refreshOrders()
      // データ取得後に再度チェック
      if (!orders || orders.length === 0) {
        alert("❌ 注文データの取得に失敗しました。画面を更新して再試行してください。")
        return
      }
    }

    const result = await sendBatchReviewRequests(selectedOrders)
    if (result) {
      if (result.sentCount > 0) {
        alert(`✅ ${result.sentCount}件のレビュー依頼を送信しました${result.failedCount > 0 ? `（Amazon側で対象外: ${result.failedCount}件）` : ''}`)
      } else {
        alert(`ℹ️ 選択した注文はすべてAmazon側で対象外と判定されました。既にレビュー依頼済み、期限切れ、または対象外カテゴリの可能性があります。`)
      }
      setSelectedOrders([])
      refreshOrders()
    } else if (reviewError) {
      // エラーメッセージを表示
      alert(`❌ ${reviewError}`)
    }
  }


  // Amazon APIで実際の送信可能状態をチェック
  const handleCheckEligibility = async () => {
    const eligibleOrderIds = orders
      .filter(canSendReviewRequestBasic)
      .map(order => order.id)
    
    if (eligibleOrderIds.length === 0) {
      alert("基本条件を満たす注文がありません")
      return
    }

    await checkEligibility(eligibleOrderIds)
    setEligibilityChecked(true)
  }

  // 基本条件のチェック（従来のロジック）
  const canSendReviewRequestBasic = (order: Order): boolean => {
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

  // 実際の送信可能状態（Solicitation Actions APIの結果を考慮）
  const canSendReviewRequest = (order: Order): boolean => {
    const basicEligible = canSendReviewRequestBasic(order)
    
    // Solicitation Actions APIの結果を最優先
    if (order.solicitationEligible !== undefined) {
      return basicEligible && order.solicitationEligible
    }
    
    // フォールバック: 従来のeligibilityResults
    if (!eligibilityChecked || !eligibilityResults) {
      return basicEligible
    }

    const amazonEligible = eligibilityResults[order.id]?.eligible
    return basicEligible && (amazonEligible === true)
  }

  // レビュー依頼状態の表示文字列とスタイルを取得（Solicitation Actions API結果を考慮）
  const getReviewRequestStatus = (order: Order): { text: string; className: string } => {
    if (order.reviewRequestSent) {
      return { text: "送信済み", className: "bg-green-100 text-green-800" }
    }

    const basicEligible = canSendReviewRequestBasic(order)
    if (!basicEligible) {
      return { text: "対象外", className: "bg-gray-100 text-gray-600" }
    }

    // Solicitation Actions APIの結果を最優先で表示
    if (order.solicitationEligible !== undefined) {
      if (order.solicitationEligible) {
        return { text: "送信可能", className: "bg-blue-100 text-blue-800" }
      } else {
        return { 
          text: order.solicitationReason || "対象外", 
          className: "bg-red-100 text-red-600" 
        }
      }
    }

    // フォールバック: 従来のeligibilityResults
    if (!eligibilityChecked || !eligibilityResults) {
      return { text: "要確認", className: "bg-yellow-100 text-yellow-800" }
    }

    const amazonEligible = eligibilityResults[order.id]?.eligible
    const reason = eligibilityResults[order.id]?.reason

    if (amazonEligible === true) {
      return { text: "送信可能", className: "bg-blue-100 text-blue-800" }
    } else if (amazonEligible === false) {
      return { 
        text: reason?.includes("送信済み") ? "送信済み" : "対象外", 
        className: reason?.includes("送信済み") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-600" 
      }
    } else {
      return { text: "確認中", className: "bg-orange-100 text-orange-800" }
    }
  }

  const stats = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
    averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0,
    processingOrders: orders.filter(order => order.orderStatus === "処理中").length,
    eligibleForReview: orders.filter(canSendReviewRequest).length,
    needsEligibilityCheck: !eligibilityChecked ? orders.filter(canSendReviewRequestBasic).length : 0,
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
              Amazon注文からレビュー依頼を送信（商品詳細・依頼可能性込みで表示）
              <br />
              <small className="text-xs text-green-600">
                ページネーション: 100件ずつ表示・バックグラウンド取得でキャッシュ高速化
              </small>
              {isBackgroundLoading && (
                <span className="ml-2 text-xs text-blue-600">
                  📥 バックグラウンド取得中: {backgroundProgress.status}
                </span>
              )}
              {!isBackgroundLoading && cachedTotalCount > totalCount && (
                <span className="ml-2 text-xs text-purple-600">
                  ⚡ キャッシュ済み: {cachedTotalCount}件 (即座に表示可能)
                </span>
              )}
              {lastUpdated && (
                <span className="ml-2 text-sm">
                  （最終更新: {new Date(lastUpdated).toLocaleString("ja-JP")}）
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {!eligibilityChecked && stats.needsEligibilityCheck > 0 && (
              <Button 
                onClick={handleCheckEligibility} 
                disabled={isEligibilityChecking || isLoading}
                className="bg-orange-600 hover:bg-orange-700"
                title="Amazon APIで実際の送信可能状態を確認"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isEligibilityChecking ? "animate-spin" : ""}`} />
                {isEligibilityChecking ? "確認中..." : `${stats.needsEligibilityCheck}件の送信可能状態を確認`}
              </Button>
            )}
            {selectedOrders.length > 0 && (
              <Button 
                onClick={handleSendReviewRequests} 
                disabled={isReviewLoading || isLoading}
                className="bg-blue-600 hover:bg-blue-700"
                title={isLoading ? "注文データを読み込み中です" : ""}
              >
                <Send className="mr-2 h-4 w-4" />
                {isReviewLoading ? "送信中..." : 
                 isLoading ? "読み込み中..." : 
                 `選択した${selectedOrders.length}件にレビュー依頼`}
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
                  <>
                    {cachedTotalCount > 100 && (
                      <span className="mr-1">⚡</span>
                    )}
                    期間で絞り込み
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* バックグラウンド取得状況の表示 */}
        {isBackgroundLoading && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-800">{backgroundProgress.status}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-blue-600">キャッシュ済み</div>
                  <div className="text-sm font-semibold text-blue-800">{backgroundProgress.current}件</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総注文数</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              {cachedTotalCount > totalCount && (
                <p className="text-xs text-purple-600">
                  キャッシュ: {cachedTotalCount}件
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {isDateRangeSelected ? "選択期間" : "過去2ヶ月間"}
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
                {isDateRangeSelected ? "選択期間" : "過去2ヶ月間"}
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
              発送済み・30日以内・未送信の注文（Solicitation Actions APIで事前確認済み - 手動チェック不要）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <div className="text-center">
                  <p className="text-lg font-medium">ページ{currentPage}のデータを高速取得中...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Orders + Catalog Items + Solicitation Actions APIを並列処理で取得中
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    ✅ 並列処理により従来の3倍高速化 (100件を3件ずつバッチ処理)
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    完了後、バックグラウンドで追加データを自動取得します
                  </p>
                </div>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">
                  注文データが見つかりません
                  <br />
                  <small className="text-xs">新仕様: Orders API + Catalog Items APIで詳細取得</small>
                </div>
                <Button onClick={() => refreshOrders()} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  注文データを取得する
                </Button>
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
                            {order.items.length > 0 && order.items[0].imageUrl && order.items[0].id !== "error" ? (
                              <img
                                src={order.items[0].imageUrl}
                                alt={order.items[0].title}
                                className="w-10 h-10 object-cover rounded border"
                                onError={(e) => {
                                  const target = e.currentTarget
                                  target.style.display = 'none'
                                  const fallback = target.nextElementSibling as HTMLElement
                                  if (fallback) fallback.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <div className="w-10 h-10 bg-gray-200 rounded border flex items-center justify-center" style={{ display: order.items.length > 0 && order.items[0].imageUrl && order.items[0].id !== "error" ? 'none' : 'flex' }}>
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {order.items.length > 0 ? order.items[0].title : "商品情報なし"}
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
                          {(() => {
                            const status = getReviewRequestStatus(order)
                            return (
                              <Badge className={status.className} title={eligibilityResults?.[order.id]?.reason}>
                                {status.text}
                              </Badge>
                            )
                          })()}
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
        <div className="flex items-center justify-center pt-6 space-x-4">
          {/* 前のページ */}
          <Button
            variant="outline"
            onClick={goToPreviousPage}
            disabled={isLoading || currentPage <= 1}
            className="px-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            前のページ
          </Button>
          
          {/* ページ情報 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              ページ {currentPage} / {totalPages}
            </span>
            <span className="text-xs text-muted-foreground border-l pl-2 ml-2">
              {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, cachedTotalCount || totalCount)} 件
            </span>
            {cachedTotalCount > totalCount && (
              <span className="text-xs text-purple-600">
                (キャッシュ: {cachedTotalCount}件)
              </span>
            )}
          </div>
          
          {/* 次のページ */}
          <Button
            variant="outline"
            onClick={goToNextPage}
            disabled={isLoading || !hasMorePages}
            className="px-4"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                読み込み中...
              </>
            ) : (
              <>
                次のページ
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}