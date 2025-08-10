export interface OrderItem {
  id: string
  title: string
  asin: string
  quantity: number
  price: number
  imageUrl?: string
}

export interface OrderCustomer {
  name?: string
  email?: string
  buyerInfo?: {
    buyerEmail?: string
    buyerName?: string
  }
}

export interface Order {
  id: string
  amazonOrderId: string
  purchaseDate: string
  orderStatus: string
  fulfillmentChannel: "AFN" | "MFN" // Amazon Fulfilled Network or Merchant Fulfilled Network
  salesChannel: string
  totalAmount: number
  currency: string
  numberOfItemsShipped: number
  numberOfItemsUnshipped: number
  customer: OrderCustomer
  items: OrderItem[]
  shippingAddress?: {
    name?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    stateOrRegion?: string
    postalCode?: string
    countryCode?: string
  }
  // レビュー依頼関連
  reviewRequestSent?: boolean
  reviewRequestSentAt?: string
  reviewRequestStatus?: "pending" | "sent" | "failed" | "eligible" | "not_eligible" | "error"
  // Amazon APIによるリアルタイム送信可能状態
  amazonEligible?: boolean
  amazonEligibilityReason?: string
  amazonEligibilityCheckedAt?: string
  // Solicitation Actions APIによる送信可能状態（事前取得）
  solicitationEligible?: boolean
  solicitationReason?: string
}

export interface OrdersResponse {
  orders: Order[]
  nextToken?: string
  totalCount?: number
  lastUpdated: string
}

export interface ReviewRequest {
  orderId: string
  customerEmail: string
  customerName?: string
  items: OrderItem[]
  requestedAt: string
  status: "pending" | "sent" | "failed"
  message?: string
}

export interface ReviewRequestBatch {
  id: string
  orders: Order[]
  requestedAt: string
  totalCount: number
  sentCount: number
  failedCount: number
  status: "processing" | "completed" | "failed"
}