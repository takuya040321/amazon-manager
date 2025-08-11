import { Order } from "@/types/order"
import fs from "fs/promises"
import path from "path"

const STORAGE_DIR = path.join(process.cwd(), ".orders-cache")
const ORDERS_FILE = path.join(STORAGE_DIR, "orders.json")

interface StoredOrderData {
  orders: Order[]
  lastUpdated: string
  totalCount: number
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
  async saveOrders(orders: Order[], totalCount?: number): Promise<void> {
    await this.ensureStorageDir()
    
    const data: StoredOrderData = {
      orders: orders,
      lastUpdated: new Date().toISOString(),
      totalCount: totalCount || orders.length
    }

    await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2))
    console.log(`[DEBUG] 注文データ保存完了: ${orders.length}件`)
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

  // ストレージの統計情報
  async getStorageStats(): Promise<{ totalOrders: number; lastUpdated?: string; needsCheck: number }> {
    const orders = await this.loadOrders()
    const needsCheck = await this.getOrdersNeedingSolicitationCheck()
    
    let lastUpdated: string | undefined
    try {
      const data = await fs.readFile(ORDERS_FILE, "utf-8")
      const parsed: StoredOrderData = JSON.parse(data)
      lastUpdated = parsed.lastUpdated
    } catch {
      // エラーの場合は無視
    }
    
    return {
      totalOrders: orders.length,
      lastUpdated,
      needsCheck: needsCheck.length
    }
  }
}

export const ordersStorage = OrdersStorage.getInstance()