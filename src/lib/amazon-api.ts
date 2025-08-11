import { Order, OrdersResponse } from "@/types/order"
import { ordersStorage } from "./orders-storage"

// 注文ステータスのマッピング
const ORDER_STATUS_MAP = {
  "Pending": "処理中",
  "Unshipped": "未発送", 
  "PartiallyShipped": "一部発送",
  "Shipped": "発送済み",
  "Canceled": "キャンセル",
  "Unfulfillable": "配送不可",
} as const

// Amazon SP-API地域別エンドポイント
const SP_API_ENDPOINTS = {
  "us-east-1": "https://sellingpartnerapi-na.amazon.com",
  "us-west-2": "https://sellingpartnerapi-fe.amazon.com", // 日本
  "eu-west-1": "https://sellingpartnerapi-eu.amazon.com",
} as const

// Amazon SP-APIクライアント設定
interface AmazonApiConfig {
  refreshToken: string
  clientId: string
  clientSecret: string
  region: keyof typeof SP_API_ENDPOINTS
  marketplace: string
  baseUrl: string
  debugMode: boolean
}

class AmazonApiService {
  private config: AmazonApiConfig
  private accessToken?: string
  private tokenExpiresAt?: number
  private rateLimitMetrics = {
    totalRequests: 0,
    rateLimitHits: 0,
    lastRateLimitTime: 0,
  }

  constructor() {
    const region = (process.env.AMAZON_REGION || "us-west-2") as keyof typeof SP_API_ENDPOINTS
    
    this.config = {
      refreshToken: process.env.AMAZON_REFRESH_TOKEN || "",
      clientId: process.env.AMAZON_CLIENT_ID || "",
      clientSecret: process.env.AMAZON_CLIENT_SECRET || "",
      region,
      marketplace: process.env.AMAZON_MARKETPLACE_ID || "A1VC38T7YXB528",
      baseUrl: process.env.AMAZON_SP_API_BASE_URL || SP_API_ENDPOINTS[region],
      debugMode: process.env.DEBUG_API_CALLS === "true",
    }

    // 必須設定の検証
    this.validateConfig()
  }

  private validateConfig(): void {
    const required = ["refreshToken", "clientId", "clientSecret"]
    const missing = required.filter(key => !this.config[key as keyof AmazonApiConfig])
    
    if (missing.length > 0) {
      throw new Error(`Amazon SP-API設定が不完全です。以下の環境変数を設定してください: ${missing.join(", ")}`)
    }
  }

