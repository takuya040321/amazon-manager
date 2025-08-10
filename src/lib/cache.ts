import { Order, OrdersResponse } from "@/types/order"
import fs from 'fs'
import path from 'path'

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 30 * 60 * 1000 // 30分
  private readonly CACHE_FILE = path.join(process.cwd(), '.cache', 'orders.json')

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

  private ensureCacheDir(): void {
    const cacheDir = path.dirname(this.CACHE_FILE)
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }
  }

  private writeToFile(data: OrdersResponse): void {
    try {
      this.ensureCacheDir()
      const cacheEntry: CacheEntry<OrdersResponse> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (60 * 60 * 1000) // 1時間
      }
      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(cacheEntry, null, 2))
    } catch (error) {
      console.error('Failed to write cache to file:', error)
    }
  }

  private readFromFile(): OrdersResponse | null {
    try {
      if (!fs.existsSync(this.CACHE_FILE)) {
        return null
      }

      const fileContent = fs.readFileSync(this.CACHE_FILE, 'utf-8')
      const cacheEntry: CacheEntry<OrdersResponse> = JSON.parse(fileContent)

      // 期限切れチェック
      if (Date.now() > cacheEntry.expiresAt) {
        fs.unlinkSync(this.CACHE_FILE)
        return null
      }

      return cacheEntry.data
    } catch (error) {
      console.error('Failed to read cache from file:', error)
      return null
    }
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
    // 重複する注文を排除
    const uniqueOrders = this.removeDuplicateOrders(orders.orders)
    const deduplicatedResponse: OrdersResponse = {
      ...orders,
      orders: uniqueOrders,
      totalCount: uniqueOrders.length,
    }
    this.set("orders", deduplicatedResponse, this.DEFAULT_TTL)
    this.writeToFile(deduplicatedResponse) // ファイルにも保存
  }

  // 重複注文の排除
  private removeDuplicateOrders(orders: Order[]): Order[] {
    const seen = new Set<string>()
    return orders.filter(order => {
      if (seen.has(order.id)) {
        console.warn(`Duplicate order detected and removed: ${order.id}`)
        return false
      }
      seen.add(order.id)
      return true
    })
  }

  getOrders(): OrdersResponse | null {
    // まずメモリキャッシュから取得を試みる
    const memoryCache = this.get<OrdersResponse>("orders")
    if (memoryCache) {
      return memoryCache
    }

    // メモリキャッシュにない場合は、ファイルから読み込む
    const fileCache = this.readFromFile()
    if (fileCache) {
      // ファイルからデータを取得できた場合、メモリキャッシュにも保存
      this.set("orders", fileCache, this.DEFAULT_TTL)
      return fileCache
    }

    return null
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