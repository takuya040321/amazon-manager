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

// Amazon SP-APIクライアント設定
interface AmazonApiConfig {
  refreshToken: string
  clientId: string
  clientSecret: string
  region: string
  marketplace: string
}

class AmazonApiService {
  private config: AmazonApiConfig
  private accessToken?: string
  private tokenExpiresAt?: number

  constructor() {
    this.config = {
      refreshToken: process.env.AMAZON_REFRESH_TOKEN || "",
      clientId: process.env.AMAZON_CLIENT_ID || "",
      clientSecret: process.env.AMAZON_CLIENT_SECRET || "",
      region: process.env.AMAZON_REGION || "us-east-1",
      marketplace: process.env.AMAZON_MARKETPLACE_ID || "",
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
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000 // 1分のマージン

      return this.accessToken
    } catch (error) {
      console.error("Failed to get access token:", error)
      throw new Error("Amazon API認証に失敗しました")
    }
  }

  private async makeApiRequest(endpoint: string, params?: Record<string, string>) {
    const accessToken = await this.getAccessToken()
    const queryString = params ? "?" + new URLSearchParams(params).toString() : ""
    const url = `https://sellingpartnerapi-na.amazon.com${endpoint}${queryString}`

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "x-amz-access-token": accessToken,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getOrders(params?: {
    createdAfter?: string
    createdBefore?: string
    orderStatuses?: string[]
    maxResultsPerPage?: number
    nextToken?: string
  }): Promise<OrdersResponse> {
    try {
      const apiParams: Record<string, string> = {
        MarketplaceIds: this.config.marketplace,
      }

      if (params?.createdAfter) apiParams.CreatedAfter = params.createdAfter
      if (params?.createdBefore) apiParams.CreatedBefore = params.createdBefore
      if (params?.orderStatuses) apiParams.OrderStatuses = params.orderStatuses.join(",")
      if (params?.maxResultsPerPage) apiParams.MaxResultsPerPage = params.maxResultsPerPage.toString()
      if (params?.nextToken) apiParams.NextToken = params.nextToken

      const response = await this.makeApiRequest("/orders/v0/orders", apiParams)
      
      const orders: Order[] = await Promise.all(
        response.payload.Orders.map(async (order: any) => {
          // 注文アイテムを取得
          const itemsResponse = await this.getOrderItems(order.AmazonOrderId)
          
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
            items: itemsResponse,
            shippingAddress: order.DefaultShipFromLocationAddress,
            reviewRequestSent: false,
            reviewRequestStatus: "pending",
          }
        })
      )

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

  private async getOrderItems(orderId: string) {
    try {
      const response = await this.makeApiRequest(`/orders/v0/orders/${orderId}/orderItems`)
      
      return response.payload.OrderItems.map((item: any) => ({
        id: item.OrderItemId,
        title: item.Title,
        asin: item.ASIN,
        quantity: parseInt(item.QuantityOrdered),
        price: parseFloat(item.ItemPrice?.Amount || "0"),
        imageUrl: item.ItemImage,
      }))
    } catch (error) {
      console.error(`Failed to get order items for ${orderId}:`, error)
      return []
    }
  }
}

export const amazonApiService = new AmazonApiService()