  private async getAccessToken(): Promise<string> {
    // トークンがまだ有効な場合は再利用
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    try {
      const response = await fetch("https://api.amazon.com/auth/o2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Amazon Manager/1.0",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000 // 1分のマージン

      return this.accessToken
    } catch (error) {
      console.error("Failed to get access token:", error)
      throw new Error("Amazon API認証に失敗しました。Refresh Tokenが正しく設定されているか確認してください。")
    }
  }

  private async makeApiRequest(endpoint: string, params?: Record<string, string>, retryCount = 0): Promise<any> {
    this.rateLimitMetrics.totalRequests++
    
    const accessToken = await this.getAccessToken()
    const queryString = params ? "?" + new URLSearchParams(params).toString() : ""
    const url = `${this.config.baseUrl}${endpoint}${queryString}`

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "x-amz-access-token": accessToken,
        "Content-Type": "application/json",
        "User-Agent": "Amazon Manager/1.0",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // 429エラー（レート制限）の場合のリトライ処理
      if (response.status === 429) {
        this.rateLimitMetrics.rateLimitHits++
        this.rateLimitMetrics.lastRateLimitTime = Date.now()
        
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000 // Exponential backoff with jitter
          console.log(`[DEBUG] レート制限エラー（429）。${delay}ms待機後にリトライします... (${retryCount + 1}/3)`)
          console.log(`[DEBUG] レート制限統計: ${this.rateLimitMetrics.rateLimitHits}/${this.rateLimitMetrics.totalRequests} (${(this.rateLimitMetrics.rateLimitHits/this.rateLimitMetrics.totalRequests*100).toFixed(1)}%)`)
          
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.makeApiRequest(endpoint, params, retryCount + 1)
        }
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data
  }


  // 汎用的な認証済みAPIリクエストメソッド
  async makeAuthenticatedRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    customHost?: string,
    retryCount = 0
  ): Promise<Response> {

    const accessToken = await this.getAccessToken()
    const baseUrl = customHost ? `https://${customHost}` : this.config.baseUrl
    const url = `${baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "x-amz-access-token": accessToken,
      "Content-Type": "application/json",
      "User-Agent": "Amazon Manager/1.0",
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    }

    if (body && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, requestOptions)
    
    // 429エラー（レート制限）の場合のリトライ処理
    if (response.status === 429 && retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000 // Exponential backoff with jitter
      console.log(`[DEBUG] レート制限エラー（429）。${delay}ms待機後にリトライします... (${retryCount + 1}/3)`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return this.makeAuthenticatedRequest(method, endpoint, body, customHost, retryCount + 1)
    }
    
    return response
  }

  // レート制限メトリクスを取得
  getRateLimitMetrics() {
    return {
      ...this.rateLimitMetrics,
      rateLimitPercentage: this.rateLimitMetrics.totalRequests > 0 
        ? (this.rateLimitMetrics.rateLimitHits / this.rateLimitMetrics.totalRequests * 100).toFixed(1)
        : "0.0"
    }
  }

  // メトリクスをリセット
  resetRateLimitMetrics() {
    this.rateLimitMetrics = {
      totalRequests: 0,
      rateLimitHits: 0,
      lastRateLimitTime: 0,
    }
  }

  async getOrders(params?: {
    createdAfter?: string
    createdBefore?: string
    orderStatuses?: string[]
    maxResultsPerPage?: number
    nextToken?: string
    totalLimit?: number
    forceRefresh?: boolean
  }): Promise<OrdersResponse> {
    try {
      // 強制リフレッシュでない場合は、保存されたデータを優先使用
      if (!params?.forceRefresh) {
        const storedOrders = await ordersStorage.loadOrders()
        if (storedOrders.length > 0) {
          console.log(`[DEBUG] 保存されたデータを使用: ${storedOrders.length}件`)
          
          // nextTokenがある場合は、実際のAmazon APIを呼び出す（簡易実装の限界）
          if (params?.nextToken) {
            console.log(`[DEBUG] nextToken指定のためAmazon APIを呼び出します`)
            // 下のAPI呼び出し処理に続行
          } else {
            // 最初のページの場合のみ保存データを使用
            const maxResults = params?.maxResultsPerPage || 100
            const pageOrders = storedOrders.slice(0, maxResults)
            
            // Solicitationチェックが必要な注文のみ再チェック
            const processedOrders = await this.recheckSolicitationIfNeeded(pageOrders)
            
            return {
              orders: processedOrders,
              nextToken: storedOrders.length > maxResults ? "has-more" : undefined,
              totalCount: storedOrders.length,
              lastUpdated: new Date().toISOString(),
              needsEnrichment: false,
            }
          }
        }
      }

      // totalLimitが指定されている場合は自動ページネーション
      if (params?.totalLimit && params.totalLimit > 100 && !params.nextToken) {
        return await this.getOrdersWithPagination(params)
      }

      // 通常の単一ページ取得（API呼び出し）
      const apiParams: Record<string, string> = {
        MarketplaceIds: this.config.marketplace,
      }

      if (params?.createdAfter) apiParams.CreatedAfter = params.createdAfter
      if (params?.createdBefore) apiParams.CreatedBefore = params.createdBefore
      if (params?.orderStatuses) apiParams.OrderStatuses = params.orderStatuses.join(",")
      if (params?.maxResultsPerPage) apiParams.MaxResultsPerPage = params.maxResultsPerPage.toString()
      if (params?.nextToken) apiParams.NextToken = params.nextToken

      const response = await this.makeApiRequest("/orders/v0/orders", apiParams)
      
      console.log(`[DEBUG] Amazon APIから注文データ取得完了: ${response.payload.Orders.length}件`)
      
      // 基本注文データを作成
      const basicOrders = response.payload.Orders.map((order: any) => 
        this.createBasicOrderFromApiData(order)
      )
      
      // nextTokenがある場合は既存データと統合
      let ordersToProcess = basicOrders
      if (params?.nextToken) {
        // 2ページ目以降：既存データを読み込み、新データと統合
        const existingOrders = await ordersStorage.loadOrders()
        const orderMap = new Map<string, Order>()
        
        // 既存注文をマップに追加
        existingOrders.forEach(order => orderMap.set(order.amazonOrderId, order))
        
        // 新しい注文データで上書き（基本情報のみ、Solicitationチェック結果は保持）
        const ordersNeedingCheck: Order[] = []
        
        basicOrders.forEach(order => {
          const existing = orderMap.get(order.amazonOrderId)
          if (existing && existing.solicitationEligible !== undefined) {
            // 既存のSolicitationチェック結果を保持
            const preservedOrder = {
              ...order,
              reviewRequestStatus: existing.reviewRequestStatus,
              solicitationEligible: existing.solicitationEligible,
              solicitationReason: existing.solicitationReason,
            }
            orderMap.set(order.amazonOrderId, preservedOrder)
            console.log(`[DEBUG] 注文 ${order.amazonOrderId} の既存チェック結果を保持 (${existing.solicitationEligible ? '対象' : '対象外'})`)
          } else {
            // 未チェックの注文のみチェック対象に追加
            orderMap.set(order.amazonOrderId, order)
            ordersNeedingCheck.push(order)
            console.log(`[DEBUG] 注文 ${order.amazonOrderId} は未チェックのためチェック対象に追加`)
          }
        })
        
        const allOrders = Array.from(orderMap.values())
        await ordersStorage.saveOrders(allOrders)
        
        // 未チェックの注文のみをSolicitationチェック対象とする
        ordersToProcess = ordersNeedingCheck
      } else {
        // 1ページ目：既存データと統合保存
        await ordersStorage.saveOrdersWithMerge(basicOrders)
      }
      
      // Solicitationチェックを実行し、結果を保存
      await this.recheckSolicitationIfNeeded(ordersToProcess)
      
      // nextTokenがある場合は、チェック後に今回取得した注文を再度保存データから取得
      let finalOrders: Order[]
      if (params?.nextToken) {
        const updatedStoredOrders = await ordersStorage.loadOrders()
        const orderIds = response.payload.Orders.map((o: any) => o.AmazonOrderId)
        finalOrders = updatedStoredOrders.filter(order => orderIds.includes(order.amazonOrderId))
      } else {
        const updatedStoredOrders = await ordersStorage.loadOrders()
        finalOrders = updatedStoredOrders.slice(0, params?.maxResultsPerPage || 100)
      }

      return {
        orders: finalOrders,
        nextToken: response.payload.NextToken,
        totalCount: response.payload.Orders.length,
        lastUpdated: new Date().toISOString(),
        needsEnrichment: false,
      }
    } catch (error) {
      console.error("Failed to get orders:", error)
      throw new Error("注文データの取得に失敗しました")
    }
  }

  // 自動ページネーション機能（複数ページを自動取得・結合）
  private async getOrdersWithPagination(params: {
    createdAfter?: string
    createdBefore?: string
    orderStatuses?: string[]
    maxResultsPerPage?: number
    totalLimit: number
  }): Promise<OrdersResponse> {
    const allOrders: Order[] = []
    let nextToken: string | undefined = undefined
    let totalFetched = 0
    const pageSize = 100 // 毎回最大100件取得
    const maxPages = Math.ceil(params.totalLimit / pageSize)

    console.log(`[DEBUG] 自動ページネーション開始: 目標${params.totalLimit}件, 最大${maxPages}ページ`)

    for (let page = 1; page <= maxPages && totalFetched < params.totalLimit; page++) {
      try {
        const apiParams: Record<string, string> = {
          MarketplaceIds: this.config.marketplace,
          MaxResultsPerPage: pageSize.toString(),
        }

        if (params.createdAfter) apiParams.CreatedAfter = params.createdAfter
        if (params.createdBefore) apiParams.CreatedBefore = params.createdBefore
        if (params.orderStatuses) apiParams.OrderStatuses = params.orderStatuses.join(",")
        if (nextToken) apiParams.NextToken = nextToken

        console.log(`[DEBUG] ページ${page}/${maxPages}を取得中...`)
        const response = await this.makeApiRequest("/orders/v0/orders", apiParams)
        
        if (!response.payload.Orders || response.payload.Orders.length === 0) {
          console.log(`[DEBUG] ページ${page}: データなし、取得終了`)
          break
        }

        // ページごとに基本情報のみで処理
        const remainingNeeded = params.totalLimit - totalFetched
        const maxOrdersToProcess = Math.min(100, Math.min(remainingNeeded, response.payload.Orders.length))
        const pageOrders = response.payload.Orders.slice(0, maxOrdersToProcess)
        console.log(`[DEBUG] ページ${page}: ${pageOrders.length}件を順次処理で取得予定`)
        const ordersWithItems = await this.processOrdersSequentially(pageOrders)
        
        allOrders.push(...ordersWithItems)
        totalFetched += ordersWithItems.length

        console.log(`[DEBUG] ページ${page}: ${ordersWithItems.length}件取得 (順次処理完了、累計: ${totalFetched}/${params.totalLimit})`)

        // 各ページ完了時に保存（統合保存）
        await ordersStorage.saveOrdersWithMerge(allOrders)

        nextToken = response.payload.NextToken
        if (!nextToken || totalFetched >= params.totalLimit) {
          console.log(`[DEBUG] 取得完了: ${totalFetched}件`)
          break
        }

        // API制限対応: 順次処理後の間隔調整
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`[DEBUG] ページ${page}の取得でエラー:`, error)
        break
      }
    }

    return {
      orders: allOrders,
      nextToken: nextToken,
      totalCount: totalFetched,
      lastUpdated: new Date().toISOString(),
    }
  }

  // 順次処理で注文データを処理（バッチ処理を廃止）
  private async processOrdersSequentially(ordersData: any[]): Promise<Order[]> {
    console.log(`[DEBUG] 順次処理で${ordersData.length}件の注文詳細を取得開始`)
    
    const enrichedOrders: Order[] = []
    
    for (let i = 0; i < ordersData.length; i++) {
      const order = ordersData[i]
      console.log(`[DEBUG] 注文 ${i + 1}/${ordersData.length}: ${order.AmazonOrderId} を処理中...`)
      
      try {
        const enrichedOrder = await this.processOrderWithDetails(order, i + 1, ordersData.length)
        enrichedOrders.push(enrichedOrder)
        
        // API制限対応: Solicitation API用に1秒待機
        if (i < ordersData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`[DEBUG] 注文 ${order.AmazonOrderId} の処理エラー:`, error)
        const basicOrder = this.createBasicOrder(order, "処理エラー")
        enrichedOrders.push(basicOrder)
      }
    }
    
    console.log(`[DEBUG] 順次処理完了: ${enrichedOrders.length}件の注文詳細取得完了`)
    return enrichedOrders
  }

  // Amazon APIからの生データから基本注文オブジェクトを作成
  private createBasicOrderFromApiData(order: any): Order {
    return {
      id: order.AmazonOrderId,
      amazonOrderId: order.AmazonOrderId,
      purchaseDate: order.PurchaseDate,
      orderStatus: ORDER_STATUS_MAP[order.OrderStatus as keyof typeof ORDER_STATUS_MAP] || order.OrderStatus,
      fulfillmentChannel: order.FulfillmentChannel === "AFN" ? "AFN" : "MFN",
      salesChannel: order.SalesChannel || "Amazon.co.jp",
      totalAmount: parseFloat(order.OrderTotal?.Amount || "0"),
      currency: order.OrderTotal?.CurrencyCode || "JPY",
      numberOfItemsShipped: order.NumberOfItemsShipped || 0,
      numberOfItemsUnshipped: order.NumberOfItemsUnshipped || 0,
      customer: {
        name: order.BuyerInfo?.BuyerName,
        email: order.BuyerInfo?.BuyerEmail,
        buyerInfo: order.BuyerInfo,
      },
      items: [{
        id: "basic",
        title: "商品詳細情報なし",
        asin: "",
        quantity: order.NumberOfItemsShipped + order.NumberOfItemsUnshipped || 1,
        price: 0,
        imageUrl: "",
        brand: "",
        manufacturer: "",
        productType: "",
      }],
      shippingAddress: order.DefaultShipFromLocationAddress,
      reviewRequestSent: false,
      reviewRequestStatus: "pending",
      solicitationEligible: undefined, // 未確認
      solicitationReason: "未チェック",
    }
  }

  // Solicitationチェックが必要な注文のみ再チェック
  private async recheckSolicitationIfNeeded(orders: Order[]): Promise<Order[]> {
    const ordersNeedingCheck = orders.filter(order => {
      // 一度もSolicitationチェックしていない場合はチェックが必要
      if (order.solicitationEligible === undefined) {
        return true
      }
      
      // 前回のチェック結果がfalse（対象外）の場合はスキップ
      if (order.solicitationEligible === false) {
        console.log(`[DEBUG] 注文 ${order.amazonOrderId} は前回対象外のためスキップ (理由: ${order.solicitationReason})`)
        return false
      }
      
      // 前回のチェック結果がtrue（対象）の場合は再チェック
      console.log(`[DEBUG] 注文 ${order.amazonOrderId} は前回対象のため再チェック`)
      return true
    })

    if (ordersNeedingCheck.length === 0) {
      console.log("[DEBUG] Solicitationチェックが必要な注文なし")
      return orders
    }

    console.log(`[DEBUG] ${ordersNeedingCheck.length}件の注文をSolicitationチェック中...`)

    // チェック対象の注文情報を収集（後でまとめて保存用）
    const updatedOrders: { amazonOrderId: string; updates: Partial<Order> }[] = []

    // 必要な注文のみSolicitationチェックを実行
    for (let i = 0; i < ordersNeedingCheck.length; i++) {
      const order = ordersNeedingCheck[i]
      console.log(`[DEBUG] Solicitation API呼び出し中 (${i + 1}/${ordersNeedingCheck.length}): ${order.amazonOrderId}`)

      try {
        const solicitationResult = await this.getSolicitationActions(order.amazonOrderId)
        
        // 注文オブジェクトを更新
        const updatedOrder = {
          ...order,
          reviewRequestStatus: solicitationResult.eligible ? "eligible" : "not_eligible",
          solicitationEligible: solicitationResult.eligible,
          solicitationReason: solicitationResult.reason,
        }
        
        // 元の配列内の該当注文を更新
        const originalIndex = orders.findIndex(o => o.amazonOrderId === order.amazonOrderId)
        if (originalIndex >= 0) {
          orders[originalIndex] = updatedOrder
        }

        // 更新情報を収集（後でまとめて保存）
        updatedOrders.push({
          amazonOrderId: order.amazonOrderId,
          updates: {
            reviewRequestStatus: updatedOrder.reviewRequestStatus,
            solicitationEligible: updatedOrder.solicitationEligible,
            solicitationReason: updatedOrder.solicitationReason,
          }
        })

        // API制限対応: 1秒待機
        if (i < ordersNeedingCheck.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`[DEBUG] 注文 ${order.amazonOrderId} のSolicitationチェックエラー:`, error)
        
        const errorOrder = {
          ...order,
          reviewRequestStatus: "error" as const,
          solicitationEligible: false,
          solicitationReason: "APIエラー",
        }
        
        const originalIndex = orders.findIndex(o => o.amazonOrderId === order.amazonOrderId)
        if (originalIndex >= 0) {
          orders[originalIndex] = errorOrder
        }

        // エラーの場合の更新情報も収集
        updatedOrders.push({
          amazonOrderId: order.amazonOrderId,
          updates: {
            reviewRequestStatus: "error",
            solicitationEligible: false,
            solicitationReason: "APIエラー",
          }
        })
      }
    }

    // 全体のSolicitationチェック完了後、一度だけまとめて保存
    if (updatedOrders.length > 0) {
      await this.batchUpdateOrders(orders, updatedOrders)
    }

    console.log(`[DEBUG] Solicitationチェック完了: ${ordersNeedingCheck.length}件`)
    return orders
  }

  // まとめて注文データを更新保存（ファイルI/O最適化）
  private async batchUpdateOrders(processedOrders: Order[], updates: { amazonOrderId: string; updates: Partial<Order> }[]): Promise<void> {
    console.log(`[DEBUG] ${updates.length}件の更新をまとめて保存中...`)
    
    // 全体データを読み込み、今回の結果で更新
    const allStoredOrders = await ordersStorage.loadOrders()
    const orderMap = new Map<string, Order>()
    
    // 既存データをマップに設定
    allStoredOrders.forEach(order => orderMap.set(order.amazonOrderId, order))
    
    // 今回処理した注文で上書き
    processedOrders.forEach(order => orderMap.set(order.amazonOrderId, order))
    
    const updatedAllOrders = Array.from(orderMap.values())
    await ordersStorage.saveOrders(updatedAllOrders)
    console.log(`[DEBUG] 全データ更新保存完了: ${updatedAllOrders.length}件`)
  }

  // 単一注文の詳細処理（OrderItems API不要）
  private async processOrderWithDetails(order: any, index: number, total: number): Promise<Order> {
    try {
      console.log(`[DEBUG] 注文 ${order.AmazonOrderId} の詳細取得中... (${index}/${total})`)
      
      // 1. Solicitation APIのみ実行
      console.log(`[DEBUG] Solicitation API呼び出し中 (${order.AmazonOrderId})`)
      const solicitationResult = await this.getSolicitationActions(order.AmazonOrderId)
      
      // 2. 基本的な商品データは注文情報から取得（OrderItems API不要）
      const basicItems = [{
        id: "basic",
        title: "商品詳細情報なし",
        asin: "",
        quantity: order.NumberOfItemsShipped + order.NumberOfItemsUnshipped || 1,
        price: 0,
        imageUrl: "",
        brand: "",
        manufacturer: "",
        productType: "",
      }]
      
      // 3. 注文オブジェクトを作成
      const enrichedOrder: Order = {
        id: order.AmazonOrderId,
        amazonOrderId: order.AmazonOrderId,
        purchaseDate: order.PurchaseDate,
        orderStatus: ORDER_STATUS_MAP[order.OrderStatus as keyof typeof ORDER_STATUS_MAP] || order.OrderStatus,
        fulfillmentChannel: order.FulfillmentChannel === "AFN" ? "AFN" : "MFN",
        salesChannel: order.SalesChannel || "Amazon.co.jp",
        totalAmount: parseFloat(order.OrderTotal?.Amount || "0"),
        currency: order.OrderTotal?.CurrencyCode || "JPY",
        numberOfItemsShipped: order.NumberOfItemsShipped || 0,
        numberOfItemsUnshipped: order.NumberOfItemsUnshipped || 0,
        customer: {
          name: order.BuyerInfo?.BuyerName,
          email: order.BuyerInfo?.BuyerEmail,
          buyerInfo: order.BuyerInfo,
        },
        items: basicItems,
        shippingAddress: order.DefaultShipFromLocationAddress,
        reviewRequestSent: false,
        reviewRequestStatus: solicitationResult.eligible ? "eligible" : "not_eligible",
        solicitationEligible: solicitationResult.eligible,
        solicitationReason: solicitationResult.reason,
      }
      
      console.log(`[DEBUG] 注文 ${order.AmazonOrderId} の詳細取得完了`)
      return enrichedOrder
      
    } catch (error) {
      console.warn(`[DEBUG] 注文 ${order.AmazonOrderId} の詳細取得エラー:`, error)
      return this.createBasicOrder(order, "データ取得エラー")
    }
  }

  // エラー時の基本注文オブジェクト作成
  private createBasicOrder(order: any, errorReason: string): Order {
    return {
      id: order.AmazonOrderId,
      amazonOrderId: order.AmazonOrderId,
      purchaseDate: order.PurchaseDate,
      orderStatus: ORDER_STATUS_MAP[order.OrderStatus as keyof typeof ORDER_STATUS_MAP] || order.OrderStatus,
      fulfillmentChannel: order.FulfillmentChannel === "AFN" ? "AFN" : "MFN",
      salesChannel: order.SalesChannel || "Amazon.co.jp",
      totalAmount: parseFloat(order.OrderTotal?.Amount || "0"),
      currency: order.OrderTotal?.CurrencyCode || "JPY",
      numberOfItemsShipped: order.NumberOfItemsShipped || 0,
      numberOfItemsUnshipped: order.NumberOfItemsUnshipped || 0,
      customer: {
        name: order.BuyerInfo?.BuyerName,
        email: order.BuyerInfo?.BuyerEmail,
        buyerInfo: order.BuyerInfo,
      },
      items: [{
        id: "error",
        title: "商品情報取得エラー",
        asin: "",
        quantity: 1,
        price: 0,
        imageUrl: "",
      }],
      shippingAddress: order.DefaultShipFromLocationAddress,
      reviewRequestSent: false,
      reviewRequestStatus: "error",
      solicitationEligible: false,
      solicitationReason: errorReason,
    }
  }

  // Solicitation Actions APIでレビュー依頼可能性をチェック
  async getSolicitationActions(amazonOrderId: string) {
    try {
      const apiParams: Record<string, string> = {
        marketplaceIds: this.config.marketplace,
      }

      const response = await this.makeApiRequest(
        `/solicitations/v1/orders/${amazonOrderId}`,
        apiParams
      )

      // レスポンス構造の解析
      const links = response._links || {}
      const actions = links.actions || []

      // productReviewAndSellerFeedbackSolicitationアクションがあるかチェック
      const canSendReview = actions.some((action: any) => 
        action.href && action.href.includes('productReviewAndSellerFeedbackSolicitation')
      )

      console.log(`[DEBUG] 注文 ${amazonOrderId} レビュー依頼可能: ${canSendReview}`)

      return {
        eligible: canSendReview,
        reason: canSendReview ? "送信可能" : "Amazon側で対象外",
        actions,
        links
      }
    } catch (error) {
      console.warn(`Solicitation API error for order ${amazonOrderId}:`, error)
      
      // エラー時はAPIエラーとして処理
      if (error instanceof Error && error.message.includes("403")) {
        return {
          eligible: false,
          reason: "権限なし（Solicitation API）",
          actions: [],
          links: {}
        }
      }
      
      if (error instanceof Error && error.message.includes("404")) {
        return {
          eligible: false,
          reason: "注文が見つからない",
          actions: [],
          links: {}
        }
      }

      return {
        eligible: false,
        reason: "API取得エラー",
        actions: [],
        links: {}
      }
    }
  }

  // 複数注文のSolicitation Actionsを一括チェック
  async getSolicitationActionsForOrders(amazonOrderIds: string[]) {
    const results: { [orderId: string]: any } = {}
    
    for (let i = 0; i < amazonOrderIds.length; i++) {
      const orderId = amazonOrderIds[i]
      console.log(`[DEBUG] Solicitation Actions取得中: ${orderId} (${i + 1}/${amazonOrderIds.length})`)
      
      try {
        const solicitationResult = await this.getSolicitationActions(orderId)
        results[orderId] = solicitationResult
      } catch (error) {
        console.warn(`Failed to get solicitation actions for ${orderId}:`, error)
        results[orderId] = {
          eligible: false,
          reason: "取得失敗",
          actions: [],
          links: {}
        }
      }
      
      // レート制限対応: Solicitation Actions API は1 req/sec (1秒間隔)
      if (i < amazonOrderIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }


}

export const amazonApiService = new AmazonApiService()