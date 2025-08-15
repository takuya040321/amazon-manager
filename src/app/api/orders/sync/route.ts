import { NextRequest, NextResponse } from "next/server"
import { amazonApiService } from "@/lib/amazon-api"
import { ordersStorage } from "@/lib/orders-storage"

export async function POST(request: NextRequest) {
  try {
    console.log("[DEBUG] 注文データ同期処理開始")
    
    // 1. 古いデータ削除（1ヶ月前より古いデータ）
    console.log("[DEBUG] 1ヶ月前より古いデータの削除")
    const cleanupResult = await ordersStorage.cleanupExpiredOrders()
    console.log(`[DEBUG] 削除: ${cleanupResult.removedCount}件, 残存: ${cleanupResult.remainingCount}件`)
    
    // 2. 最新データ取得（過去1週間のデータのみ）
    console.log("[DEBUG] 最新注文データ取得")
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const now = new Date()
    now.setMinutes(now.getMinutes() - 2) // Amazon SP-API制限: 2分前以前
    
    const latestOrdersResponse = await amazonApiService.getOrders({
      createdAfter: sevenDaysAgo.toISOString(),
      createdBefore: now.toISOString(),
      maxResultsPerPage: 100,
      totalLimit: 500,
      forceRefresh: true,
    })
    
    // 3. 新規データとの差分更新
    console.log("[DEBUG] 差分更新処理")
    const mergeResult = await ordersStorage.mergeWithNewOrders(latestOrdersResponse.orders)
    
    // 4. Solicitationステータスの再チェック（必要な場合のみ）
    console.log("[DEBUG] Solicitationステータス再チェック")
    const allOrders = await ordersStorage.loadOrders()
    const needsCheck = await ordersStorage.getOrdersNeedingSolicitationCheck()
    
    let recheckCount = 0
    if (needsCheck.length > 0) {
      const updatedOrders = await amazonApiService.processSolicitationChecks(allOrders)
      await ordersStorage.saveOrders(updatedOrders)
      recheckCount = needsCheck.length
    }
    
    // 5. 最終統計取得
    const stats = await ordersStorage.getStorageStats()
    
    console.log("[DEBUG] 注文データ同期処理完了")
    
    return NextResponse.json({
      success: true,
      cleanup: {
        removedCount: cleanupResult.removedCount,
        remainingCount: cleanupResult.remainingCount
      },
      sync: {
        addedCount: mergeResult.addedCount,
        updatedCount: mergeResult.updatedCount,
        totalCount: mergeResult.totalCount
      },
      solicitation: {
        recheckCount
      },
      stats: {
        totalOrders: stats.totalOrders,
        lastUpdated: stats.lastUpdated,
        needsCheck: stats.needsCheck,
        isValid: stats.isValid
      }
    })
    
  } catch (error) {
    console.error("[ERROR] 注文データ同期エラー:", error)
    
    return NextResponse.json(
      { 
        error: "注文データの同期に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}