import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"
import { ordersStorage } from "@/lib/orders-storage"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const forceRefresh = searchParams.get("refresh") === "true"
  const fetchFull = searchParams.get("fetchFull") === "true"
  const nextToken = searchParams.get("nextToken")

  try {
    console.log(`[DEBUG] API Route - refresh: ${forceRefresh}, fetchFull: ${fetchFull}, nextToken: ${nextToken ? 'present' : 'none'}`)
    
    // 通常のページネーション（nextToken使用時）は従来通り
    if (nextToken && !fetchFull) {
      console.log("[DEBUG] ページネーション処理（従来通り）")
      const ordersResponse = await amazonApiService.getOrders({
        nextToken,
        forceRefresh: false,
      })
      return NextResponse.json(ordersResponse)
    }

    // 全件取得でない場合は、永続化ストレージから読み込み
    if (!fetchFull && !forceRefresh) {
      const orders = await ordersStorage.loadOrders()
      const stats = await ordersStorage.getStorageStats()
      
      console.log(`[DEBUG] ストレージから読み込み: ${orders.length}件`)
      
      return NextResponse.json({
        orders,
        totalCount: orders.length,
        lastUpdated: stats.lastUpdated,
        fromStorage: true
      })
    }

    // 全件取得（fetchFull=true）の場合のみAmazon APIから取得
    console.log("[DEBUG] 全件データ取得処理開始")
    
    // Amazon APIから新しいデータを取得（デフォルトは7日前から過去1ヶ月間）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7日前
    const oneMonthBeforeSevenDaysAgo = new Date(sevenDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000) // 7日前から1ヶ月遡る
    const createdAfter = searchParams.get("createdAfter") || oneMonthBeforeSevenDaysAgo.toISOString() // 過去1ヶ月（7日前まで）
    
    // CreatedBeforeは7日前まで（Amazon SP-API制限を考慮）
    const defaultCreatedBefore = sevenDaysAgo // 7日前
    const createdBeforeParam = searchParams.get("createdBefore")
    
    let createdBefore: string
    if (createdBeforeParam) {
      const requestedDate = new Date(createdBeforeParam)
      const minAllowedDate = new Date(Date.now() - 2 * 60 * 1000) // Amazon SP-API制限: 2分前以前
      // 指定された日付が2分前より新しい場合は、2分前に調整
      createdBefore = requestedDate > minAllowedDate ? 
        minAllowedDate.toISOString() : 
        requestedDate.toISOString()
    } else {
      createdBefore = defaultCreatedBefore.toISOString()
    }
    
    const maxResults = parseInt(searchParams.get("maxResults") || "500") // デフォルト500件（自動ページネーション）

    console.log(`[DEBUG] Calling Amazon API for full data fetch`)
    
    const ordersResponse = await amazonApiService.getOrders({
      createdAfter,
      createdBefore,
      maxResultsPerPage: Math.min(maxResults, 100), // API単回制限は100件
      totalLimit: maxResults, // 自動ページネーション用の目標件数
      forceRefresh: true, // 全件取得時は強制リフレッシュ
    })
    
    console.log(`[DEBUG] Amazon API returned ${ordersResponse.orders.length} orders for full fetch`)

    // 全件取得の場合は永続化ストレージに保存
    if (fetchFull) {
      await ordersStorage.saveOrders(ordersResponse.orders, ordersResponse.totalCount, true)
      console.log("[DEBUG] 全件データを永続化ストレージに保存完了")
    }

    return NextResponse.json(ordersResponse)
  } catch (error) {
    console.error("Orders API error:", error)
    return NextResponse.json(
      { 
        error: "注文データの取得に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}