import { Order, ReviewRequest, ReviewRequestBatch } from "@/types/order"
import { cacheService } from "./cache"
import { amazonApiService } from "./amazon-api"

class ReviewService {
  private marketplaceId: string = "A1VC38T7YXB528" // 日本マーケットプレイス

  constructor() {}

  // レビュー依頼の対象となる注文をフィルタリング
  getEligibleOrdersForReview(orders: Order[]): Order[] {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return orders.filter(order => {
      // 条件：
      // 1. 発送済みまたは配送完了
      // 2. 30日以内の注文
      // 3. まだレビュー依頼を送っていない
      // 4. 顧客のメールアドレスがある
      const orderDate = new Date(order.purchaseDate)
      const isRecentOrder = orderDate >= thirtyDaysAgo
      const isShippedOrCompleted = ["発送済み", "完了", "配送中"].includes(order.orderStatus)
      const hasNotRequestedReview = !order.reviewRequestSent
      const hasCustomerEmail = !!order.customer.email || !!order.customer.buyerInfo?.buyerEmail

      return isRecentOrder && isShippedOrCompleted && hasNotRequestedReview && hasCustomerEmail
    })
  }

  // Amazon Solicitations APIを使用してレビュー依頼可能かチェック
  async checkSolicitationEligibility(order: Order): Promise<boolean> {
    try {
      console.log(`[DEBUG] Checking solicitation eligibility for order: ${order.amazonOrderId}`)
      
      if (!amazonApiService.makeAuthenticatedRequest) {
        console.error('[DEBUG] makeAuthenticatedRequest method not found on amazonApiService')
        return false
      }

      const response = await amazonApiService.makeAuthenticatedRequest(
        'GET',
        `/solicitations/v1/orders/${order.amazonOrderId}?marketplaceIds=${this.marketplaceId}`,
        null,
        'sellingpartnerapi-fe.amazon.com' // 極東地域エンドポイント
      )

      console.log(`[DEBUG] Solicitation eligibility response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error response')
        console.error(`[DEBUG] Solicitation eligibility check failed: ${response.status} ${response.statusText}`)
        console.error(`[DEBUG] Error response body: ${errorText}`)
        return false
      }

      const data = await response.json()
      console.log(`[DEBUG] Solicitation eligibility response data:`, JSON.stringify(data, null, 2))
      
      // productReviewAndSellerFeedback アクションが利用可能かチェック
      const isEligible = data._links?.actions?.some((action: any) => 
        action.href?.includes('productReviewAndSellerFeedback')
      ) || false
      
      console.log(`[DEBUG] Order ${order.amazonOrderId} is eligible for solicitation: ${isEligible}`)
      return isEligible
    } catch (error) {
      console.error('[DEBUG] Error checking solicitation eligibility:', error)
      if (error instanceof Error) {
        console.error('[DEBUG] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
      return false
    }
  }

  // Amazon Solicitations APIを使用してレビュー依頼を送信
  async sendSolicitationRequest(order: Order): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[DEBUG] Sending solicitation request for order: ${order.amazonOrderId}`)
      
      const response = await amazonApiService.makeAuthenticatedRequest(
        'POST',
        `/solicitations/v1/orders/${order.amazonOrderId}/solicitations/productReviewAndSellerFeedback?marketplaceIds=${this.marketplaceId}`,
        {},
        'sellingpartnerapi-fe.amazon.com' // 極東地域エンドポイント
      )

      console.log(`[DEBUG] Solicitation send response status: ${response.status}`)

      if (response.status === 201) {
        console.log(`[DEBUG] Solicitation request sent successfully for order: ${order.amazonOrderId}`)
        return { success: true }
      } else {
        const errorText = await response.text().catch(() => 'Could not read error response')
        const errorData = JSON.parse(errorText || '{}').catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`
        
        console.error(`[DEBUG] Solicitation send failed for order: ${order.amazonOrderId}`)
        console.error(`[DEBUG] Response status: ${response.status} ${response.statusText}`)
        console.error(`[DEBUG] Response body: ${errorText}`)
        
        return {
          success: false,
          error: errorMessage
        }
      }
    } catch (error) {
      console.error(`[DEBUG] Exception while sending solicitation for order: ${order.amazonOrderId}`, error)
      if (error instanceof Error) {
        console.error('[DEBUG] Exception details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました'
      }
    }
  }

  // 単一の注文に対するレビュー依頼送信
  async sendReviewRequest(order: Order): Promise<ReviewRequest> {
    console.log(`[DEBUG] Starting review request for order: ${order.amazonOrderId}`)
    
    const customerEmail = order.customer.email || order.customer.buyerInfo?.buyerEmail
    if (!customerEmail) {
      console.error(`[DEBUG] No customer email found for order: ${order.amazonOrderId}`)
      throw new Error("顧客のメールアドレスが見つかりません")
    }

    console.log(`[DEBUG] Customer email found: ${customerEmail}`)

    try {
      // まず対象注文かチェック
      console.log(`[DEBUG] Checking eligibility for order: ${order.amazonOrderId}`)
      const isEligible = await this.checkSolicitationEligibility(order)
      
      if (!isEligible) {
        console.log(`[DEBUG] Order ${order.amazonOrderId} is not eligible for review request`)
        const reviewRequest: ReviewRequest = {
          orderId: order.id,
          customerEmail,
          customerName: order.customer.name || order.customer.buyerInfo?.buyerName,
          items: order.items,
          requestedAt: new Date().toISOString(),
          status: "failed",
          message: "この注文はレビュー依頼の対象ではありません（既に送信済み、または期限切れ）",
        }
        return reviewRequest
      }

      console.log(`[DEBUG] Order ${order.amazonOrderId} is eligible, proceeding to send request`)
      
      // Solicitations APIでレビュー依頼送信
      const result = await this.sendSolicitationRequest(order)
      
      console.log(`[DEBUG] Solicitation request result for ${order.amazonOrderId}:`, {
        success: result.success,
        error: result.error
      })
      
      const reviewRequest: ReviewRequest = {
        orderId: order.id,
        customerEmail,
        customerName: order.customer.name || order.customer.buyerInfo?.buyerName,
        items: order.items,
        requestedAt: new Date().toISOString(),
        status: result.success ? "sent" : "failed",
        message: result.error || "Amazon経由でレビュー依頼を送信しました",
      }

      // 注文のレビュー依頼状態を更新
      if (result.success) {
        console.log(`[DEBUG] Updating cache for successful request: ${order.amazonOrderId}`)
        const updatedOrder = {
          ...order,
          reviewRequestSent: true,
          reviewRequestSentAt: reviewRequest.requestedAt,
          reviewRequestStatus: reviewRequest.status,
        }

        // キャッシュ更新
        cacheService.updateOrderInCache(updatedOrder)
      } else {
        console.error(`[DEBUG] Review request failed for ${order.amazonOrderId}: ${result.error}`)
      }

      return reviewRequest
    } catch (error) {
      console.error(`[DEBUG] Exception in sendReviewRequest for ${order.amazonOrderId}:`, error)
      if (error instanceof Error) {
        console.error('[DEBUG] Exception details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })
      }
      
      const reviewRequest: ReviewRequest = {
        orderId: order.id,
        customerEmail,
        customerName: order.customer.name || order.customer.buyerInfo?.buyerName,
        items: order.items,
        requestedAt: new Date().toISOString(),
        status: "failed",
        message: error instanceof Error ? error.message : "未知のエラー",
      }

      return reviewRequest
    }
  }

  // 複数注文の一斉レビュー依頼送信
  async sendBatchReviewRequests(orders: Order[]): Promise<ReviewRequestBatch> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const batch: ReviewRequestBatch = {
      id: batchId,
      orders: orders,
      requestedAt: new Date().toISOString(),
      totalCount: orders.length,
      sentCount: 0,
      failedCount: 0,
      status: "processing",
    }

    // Solicitations APIはレート制限があるため、順次処理（毎秒1リクエスト）
    for (const order of orders) {
      try {
        const result = await this.sendReviewRequest(order)
        
        if (result.status === "sent") {
          batch.sentCount++
        } else {
          batch.failedCount++
        }

        // 進捗をログ出力
        console.log(`Batch progress: ${batch.sentCount + batch.failedCount}/${batch.totalCount}`)
        
        // レート制限対応：1秒待機（Solicitations APIは毎秒1リクエスト制限）
        if (batch.sentCount + batch.failedCount < batch.totalCount) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        batch.failedCount++
        console.error(`Failed to send review request for order ${order.id}:`, error)
      }
    }

    batch.status = batch.failedCount === 0 ? "completed" : "partial"
    
    return batch
  }
}

export const reviewService = new ReviewService()