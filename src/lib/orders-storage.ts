import { Order } from "@/types/order"
import fs from "fs/promises"
import path from "path"

const STORAGE_DIR = path.join(process.cwd(), ".orders-cache")
const ORDERS_FILE = path.join(STORAGE_DIR, "orders.json")

interface StoredOrderData {
  orders: Order[]
  lastUpdated: string
  totalCount: number
  dataFetchedAt?: string // 最後にAPI全件取得した日時
  validUntil?: string     // データの有効期限
}

export class OrdersStorage {
  private static instance: OrdersStorage
  
  private constructor() {}
  
  static getInstance(): OrdersStorage {
    if (!OrdersStorage.instance) {
      OrdersStorage.instance = new OrdersStorage()
    }
    return OrdersStorage.instance
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(STORAGE_DIR)
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true })
    }
  }

  // 注文データを保存（既存データとの統合なし、渡されたデータをそのまま保存）
  async saveOrders(orders: Order[], totalCount?: number, isFullFetch: boolean = false): Promise<void> {
    await this.ensureStorageDir()
    
    const now = new Date().toISOString()
    const data: StoredOrderData = {
      orders: orders,
      lastUpdated: now,
      totalCount: totalCount || orders.length,
      ...(isFullFetch && {
        dataFetchedAt: now,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間後
      })
    }

    await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2))
    console.log(`[DEBUG] 注文データ保存完了: ${orders.length}件 ${isFullFetch ? '(全件取得)' : ''}`)
  }

  // 既存データとの統合を行う保存（初回データ取得時のみ使用）
  async saveOrdersWithMerge(orders: Order[], totalCount?: number): Promise<void> {
    await this.ensureStorageDir()
    
    const existingOrders = await this.loadOrders()
    
    // 既存注文との重複を避け、新しいデータで更新
    const orderMap = new Map<string, Order>()
    
    // 既存注文をマップに追加
    existingOrders.forEach(order => {
      orderMap.set(order.amazonOrderId, order)
    })
    
    // 新しい注文データで上書き
    orders.forEach(order => {
      orderMap.set(order.amazonOrderId, order)
    })
    
    const allOrders = Array.from(orderMap.values())
    
    const data: StoredOrderData = {
      orders: allOrders,
      lastUpdated: new Date().toISOString(),
      totalCount: totalCount || allOrders.length
    }

    await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2))
    console.log(`[DEBUG] 注文データ統合保存完了: ${allOrders.length}件`)
  }

  // 注文データを読み込み
  async loadOrders(): Promise<Order[]> {
    try {
      await this.ensureStorageDir()
      const data = await fs.readFile(ORDERS_FILE, "utf-8")
      const parsed: StoredOrderData = JSON.parse(data)
      console.log(`[DEBUG] 注文データ読み込み完了: ${parsed.orders.length}件`)
      return parsed.orders
    } catch (error) {
      console.log("[DEBUG] 保存された注文データなし、空配列を返す")
      return []
    }
  }

  // 特定の注文データを更新（Solicitationチェック結果の上書き用）
  async updateOrder(amazonOrderId: string, updates: Partial<Order>): Promise<void> {
    const orders = await this.loadOrders()
    const orderIndex = orders.findIndex(order => order.amazonOrderId === amazonOrderId)
    
    if (orderIndex >= 0) {
      // 既存注文を更新
      orders[orderIndex] = { ...orders[orderIndex], ...updates }
      await this.saveOrders(orders)
      console.log(`[DEBUG] 注文 ${amazonOrderId} を更新`)
    } else {
      console.warn(`[DEBUG] 注文 ${amazonOrderId} が見つからない`)
    }
  }

  // Solicitationチェックが必要な注文をフィルタリング
  async getOrdersNeedingSolicitationCheck(): Promise<Order[]> {
    const orders = await this.loadOrders()
    
    return orders.filter(order => {
      // 一度もSolicitationチェックしていない
      if (order.solicitationEligible === undefined) {
        return true
      }
      
      // 前回のチェックで「対象外」以外だった場合は再チェック
      if (order.solicitationEligible !== false || 
          !order.solicitationReason?.includes("対象外")) {
        return true
      }
      
      // 対象外の場合はスキップ
      return false
    })
  }

  // ストレージをクリア
  async clearStorage(): Promise<void> {
    try {
      await fs.unlink(ORDERS_FILE)
      console.log("[DEBUG] 注文データストレージをクリア")
    } catch (error) {
      // ファイルが存在しない場合は何もしない
    }
  }

  // 期限内の注文のみ保持（1ヶ月前より古いデータを削除）
  async cleanupExpiredOrders(): Promise<{ removedCount: number; remainingCount: number }> {
    const orders = await this.loadOrders()
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    
    const validOrders = orders.filter(order => {
      const orderDate = new Date(order.purchaseDate)
      return orderDate >= oneMonthAgo
    })
    
    const removedCount = orders.length - validOrders.length
    
    if (removedCount > 0) {
      await this.saveOrders(validOrders)
      console.log(`[DEBUG] 1ヶ月前より古い注文データを削除: ${removedCount}件`)
    }
    
    return {
      removedCount,
      remainingCount: validOrders.length
    }
  }

  // 新しい注文データとの差分更新
  async mergeWithNewOrders(newOrders: Order[]): Promise<{ addedCount: number; updatedCount: number; totalCount: number }> {
    const existingOrders = await this.loadOrders()
    const orderMap = new Map<string, Order>()
    
    // 既存注文をマップに追加
    existingOrders.forEach(order => {
      orderMap.set(order.amazonOrderId, order)
    })
    
    let addedCount = 0
    let updatedCount = 0
    
    // 新しい注文データで更新・追加
    newOrders.forEach(newOrder => {
      if (orderMap.has(newOrder.amazonOrderId)) {
        // 既存データを新しいデータで更新（SolicitationデータはOlder優先）
        const existing = orderMap.get(newOrder.amazonOrderId)!
        const merged = {
          ...newOrder,
          // Solicitation関連データは既存優先
          solicitationEligible: existing.solicitationEligible ?? newOrder.solicitationEligible,
          solicitationReason: existing.solicitationReason ?? newOrder.solicitationReason,
          reviewRequestSent: existing.reviewRequestSent || newOrder.reviewRequestSent,
          reviewRequestStatus: existing.reviewRequestStatus !== 'not_eligible' 
            ? existing.reviewRequestStatus 
            : newOrder.reviewRequestStatus
        }
        orderMap.set(newOrder.amazonOrderId, merged)
        updatedCount++
      } else {
        orderMap.set(newOrder.amazonOrderId, newOrder)
        addedCount++
      }
    })
    
    const allOrders = Array.from(orderMap.values())
    await this.saveOrders(allOrders)
    
    console.log(`[DEBUG] 注文データ差分更新: 追加${addedCount}件、更新${updatedCount}件`)
    
    return {
      addedCount,
      updatedCount,
      totalCount: allOrders.length
    }
  }

  // データの有効性確認
  async isDataValid(): Promise<boolean> {
    try {
      const data = await fs.readFile(ORDERS_FILE, "utf-8")
      const parsed: StoredOrderData = JSON.parse(data)
      
      if (!parsed.validUntil) return false
      
      const validUntil = new Date(parsed.validUntil)
      return new Date() < validUntil
    } catch {
      return false
    }
  }

  // ストレージの統計情報
  async getStorageStats(): Promise<{ 
    totalOrders: number; 
    lastUpdated?: string; 
    needsCheck: number; 
    dataFetchedAt?: string;
    isValid: boolean;
  }> {
    const orders = await this.loadOrders()
    const needsCheck = await this.getOrdersNeedingSolicitationCheck()
    const isValid = await this.isDataValid()
    
    let lastUpdated: string | undefined
    let dataFetchedAt: string | undefined
    try {
      const data = await fs.readFile(ORDERS_FILE, "utf-8")
      const parsed: StoredOrderData = JSON.parse(data)
      lastUpdated = parsed.lastUpdated
      dataFetchedAt = parsed.dataFetchedAt
    } catch {
      // エラーの場合は無視
    }
    
    return {
      totalOrders: orders.length,
      lastUpdated,
      needsCheck: needsCheck.length,
      dataFetchedAt,
      isValid
    }
  }
}

export const ordersStorage = OrdersStorage.getInstance()