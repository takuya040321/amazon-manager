import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"
import { cacheService } from "@/lib/cache"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const forceRefresh = searchParams.get("refresh") === "true"
  const nextToken = searchParams.get("nextToken")

  try {
    console.log(`[DEBUG] API Route - refresh: ${forceRefresh}, nextToken: ${nextToken ? 'present' : 'none'}`)
    
    // キャッシュから取得を試みる（リフレッシュまたはnextTokenが指定されていない場合）
    if (!forceRefresh && !nextToken) {
      const cachedOrders = cacheService.getOrders()
      if (cachedOrders) {
        console.log(`[DEBUG] Returning cached orders: ${cachedOrders.orders.length} items`)
        return NextResponse.json(cachedOrders)
      }
    }

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

    console.log(`[DEBUG] Calling Amazon API with nextToken: ${nextToken || 'none'}`)
    
    const ordersResponse = await amazonApiService.getOrders({
      createdAfter,
      createdBefore,
      maxResultsPerPage: Math.min(maxResults, 100), // API単回制限は100件
      totalLimit: maxResults, // 自動ページネーション用の目標件数
      nextToken,
      forceRefresh, // 強制リフレッシュフラグを渡す
    })
    
    console.log(`[DEBUG] Amazon API returned ${ordersResponse.orders.length} orders, nextToken: ${ordersResponse.nextToken ? 'present' : 'none'}`)

    // キャッシュに保存（nextTokenがない場合のみ = 最初のページのみ）
    if (!nextToken) {
      cacheService.setOrders(ordersResponse)
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