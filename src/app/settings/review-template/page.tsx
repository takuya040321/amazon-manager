"use client"

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Save, RotateCcw, Eye, AlertCircle, Check, Package } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ReviewTemplate {
  subject: string
  greeting: string
  mainMessage: string
  callToAction: string
  footer: string
}

interface TemplateResponse {
  success: boolean
  template: ReviewTemplate
  defaultTemplate: ReviewTemplate
  variables: Record<string, string>
  preview?: ReviewTemplate
  error?: string
  message?: string
}

export default function ReviewTemplatePage() {
  const [template, setTemplate] = useState<ReviewTemplate>({
    subject: "",
    greeting: "",
    mainMessage: "",
    callToAction: "",
    footer: "",
  })
  
  const [defaultTemplate, setDefaultTemplate] = useState<ReviewTemplate | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<ReviewTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)

  // テンプレートを取得
  const fetchTemplate = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/settings/review-template")
      const data: TemplateResponse = await response.json()
      
      if (data.success) {
        setTemplate(data.template)
        setDefaultTemplate(data.defaultTemplate)
        setVariables(data.variables || {})
      } else {
        setMessage({ type: "error", text: data.error || "テンプレートの取得に失敗しました" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "API接続エラーが発生しました" })
    } finally {
      setIsLoading(false)
    }
  }

  // テンプレートを保存
  const saveTemplate = async () => {
    try {
      setIsSaving(true)
      const response = await fetch("/api/settings/review-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template })
      })
      
      const data: TemplateResponse = await response.json()
      
      if (data.success) {
        setMessage({ type: "success", text: data.message || "テンプレートを保存しました" })
        if (data.preview) {
          setPreview(data.preview)
        }
      } else {
        setMessage({ type: "error", text: data.error || "保存に失敗しました" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "保存中にエラーが発生しました" })
    } finally {
      setIsSaving(false)
    }
  }

  // デフォルトにリセット
  const resetToDefault = async () => {
    if (!confirm("テンプレートをデフォルトに戻しますか？現在の設定は失われます。")) {
      return
    }
    
    try {
      setIsSaving(true)
      const response = await fetch("/api/settings/review-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
      })
      
      const data: TemplateResponse = await response.json()
      
      if (data.success) {
        setTemplate(data.template)
        setPreview(null)
        setMessage({ type: "success", text: data.message || "デフォルトテンプレートに戻しました" })
      } else {
        setMessage({ type: "error", text: data.error || "リセットに失敗しました" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "リセット中にエラーが発生しました" })
    } finally {
      setIsSaving(false)
    }
  }

  // プレビュー生成
  const generatePreview = () => {
    const sampleData = {
      orderNumber: "503-1234567-1234567",
      customerName: "田中太郎",
      purchaseDate: "2024年1月15日",
      itemCount: "2点"
    }

    const previewData = {
      subject: template.subject
        .replace(/\{\{orderNumber\}\}/g, sampleData.orderNumber)
        .replace(/\{\{customerName\}\}/g, sampleData.customerName)
        .replace(/\{\{purchaseDate\}\}/g, sampleData.purchaseDate)
        .replace(/\{\{itemCount\}\}/g, sampleData.itemCount),
      greeting: template.greeting,
      mainMessage: template.mainMessage
        .replace(/\{\{orderNumber\}\}/g, sampleData.orderNumber)
        .replace(/\{\{customerName\}\}/g, sampleData.customerName)
        .replace(/\{\{purchaseDate\}\}/g, sampleData.purchaseDate)
        .replace(/\{\{itemCount\}\}/g, sampleData.itemCount),
      callToAction: template.callToAction,
      footer: template.footer
    }

    setPreview(previewData)
  }

  useEffect(() => {
    fetchTemplate()
  }, [])

  useEffect(() => {
    // 入力値が変更されたら3秒後に自動プレビュー更新
    const timer = setTimeout(() => {
      if (template.subject || template.greeting || template.mainMessage) {
        generatePreview()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [template])

  const handleInputChange = (field: keyof ReviewTemplate, value: string) => {
    setTemplate(prev => ({ ...prev, [field]: value }))
    setMessage(null) // メッセージをクリア
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">テンプレートを読み込み中...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">レビュー依頼メールテンプレート設定</h1>
            <p className="text-muted-foreground">
              Amazon注文のレビュー依頼メールの文言をカスタマイズできます
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={resetToDefault} 
              disabled={isSaving}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              デフォルトに戻す
            </Button>
            <Button 
              onClick={saveTemplate} 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        {message && (
          <Alert className={message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            {message.type === "success" ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 設定フォーム */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>メールテンプレート編集</CardTitle>
                <CardDescription>
                  各項目をカスタマイズして、独自のレビュー依頼メールを作成できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subject">件名</Label>
                  <Input
                    id="subject"
                    value={template.subject}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                    placeholder="【レビューのお願い】{{orderNumber}} - ご購入商品のレビューをお願いいたします"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="greeting">挨拶文</Label>
                  <Textarea
                    id="greeting"
                    value={template.greeting}
                    onChange={(e) => handleInputChange("greeting", e.target.value)}
                    placeholder="いつもご利用いただき、ありがとうございます。"
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="mainMessage">メインメッセージ</Label>
                  <Textarea
                    id="mainMessage"
                    value={template.mainMessage}
                    onChange={(e) => handleInputChange("mainMessage", e.target.value)}
                    placeholder="{{customerName}}様にご購入いただいた商品はいかがでしたでしょうか？"
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="callToAction">行動喚起文</Label>
                  <Textarea
                    id="callToAction"
                    value={template.callToAction}
                    onChange={(e) => handleInputChange("callToAction", e.target.value)}
                    placeholder="お時間があるときに、ぜひ商品のレビューをお書きいただけますでしょうか？"
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="footer">フッター</Label>
                  <Textarea
                    id="footer"
                    value={template.footer}
                    onChange={(e) => handleInputChange("footer", e.target.value)}
                    placeholder="今後このようなメールを希望されない場合は、お手数ですがご連絡ください。"
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* レビューURL機能の説明 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">✨ 新機能: 直接レビューリンク</CardTitle>
                <CardDescription>
                  メール内に各商品の個別レビューページへの直接リンクが自動で追加されます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <strong className="text-blue-800">各商品に個別リンク</strong>
                      <p className="text-sm text-blue-700 mt-1">
                        ASIN情報を使用して、お客様が1クリックで商品レビュー投稿画面に移動できます
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <strong className="text-green-800">注文履歴リンク</strong>
                      <p className="text-sm text-green-700 mt-1">
                        メール下部に注文履歴ページへのリンクも追加されます
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  これらのリンクは自動生成されるため、テンプレート設定は不要です
                </div>
              </CardContent>
            </Card>

            {/* 利用可能な変数 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">利用可能な変数</CardTitle>
                <CardDescription>
                  以下の変数をテンプレート内で使用できます（自動で実際の値に置換されます）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {Object.entries(variables).map(([variable, description]) => (
                    <div key={variable} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {variable}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* プレビュー */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      メールプレビュー
                    </CardTitle>
                    <CardDescription>
                      実際に送信されるメールのプレビューです
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generatePreview}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    更新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {preview ? (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">件名</Label>
                      <div className="mt-1 p-2 bg-white border rounded text-sm">
                        {preview.subject}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">本文</Label>
                      <div className="mt-1 p-4 bg-white border rounded space-y-3 text-sm">
                        <p>{preview.greeting}</p>
                        <p>{preview.mainMessage}</p>
                        
                        <div className="bg-orange-50 p-3 border-l-4 border-orange-200 rounded">
                          <strong className="text-orange-800">ご注文内容</strong>
                          <div className="mt-2 text-sm text-gray-700">
                            <div><strong>注文番号:</strong> 503-1234567-1234567</div>
                            <div><strong>注文日:</strong> 2024年1月15日</div>
                            <div><strong>商品:</strong></div>
                            <div className="ml-4 mt-2 p-3 bg-white border rounded">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 bg-gray-200 rounded border flex items-center justify-center">
                                  <Package className="h-6 w-6 text-gray-400" />
                                </div>
                                <div className="flex-grow">
                                  <div className="font-medium">VTコスメティックス シカスキン</div>
                                  <div className="text-gray-600 text-sm">数量: 1個</div>
                                  <div className="text-orange-600 font-bold text-sm">¥2,480</div>
                                  <div className="mt-2">
                                    <span className="inline-block bg-orange-500 text-white px-3 py-1 rounded text-xs">
                                      この商品のレビューを書く
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p>{preview.callToAction}</p>
                        <p className="text-orange-600">お客様の貴重なご意見は、他のお客様の参考になり、私たちの商品改善にも大変役立ちます。</p>
                        
                        <div className="text-center">
                          <div className="inline-block bg-orange-500 text-white px-6 py-2 rounded">
                            注文履歴でレビューを書く
                          </div>
                        </div>

                        <hr className="my-4" />
                        <p className="text-xs text-gray-500">{preview.footer}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>プレビューを表示するには「更新」ボタンを押してください</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}