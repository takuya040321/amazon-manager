import { Order, ReviewRequest, ReviewRequestBatch } from "@/types/order"
import { cacheService } from "./cache"

// Amazon商品レビューURLを生成するヘルパー関数
function generateAmazonReviewUrl(asin: string, marketplaceId: string = "A1VC38T7YXB528"): string {
  if (!asin) return "https://www.amazon.co.jp/your-orders"
  
  // 日本のAmazon商品レビュー投稿URL
  return `https://www.amazon.co.jp/review/create-review?ie=UTF8&channel=glance-detail&asin=${asin}`
}

// 複数商品用の注文レビューURL（注文履歴ページ）
function generateOrderReviewUrl(amazonOrderId?: string): string {
  if (amazonOrderId) {
    return `https://www.amazon.co.jp/your-orders`
  }
  return "https://www.amazon.co.jp/your-orders"
}

interface EmailProvider {
  sendEmail(params: {
    to: string
    subject: string
    html: string
    text?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
}

// メール送信プロバイダーの実装例（実際の実装では適切なサービスを使用）
class MockEmailProvider implements EmailProvider {
  async sendEmail(params: {
    to: string
    subject: string
    html: string
    text?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // 実際の実装では、Amazon SES、SendGrid、Resendなどを使用
    console.log("Sending email:", params)
    
    // デモ用のランダム成功/失敗
    const success = Math.random() > 0.1 // 90%の成功率
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success,
          messageId: success ? `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined,
          error: success ? undefined : "メール送信に失敗しました",
        })
      }, 1000 + Math.random() * 2000) // 1-3秒の遅延
    })
  }
}

class ReviewService {
  private emailProvider: EmailProvider

  constructor(emailProvider?: EmailProvider) {
    this.emailProvider = emailProvider || new MockEmailProvider()
  }

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

  // レビュー依頼メールの生成（カスタマイズ対応）
  generateReviewRequestEmail(
    order: Order, 
    customTemplate?: {
      subject?: string;
      greeting?: string;
      mainMessage?: string;
      callToAction?: string;
      footer?: string;
    }
  ): { subject: string; html: string; text: string } {
    const customerName = order.customer.name || order.customer.buyerInfo?.buyerName || "お客様"
    const itemsList = order.items
      .map(item => `• ${item.title} (数量: ${item.quantity})`)
      .join("\n")

    // カスタマイズ可能な文言
    const subject = customTemplate?.subject || 
      `【レビューのお願い】${order.amazonOrderId} - ご購入商品のレビューをお願いいたします`
    
    const greeting = customTemplate?.greeting || 
      "いつもご利用いただき、ありがとうございます。"
    
    const mainMessage = customTemplate?.mainMessage || 
      `${customerName}様にご購入いただいた商品はいかがでしたでしょうか？`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF9900;">レビューのお願い</h2>
        
        <p>${greeting}</p>
        
        <p>${mainMessage}</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #FF9900;">
          <h3 style="margin-top: 0;">ご注文内容</h3>
          <p><strong>注文番号:</strong> ${order.amazonOrderId}</p>
          <p><strong>注文日:</strong> ${new Date(order.purchaseDate).toLocaleDateString("ja-JP")}</p>
          <p><strong>商品:</strong></p>
          <div style="margin-left: 20px;">
            ${order.items.map(item => {
              const reviewUrl = generateAmazonReviewUrl(item.asin)
              return `
              <div style="display: flex; align-items: center; margin: 10px 0; padding: 10px; background-color: #fff; border-radius: 8px; border: 1px solid #ddd;">
                ${item.imageUrl ? `
                  <img src="${item.imageUrl}" alt="${item.title}" 
                       style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 15px;">
                ` : ''}
                <div style="flex-grow: 1;">
                  <strong>${item.title}</strong><br>
                  <span style="color: #666;">数量: ${item.quantity}個</span><br>
                  <span style="color: #FF9900; font-weight: bold;">¥${item.price.toLocaleString()}</span><br>
                  <div style="margin-top: 8px;">
                    <a href="${reviewUrl}" 
                       style="background-color: #FF9900; color: white; padding: 6px 12px; text-decoration: none; border-radius: 3px; font-size: 12px; display: inline-block;">
                      この商品のレビューを書く
                    </a>
                  </div>
                </div>
              </div>
            `}).join("")}
          </div>
        </div>
        
        <p>${customTemplate?.callToAction || "お時間があるときに、ぜひ商品のレビューをお書きいただけますでしょうか？"}</p>
        <p>お客様の貴重なご意見は、他のお客様の参考になり、私たちの商品改善にも大変役立ちます。</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${generateOrderReviewUrl(order.amazonOrderId)}" 
             style="background-color: #FF9900; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            注文履歴でレビューを書く
          </a>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          ※このメールは注文完了後に自動送信されています。<br>
          ※レビューの投稿は任意です。ご無理をなさる必要はありません。
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          ${customTemplate?.footer || "今後このようなメールを希望されない場合は、お手数ですがご連絡ください。"}
        </p>
      </div>
    `

    const text = `
レビューのお願い

${greeting}

${mainMessage}

ご注文内容:
注文番号: ${order.amazonOrderId}
注文日: ${new Date(order.purchaseDate).toLocaleDateString("ja-JP")}
商品:
${order.items.map(item => {
        const reviewUrl = generateAmazonReviewUrl(item.asin)
        return `• ${item.title} (数量: ${item.quantity}) - レビューURL: ${reviewUrl}`
      }).join("\n")}

${customTemplate?.callToAction || "お時間があるときに、ぜひ商品のレビューをお書きいただけますでしょうか？"}
お客様の貴重なご意見は、他のお客様の参考になり、私たちの商品改善にも大変役立ちます。

各商品のレビューは上記のURLから直接投稿できます。
注文履歴からレビューを書くには: ${generateOrderReviewUrl(order.amazonOrderId)}

※このメールは注文完了後に自動送信されています。
※レビューの投稿は任意です。ご無理をなさる必要はありません。
    `

    return { subject, html, text }
  }

  // 単一の注文に対するレビュー依頼送信
  async sendReviewRequest(
    order: Order, 
    customTemplate?: {
      subject?: string;
      greeting?: string;
      mainMessage?: string;
      callToAction?: string;
      footer?: string;
    }
  ): Promise<ReviewRequest> {
    const customerEmail = order.customer.email || order.customer.buyerInfo?.buyerEmail
    if (!customerEmail) {
      throw new Error("顧客のメールアドレスが見つかりません")
    }

    const email = this.generateReviewRequestEmail(order, customTemplate)
    
    try {
      const result = await this.emailProvider.sendEmail({
        to: customerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })

      const reviewRequest: ReviewRequest = {
        orderId: order.id,
        customerEmail,
        customerName: order.customer.name || order.customer.buyerInfo?.buyerName,
        items: order.items,
        requestedAt: new Date().toISOString(),
        status: result.success ? "sent" : "failed",
        message: result.error || result.messageId,
      }

      // 注文のレビュー依頼状態を更新
      const updatedOrder = {
        ...order,
        reviewRequestSent: result.success,
        reviewRequestSentAt: reviewRequest.requestedAt,
        reviewRequestStatus: reviewRequest.status,
      }

      // キャッシュ更新
      cacheService.updateOrderInCache(updatedOrder)

      return reviewRequest
    } catch (error) {
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
  async sendBatchReviewRequests(
    orders: Order[], 
    customTemplate?: {
      subject?: string;
      greeting?: string;
      mainMessage?: string;
      callToAction?: string;
      footer?: string;
    }
  ): Promise<ReviewRequestBatch> {
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

    // 並行処理でレビュー依頼を送信（最大5件同時）
    const batchSize = 5
    for (let i = 0; i < orders.length; i += batchSize) {
      const orderBatch = orders.slice(i, i + batchSize)
      
      const promises = orderBatch.map(order => 
        this.sendReviewRequest(order, customTemplate).catch(error => ({
          orderId: order.id,
          customerEmail: order.customer.email || order.customer.buyerInfo?.buyerEmail || "",
          customerName: order.customer.name || order.customer.buyerInfo?.buyerName,
          items: order.items,
          requestedAt: new Date().toISOString(),
          status: "failed" as const,
          message: error instanceof Error ? error.message : "未知のエラー",
        }))
      )

      const results = await Promise.all(promises)
      
      // 結果を集計
      results.forEach(result => {
        if (result.status === "sent") {
          batch.sentCount++
        } else {
          batch.failedCount++
        }
      })

      // 進捗をログ出力（実際のUIでは進捗表示に使用）
      console.log(`Batch progress: ${batch.sentCount + batch.failedCount}/${batch.totalCount}`)
    }

    batch.status = batch.failedCount === 0 ? "completed" : "failed"
    
    return batch
  }
}

export const reviewService = new ReviewService()