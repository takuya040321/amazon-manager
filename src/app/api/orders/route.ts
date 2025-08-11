import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"
import { cacheService } from "@/lib/cache"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const forceRefresh = searchParams.get("refresh") === "true"

  try {
    // キャッシュから取得を試みる（リフレッシュが指定されていない場合）
    if (!forceRefresh) {
      const cachedOrders = cacheService.getOrders()
      if (cachedOrders) {
        return NextResponse.json(cachedOrders)
      }
    }

    // Amazon APIから新しいデータを取得（デフォルトは今日から過去2ヶ月間）
    const createdAfter = searchParams.get("createdAfter") || 
      new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 過去2ヶ月間（60日）
    
    // CreatedBeforeは現在時刻から少なくとも2分前である必要がある（Amazon SP-API制限）
    const defaultCreatedBefore = new Date(Date.now() - 2 * 60 * 1000) // 2分前
    const createdBeforeParam = searchParams.get("createdBefore")
    
    let createdBefore: string
    if (createdBeforeParam) {
      const requestedDate = new Date(createdBeforeParam)
      const minAllowedDate = new Date(Date.now() - 2 * 60 * 1000)
      // 指定された日付が2分前より新しい場合は、2分前に調整
      createdBefore = requestedDate > minAllowedDate ? 
        minAllowedDate.toISOString() : 
        requestedDate.toISOString()
    } else {
      createdBefore = defaultCreatedBefore.toISOString()
    }
    
    const maxResults = parseInt(searchParams.get("maxResults") || "500") // デフォルト500件（自動ページネーション）
    const nextToken = searchParams.get("nextToken")

    const ordersResponse = await amazonApiService.getOrders({
      createdAfter,
      createdBefore,
      maxResultsPerPage: Math.min(maxResults, 100), // API単回制限は100件
      totalLimit: maxResults, // 自動ページネーション用の目標件数
      nextToken,
    })

    // キャッシュに保存
    cacheService.setOrders(ordersResponse)

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