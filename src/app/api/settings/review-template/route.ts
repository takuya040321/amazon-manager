import { NextRequest, NextResponse } from "next/server"

// レビューテンプレートのデフォルト設定
const DEFAULT_TEMPLATE = {
  subject: "【レビューのお願い】{{orderNumber}} - ご購入商品のレビューをお願いいたします",
  greeting: "いつもご利用いただき、ありがとうございます。",
  mainMessage: "{{customerName}}様にご購入いただいた商品はいかがでしたでしょうか？",
  callToAction: "お時間があるときに、ぜひ商品のレビューをお書きいただけますでしょうか？",
  footer: "今後このようなメールを希望されない場合は、お手数ですがご連絡ください。"
}

// メモリ上でテンプレートを保存（実際の実装では、データベースやファイルに保存）
let currentTemplate = { ...DEFAULT_TEMPLATE }

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      template: currentTemplate,
      defaultTemplate: DEFAULT_TEMPLATE,
      variables: {
        "{{orderNumber}}": "注文番号（例: 503-1234567-1234567）",
        "{{customerName}}": "顧客名（例: 田中太郎、または「お客様」）",
        "{{purchaseDate}}": "購入日（例: 2024年1月15日）",
        "{{itemCount}}": "商品数（例: 3点）"
      },
      usage: {
        endpoint: "POST /api/orders/review-request",
        body: {
          orderIds: ["注文IDの配列"],
          type: "batch",
          customTemplate: {
            subject: "カスタム件名（任意）",
            greeting: "カスタム挨拶文（任意）",
            mainMessage: "カスタムメインメッセージ（任意）",
            callToAction: "カスタム行動喚起（任意）",
            footer: "カスタムフッター（任意）"
          }
        }
      }
    })
  } catch (error) {
    console.error("Get review template error:", error)
    return NextResponse.json(
      { 
        error: "レビューテンプレートの取得に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template, action = "update" } = body

    if (action === "reset") {
      // デフォルトにリセット
      currentTemplate = { ...DEFAULT_TEMPLATE }
      return NextResponse.json({
        success: true,
        message: "テンプレートをデフォルトにリセットしました",
        template: currentTemplate
      })
    }

    if (!template || typeof template !== "object") {
      return NextResponse.json(
        { error: "有効なテンプレートオブジェクトを指定してください" },
        { status: 400 }
      )
    }

    // 部分的な更新をサポート
    if (template.subject !== undefined) currentTemplate.subject = template.subject
    if (template.greeting !== undefined) currentTemplate.greeting = template.greeting
    if (template.mainMessage !== undefined) currentTemplate.mainMessage = template.mainMessage
    if (template.callToAction !== undefined) currentTemplate.callToAction = template.callToAction
    if (template.footer !== undefined) currentTemplate.footer = template.footer

    return NextResponse.json({
      success: true,
      message: "レビューテンプレートを更新しました",
      template: currentTemplate,
      preview: generatePreview(currentTemplate)
    })

  } catch (error) {
    console.error("Update review template error:", error)
    return NextResponse.json(
      { 
        error: "レビューテンプレートの更新に失敗しました", 
        details: error instanceof Error ? error.message : "未知のエラー" 
      },
      { status: 500 }
    )
  }
}

// プレビュー生成関数
function generatePreview(template: any) {
  const sampleData = {
    orderNumber: "503-1234567-1234567",
    customerName: "田中太郎",
    purchaseDate: "2024年1月15日",
    itemCount: "2点"
  }

  return {
    subject: template.subject
      .replace("{{orderNumber}}", sampleData.orderNumber)
      .replace("{{customerName}}", sampleData.customerName)
      .replace("{{purchaseDate}}", sampleData.purchaseDate)
      .replace("{{itemCount}}", sampleData.itemCount),
    greeting: template.greeting,
    mainMessage: template.mainMessage
      .replace("{{customerName}}", sampleData.customerName)
      .replace("{{orderNumber}}", sampleData.orderNumber)
      .replace("{{purchaseDate}}", sampleData.purchaseDate)
      .replace("{{itemCount}}", sampleData.itemCount),
    callToAction: template.callToAction,
    footer: template.footer
  }
}