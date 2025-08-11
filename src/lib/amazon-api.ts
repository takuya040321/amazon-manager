import { Order, OrdersResponse } from "@/types/order"

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

  private async makeApiRequest(endpoint: string, params?: Record<string, string>) {
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
    customHost?: string
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

    return fetch(url, requestOptions)
  }

  async getOrders(params?: {
    createdAfter?: string
    createdBefore?: string
    orderStatuses?: string[]
    maxResultsPerPage?: number
    nextToken?: string
    totalLimit?: number
  }): Promise<OrdersResponse> {
    try {
      // totalLimitが指定されている場合は自動ページネーション
      if (params?.totalLimit && params.totalLimit > 100 && !params.nextToken) {
        return await this.getOrdersWithPagination(params)
      }

      // 通常の単一ページ取得
      const apiParams: Record<string, string> = {
        MarketplaceIds: this.config.marketplace,
      }

      if (params?.createdAfter) apiParams.CreatedAfter = params.createdAfter
      if (params?.createdBefore) apiParams.CreatedBefore = params.createdBefore
      if (params?.orderStatuses) apiParams.OrderStatuses = params.orderStatuses.join(",")
      if (params?.maxResultsPerPage) apiParams.MaxResultsPerPage = params.maxResultsPerPage.toString()
      if (params?.nextToken) apiParams.NextToken = params.nextToken

      const response = await this.makeApiRequest("/orders/v0/orders", apiParams)
      
      console.log(`[DEBUG] 注文データ取得完了: ${response.payload.Orders.length}件`)
      
      // 段階的表示：まず基本情報のみで即座に返す
      const basicOrders = response.payload.Orders.map((order: any) => 
        this.createBasicOrderFromRawData(order)
      )

      return {
        orders: basicOrders,
        nextToken: response.payload.NextToken,
        totalCount: response.payload.Orders.length,
        lastUpdated: new Date().toISOString(),
        needsEnrichment: true, // 商品詳細の追加取得が必要
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

        // ページごとに商品詳細も並列取得
        const remainingNeeded = params.totalLimit - totalFetched
        const maxOrdersToProcess = Math.min(100, Math.min(remainingNeeded, response.payload.Orders.length))
        const pageOrders = response.payload.Orders.slice(0, maxOrdersToProcess)
        console.log(`[DEBUG] ページ${page}: ${pageOrders.length}件を並列処理で取得予定`)
        const ordersWithItems = await this.enrichOrdersWithProductDetails(pageOrders)
        
        allOrders.push(...ordersWithItems)
        totalFetched += ordersWithItems.length

        console.log(`[DEBUG] ページ${page}: ${ordersWithItems.length}件取得 (並列処理完了、累計: ${totalFetched}/${params.totalLimit})`)

        nextToken = response.payload.NextToken
        if (!nextToken || totalFetched >= params.totalLimit) {
          console.log(`[DEBUG] 取得完了: ${totalFetched}件`)
          break
        }

        // API制限対応: 並列処理後の間隔調整
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

  // 並列処理で注文データに商品詳細を追加（高速化版）
  private async enrichOrdersWithProductDetails(ordersData: any[]): Promise<Order[]> {
    console.log(`[DEBUG] 並列処理で${ordersData.length}件の注文詳細を取得開始`)
    
    // バッチサイズ（同時実行数）を設定
    const batchSize = 5 // 段階的表示で最適化: 5件ずつ並列処理
    const enrichedOrders: Order[] = []
    
    for (let i = 0; i < ordersData.length; i += batchSize) {
      const batch = ordersData.slice(i, i + batchSize)
      console.log(`[DEBUG] バッチ${Math.floor(i/batchSize) + 1}: ${batch.length}件を並列処理中...`)
      
      // バッチ内の注文を並列処理
      const batchPromises = batch.map((order, batchIndex) => 
        this.processOrderWithDetails(order, i + batchIndex + 1, ordersData.length)
      )
      
      try {
        const batchResults = await Promise.all(batchPromises)
        enrichedOrders.push(...batchResults)
        
        // バッチ間で1秒待機（段階的表示で最適化）
        if (i + batchSize < ordersData.length) {
          console.log(`[DEBUG] 次のバッチまで1秒待機...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`[DEBUG] バッチ処理エラー:`, error)
        // エラー時は個別に処理
        for (const order of batch) {
          const basicOrder = this.createBasicOrder(order, "バッチ処理エラー")
          enrichedOrders.push(basicOrder)
        }
      }
    }
    
    console.log(`[DEBUG] 並列処理完了: ${enrichedOrders.length}件の注文詳細取得完了`)
    return enrichedOrders
  }

  // 単一注文の詳細処理（並列実行対応）
  private async processOrderWithDetails(order: any, index: number, total: number): Promise<Order> {
    try {
      console.log(`[DEBUG] 注文 ${order.AmazonOrderId} の詳細取得中... (${index}/${total})`)
      
      // 1. OrderItems APIで基本情報を取得
      const orderItems = await this.getOrderItems(order.AmazonOrderId)
      const asins = orderItems.map(item => item.asin).filter(Boolean)
      
      // 2. Catalog APIとSolicitation APIを並列実行
      let enrichedItems = orderItems
      let solicitationResult = { eligible: false, reason: "API呼び出し失敗" }
      
      if (asins.length > 0) {
        console.log(`[DEBUG] 並列API呼び出し: Catalog + Solicitation (${order.AmazonOrderId})`)
        
        // Catalog APIとSolicitation APIを並列実行
        const [catalogItems, solicitationResponse] = await Promise.all([
          this.getCatalogItems(asins),
          this.getSolicitationActions(order.AmazonOrderId)
        ])
        
        solicitationResult = solicitationResponse
        
        // 3. データを結合
        enrichedItems = orderItems.map(orderItem => {
          const catalogItem = catalogItems.find(cat => cat.asin === orderItem.asin)
          return {
            id: orderItem.id,
            title: catalogItem?.title || orderItem.title || `商品 ${orderItem.asin}`,
            asin: orderItem.asin,
            quantity: orderItem.quantity,
            price: orderItem.price,
            imageUrl: catalogItem?.imageUrl || this.generateAmazonImageUrl(orderItem.asin),
            brand: catalogItem?.brand || "",
            manufacturer: catalogItem?.manufacturer || "",
            productType: catalogItem?.productType || "",
          }
        })
      } else {
        // ASINがない場合はSolicitationのみ実行
        solicitationResult = await this.getSolicitationActions(order.AmazonOrderId)
      }
      
      // 4. 注文オブジェクトを作成
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
        items: enrichedItems,
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
  
  // 生の注文データから基本情報のみの注文オブジェクトを作成
  private createBasicOrderFromRawData(order: any): Order {
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
        id: "loading",
        title: "商品情報取得中...",
        asin: "",
        quantity: order.NumberOfItemsShipped + order.NumberOfItemsUnshipped || 1,
        price: 0,
        imageUrl: "",
      }],
      shippingAddress: order.DefaultShipFromLocationAddress,
      reviewRequestSent: false,
      reviewRequestStatus: "pending",
      solicitationEligible: undefined, // 未確認
      solicitationReason: "取得中...",
    }
  }


  async getOrderItems(orderId: string) {
    try {
      // レート制限対応：OrderItems API は0.5 req/sec (2秒間隔)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const response = await this.makeApiRequest(`/orders/v0/orders/${orderId}/orderItems`)
      
      return response.payload.OrderItems.map((item: any) => ({
        id: item.OrderItemId,
        title: item.Title || `商品 ${item.ASIN}`, // タイトルがない場合はASINでフォールバック
        asin: item.ASIN || "", // ASINを確実に取得
        quantity: parseInt(item.QuantityOrdered) || 1,
        price: parseFloat(item.ItemPrice?.Amount || "0"),
        imageUrl: "", // 一旦空にして、後でCatalog APIで取得
      }))
    } catch (error) {
      // 429エラー（クォータ制限）の場合は特別処理
      if (error instanceof Error && error.message.includes("429")) {
        console.warn(`API quota exceeded for order ${orderId}, skipping items`)
        return [{
          id: "quota-exceeded",
          title: "API制限により商品情報を取得できませんでした",
          asin: "",
          quantity: 1,
          price: 0,
          imageUrl: "",
        }]
      }
      
      console.error(`Failed to get order items for ${orderId}:`, error)
      return [{
        id: "unknown",
        title: "商品情報取得エラー",
        asin: "",
        quantity: 1,
        price: 0,
        imageUrl: "",
      }]
    }
  }

  // Catalog Items APIで商品情報を取得
  async getCatalogItem(asin: string) {
    try {
      const apiParams: Record<string, string> = {
        marketplaceIds: this.config.marketplace,
        includedData: "attributes,images,productTypes,salesRanks",
      }

      const response = await this.makeApiRequest(`/catalog/2022-04-01/items/${asin}`, apiParams)
      
      const item = response
      if (!item) {
        throw new Error("商品情報が見つかりません")
      }

      // 商品名を取得（複数のフィールドから優先順位で選択）
      const title = item.attributes?.item_name?.[0]?.value ||
                   item.attributes?.title?.[0]?.value ||
                   item.attributes?.brand?.[0]?.value ||
                   `商品 ${asin}`

      // 画像URLを取得
      let imageUrl = ""
      if (item.images && item.images.length > 0) {
        const mainImage = item.images[0]
        imageUrl = mainImage.images?.[0]?.link || this.generateAmazonImageUrl(asin)
      } else {
        imageUrl = this.generateAmazonImageUrl(asin)
      }

      return {
        asin,
        title,
        imageUrl,
        brand: item.attributes?.brand?.[0]?.value || "",
        manufacturer: item.attributes?.manufacturer?.[0]?.value || "",
        productType: item.productTypes?.[0] || "",
      }
    } catch (error) {
      console.warn(`Catalog API error for ASIN ${asin}:`, error)
      // Catalog APIでエラーの場合はフォールバック
      return {
        asin,
        title: `商品 ${asin}`,
        imageUrl: this.generateAmazonImageUrl(asin),
        brand: "",
        manufacturer: "",
        productType: "",
      }
    }
  }

  // 複数のASINを一括で取得
  async getCatalogItems(asins: string[]) {
    const results: any[] = []
    
    // API制限を考慮して1件ずつ取得
    for (const asin of asins) {
      try {
        const item = await this.getCatalogItem(asin)
        results.push(item)
        
        // レート制限対応: Catalog Items API を最適化 (0.3秒間隔)
        if (asins.indexOf(asin) < asins.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      } catch (error) {
        console.warn(`Failed to get catalog item for ${asin}:`, error)
        results.push({
          asin,
          title: `商品 ${asin}`,
          imageUrl: this.generateAmazonImageUrl(asin),
          brand: "",
          manufacturer: "",
          productType: "",
        })
      }
    }
    
    return results
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

  // 注文IDのリストから商品詳細を取得して注文オブジェクトを更新
  async enrichOrdersByIds(orderIds: string[]): Promise<Order[]> {
    const enrichedOrders: Order[] = []
    
    console.log(`[DEBUG] 注文ID指定での商品詳細取得: ${orderIds.length}件`)
    
    // バッチサイズ（同時実行数）を設定
    const batchSize = 5 // 段階的表示なので少し多めに並列処理
    
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize)
      console.log(`[DEBUG] バッチ${Math.floor(i/batchSize) + 1}: ${batch.length}件を並列処理中...`)
      
      // バッチ内の注文を並列処理
      const batchPromises = batch.map((orderId) => this.enrichSingleOrderById(orderId))
      
      try {
        const batchResults = await Promise.all(batchPromises)
        enrichedOrders.push(...batchResults.filter(order => order !== null))
        
        // バッチ間で1秒待機（レート制限対応）
        if (i + batchSize < orderIds.length) {
          console.log(`[DEBUG] 次のバッチまで1秒待機...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`[DEBUG] バッチ処理エラー:`, error)
      }
    }
    
    console.log(`[DEBUG] 商品詳細取得完了: ${enrichedOrders.length}件`)
    return enrichedOrders
  }

  // 単一の注文IDから詳細情報を取得
  private async enrichSingleOrderById(orderId: string): Promise<Order | null> {
    try {
      console.log(`[DEBUG] 注文 ${orderId} の詳細取得中...`)
      
      // 1. OrderItems APIで基本情報を取得
      const orderItems = await this.getOrderItems(orderId)
      const asins = orderItems.map(item => item.asin).filter(Boolean)
      
      // 2. Catalog APIとSolicitation APIを並列実行
      let enrichedItems = orderItems
      let solicitationResult = { eligible: false, reason: "API呼び出し失敗" }
      
      if (asins.length > 0) {
        const [catalogItems, solicitationResponse] = await Promise.all([
          this.getCatalogItems(asins),
          this.getSolicitationActions(orderId)
        ])
        
        solicitationResult = solicitationResponse
        
        // 3. データを結合
        enrichedItems = orderItems.map(orderItem => {
          const catalogItem = catalogItems.find(cat => cat.asin === orderItem.asin)
          return {
            id: orderItem.id,
            title: catalogItem?.title || orderItem.title || `商品 ${orderItem.asin}`,
            asin: orderItem.asin,
            quantity: orderItem.quantity,
            price: orderItem.price,
            imageUrl: catalogItem?.imageUrl || this.generateAmazonImageUrl(orderItem.asin),
            brand: catalogItem?.brand || "",
            manufacturer: catalogItem?.manufacturer || "",
            productType: catalogItem?.productType || "",
          }
        })
      } else {
        solicitationResult = await this.getSolicitationActions(orderId)
      }
      
      // 4. 更新された注文オブジェクトを返す（基本情報は含まない、商品詳細のみ）
      return {
        id: orderId,
        amazonOrderId: orderId,
        purchaseDate: "", // 基本情報は既にフロントエンドにある
        orderStatus: "",
        fulfillmentChannel: "MFN",
        salesChannel: "",
        totalAmount: 0,
        currency: "JPY",
        numberOfItemsShipped: 0,
        numberOfItemsUnshipped: 0,
        customer: { name: "", email: "" },
        items: enrichedItems,
        reviewRequestSent: false,
        reviewRequestStatus: solicitationResult.eligible ? "eligible" : "not_eligible",
        solicitationEligible: solicitationResult.eligible,
        solicitationReason: solicitationResult.reason,
      }
      
    } catch (error) {
      console.warn(`[DEBUG] 注文 ${orderId} の詳細取得エラー:`, error)
      return null
    }
  }

  // Amazon商品画像URLを生成
  private generateAmazonImageUrl(asin: string, title?: string): string {
    if (!asin) return ""
    
    // 複数のAmazon画像URLパターンを試行
    const imageUrls = [
      `https://m.media-amazon.com/images/I/${asin}._AC_SL160_.jpg`,
      `https://images-na.ssl-images-amazon.com/images/I/${asin}._AC_SL160_.jpg`,
      `https://ws-fe.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL160_&ID=AsinImage&MarketPlace=JP&ServiceVersion=20070822&WS=1&language=ja_JP&tag=dummy-22`,
    ]
    
    // 最初のURLを返す（エラー時にフォールバック）
    return imageUrls[0]
  }
}

export const amazonApiService = new AmazonApiService()