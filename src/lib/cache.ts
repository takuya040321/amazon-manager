import { Order, OrdersResponse } from "@/types/order"

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 30 * 60 * 1000 // 30分

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // 期限切れのエントリを削除
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  // 注文データ専用のメソッド
  setOrders(orders: OrdersResponse): void {
    this.set("orders", orders, this.DEFAULT_TTL)
  }

  getOrders(): OrdersResponse | null {
    return this.get<OrdersResponse>("orders")
  }

  updateOrderInCache(updatedOrder: Order): void {
    const cachedOrders = this.getOrders()
    if (cachedOrders) {
      const orderIndex = cachedOrders.orders.findIndex(order => order.id === updatedOrder.id)
      if (orderIndex !== -1) {
        cachedOrders.orders[orderIndex] = updatedOrder
        this.setOrders(cachedOrders)
      }
    }
  }

  // キャッシュ統計
  getStats() {
    const now = Date.now()
    let active = 0
    let expired = 0

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++
      } else {
        active++
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
    }
  }
}

// グローバルインスタンス（アプリ起動時に一度だけ作成）
export const cacheService = new CacheService()

// 定期的なクリーンアップ（10分ごと）
if (typeof window !== "undefined") {
  setInterval(() => {
    cacheService.cleanup()
  }, 10 * 60 * 1000)
}