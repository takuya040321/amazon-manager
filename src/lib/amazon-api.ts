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
  useMockData: boolean
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
      useMockData: process.env.USE_MOCK_DATA === "true",
    }

    // 必須設定の検証
    this.validateConfig()
  }

  private validateConfig(): void {
    // モックモードの場合は設定チェックをスキップ
    if (this.config.useMockData) {
      return
    }

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
    // モックモードの場合は模擬データを返す
    if (this.config.useMockData) {
      return this.getMockData(endpoint)
    }

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

  // 開発・テスト用のモックデータ
  private getMockData(endpoint: string) {
    if (endpoint.includes("/orders")) {
      return {
        payload: {
          Orders: [
            {
              AmazonOrderId: "112-1234567-1234567",
              PurchaseDate: "2024-01-15T10:30:00Z",
              OrderStatus: "Shipped",
              FulfillmentChannel: "AFN",
              SalesChannel: "Amazon.co.jp",
              OrderTotal: { Amount: "12800", CurrencyCode: "JPY" },
              NumberOfItemsShipped: 2,
              NumberOfItemsUnshipped: 0,
              BuyerInfo: {
                BuyerName: "田中太郎",
                BuyerEmail: "customer@example.com"
              }
            },
            {
              AmazonOrderId: "112-1234567-1234568",
              PurchaseDate: "2024-01-14T14:20:00Z",
              OrderStatus: "Pending",
              FulfillmentChannel: "MFN",
              SalesChannel: "Amazon.co.jp",
              OrderTotal: { Amount: "8900", CurrencyCode: "JPY" },
              NumberOfItemsShipped: 0,
              NumberOfItemsUnshipped: 1,
              BuyerInfo: {
                BuyerName: "佐藤花子",
                BuyerEmail: "customer2@example.com"
              }
            }
          ],
          NextToken: null
        }
      }
    }

    if (endpoint.includes("/orderItems")) {
      return {
        payload: {
          OrderItems: [
            {
              OrderItemId: "12345678901234",
              Title: "VTコスメティックス シカスキン テスト商品",
              ASIN: "B09VBFCBWZ",
              QuantityOrdered: "1",
              ItemPrice: { Amount: "2480", CurrencyCode: "JPY" }
            }
          ]
        }
      }
    }

    return { payload: {} }
  }

  // 汎用的な認証済みAPIリクエストメソッド
  async makeAuthenticatedRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    customHost?: string
  ): Promise<Response> {
    // モックモードの場合は模擬レスポンスを返す
    if (this.config.useMockData) {
      const mockResponse = new Response(JSON.stringify({ _links: { actions: [] } }), {
        status: method === 'POST' ? 201 : 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      })
      return mockResponse
    }

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
      
      const orders = this.parseOrdersResponse(response.payload.Orders)

      // 商品詳細は非同期で後から取得
      setTimeout(() => {
        this.loadOrderItemsInBackground(orders)
      }, 1000)

      return {
        orders,
        nextToken: response.payload.NextToken,
        totalCount: response.payload.Orders.length,
        lastUpdated: new Date().toISOString(),
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

        const orders = this.parseOrdersResponse(response.payload.Orders)
        const remainingNeeded = params.totalLimit - totalFetched
        const ordersToAdd = orders.slice(0, remainingNeeded)
        
        allOrders.push(...ordersToAdd)
        totalFetched += ordersToAdd.length

        console.log(`[DEBUG] ページ${page}: ${ordersToAdd.length}件取得 (累計: ${totalFetched}/${params.totalLimit})`)

        nextToken = response.payload.NextToken
        if (!nextToken || totalFetched >= params.totalLimit) {
          console.log(`[DEBUG] 取得完了: ${totalFetched}件`)
          break
        }

        // API制限対応: 0.5秒間隔
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        console.error(`[DEBUG] ページ${page}の取得でエラー:`, error)
        break
      }
    }

    // 商品詳細は非同期で後から取得
    setTimeout(() => {
      this.loadOrderItemsInBackground(allOrders)
    }, 1000)

    return {
      orders: allOrders,
      nextToken: nextToken,
      totalCount: totalFetched,
      lastUpdated: new Date().toISOString(),
    }
  }

  // 注文データのパース（共通処理）
  private parseOrdersResponse(ordersData: any[]): Order[] {
    return ordersData.map((order: any) => ({
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
        title: "商品情報を読み込み中...",
        asin: "",
        quantity: 1,
        price: 0,
        imageUrl: "",
      }],
      shippingAddress: order.DefaultShipFromLocationAddress,
      reviewRequestSent: false,
      reviewRequestStatus: "pending",
    }))
  }

  // バックグラウンドで商品詳細を取得
  private async loadOrderItemsInBackground(orders: any[]) {
    const batchSize = 2
    
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize)
      
      for (const order of batch) {
        try {
          const itemsResponse = await this.getOrderItems(order.amazonOrderId)
          // 商品詳細を更新（実際のアプリケーションではキャッシュやリアクティブ更新が必要）
          order.items = itemsResponse
        } catch (error) {
          console.warn(`商品詳細取得エラー ${order.amazonOrderId}:`, error)
          order.items = [{
            id: "error",
            title: "商品情報取得エラー",
            asin: "",
            quantity: 1,
            price: 0,
            imageUrl: "",
          }]
        }
      }
      
      // バッチ間に待機時間を追加
      if (i + batchSize < orders.length) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
  }

  private async getOrderItems(orderId: string) {
    try {
      // レート制限対応：リクエスト間隔を設ける（バランス調整）
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2秒待機（速度とAPI制限のバランス）
      
      const response = await this.makeApiRequest(`/orders/v0/orders/${orderId}/orderItems`)
      
      return response.payload.OrderItems.map((item: any) => ({
        id: item.OrderItemId,
        title: item.Title,
        asin: item.ASIN,
        quantity: parseInt(item.QuantityOrdered),
        price: parseFloat(item.ItemPrice?.Amount || "0"),
        imageUrl: this.generateAmazonImageUrl(item.ASIN),
      }))
    } catch (error) {
      // 429エラー（クォータ制限）の場合は特別処理
      if (error instanceof Error && error.message.includes("429")) {
        console.warn(`API quota exceeded for order ${orderId}, skipping items`)
        // クォータ制限の場合は追加で待機してからリトライはしない
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
      // その他のエラー時は基本情報のみ返す
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

  // Amazon商品画像URLを生成
  private generateAmazonImageUrl(asin: string): string {
    if (!asin) return ""
    
    // Amazon商品画像のURLパターン（中サイズ）
    // 日本のAmazon商品は .jp ドメインの画像URLを使用
    return `https://m.media-amazon.com/images/I/${asin}.jpg`
  }
}

export const amazonApiService = new AmazonApiService()