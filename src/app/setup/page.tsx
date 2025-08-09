"use client"

import { useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, Copy } from "lucide-react"

interface TestResult {
  success: boolean
  mode?: "mock" | "live"
  message: string
  config?: any
  data?: any
  error?: string
  troubleshooting?: string
  timestamp?: string
}

export default function SetupPage() {
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runConnectionTest = async () => {
    setIsLoading(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/sp-api/test")
      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: "テスト実行中にエラーが発生しました",
        error: error instanceof Error ? error.message : "未知のエラー"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkMarketplaceInfo = async () => {
    try {
      const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || "A1VC38T7YXB528"
      const response = await fetch(`/api/sp-api/marketplace?id=${marketplaceId}`)
      const result = await response.json()
      
      if (result.success) {
        alert(`マーケットプレイス情報:
${result.name} (${result.country})
ID: ${result.marketplaceId}
地域: ${result.region}
通貨: ${result.currency}

現在の設定:
Region: ${result.currentConfig.configuredRegion}
Marketplace: ${result.currentConfig.configuredMarketplace}
設定正確性: ${result.currentConfig.isCorrectConfiguration ? "✓正しい" : "✗要確認"}`)
      }
    } catch (error) {
      alert("マーケットプレイス情報の取得に失敗しました")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SP-API設定</h1>
          <p className="text-muted-foreground">
            Amazon SP-APIの認証設定と接続テスト
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>設定手順</CardTitle>
            <CardDescription>
              SP-APIを使用するために必要な設定手順
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Amazon Developer Console でアプリケーション登録</h4>
                  <p className="text-sm text-muted-foreground">
                    Login with Amazon セキュリティプロファイルを作成し、Client IDとClient Secretを取得
                  </p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Developer Console
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Seller Central でアプリケーション承認</h4>
                  <p className="text-sm text-muted-foreground">
                    作成したアプリケーションをSeller Centralで承認し、Refresh Tokenを取得
                  </p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Seller Central
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Marketplace ID の確認</h4>
                  <p className="text-sm text-muted-foreground">
                    Seller Centralで正確なMarketplace IDを確認
                  </p>
                  <div className="mt-2 space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={checkMarketplaceInfo}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      現在のMarketplace設定を確認
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Seller Central: 設定 → アカウント情報 → ビジネス情報 → Amazon マーケットプレイス Web サービス
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  4
                </div>
                <div>
                  <h4 className="font-medium">環境変数の設定</h4>
                  <p className="text-sm text-muted-foreground">
                    取得した認証情報を.env.localファイルに設定
                  </p>
                  <div className="mt-2 p-3 bg-gray-100 rounded-md font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span>AMAZON_REFRESH_TOKEN=Atzr|IwEBIA...</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard("AMAZON_REFRESH_TOKEN=")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>AMAZON_CLIENT_ID=amzn1.application...</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard("AMAZON_CLIENT_ID=")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>AMAZON_CLIENT_SECRET=your_secret</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard("AMAZON_CLIENT_SECRET=")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>AMAZON_REGION=us-west-2 # 日本の場合</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard("AMAZON_REGION=us-west-2")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>AMAZON_MARKETPLACE_ID=A1VC38T7YXB528</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard("AMAZON_MARKETPLACE_ID=A1VC38T7YXB528")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>接続テスト</CardTitle>
            <CardDescription>
              SP-API認証設定の動作確認
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={runConnectionTest}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "テスト実行中..." : "接続テストを実行"}
              </Button>

              {testResult && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className={testResult.success ? "text-green-600" : "text-red-600"}>
                          {testResult.message}
                        </span>
                        {testResult.mode && (
                          <Badge variant={testResult.mode === "live" ? "default" : "secondary"}>
                            {testResult.mode === "live" ? "本番API" : "モック"}
                          </Badge>
                        )}
                      </div>

                      {testResult.success && testResult.data && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">取得注文数:</span> {testResult.data.ordersCount}件
                          </div>
                          <div>
                            <span className="font-medium">最終更新:</span> {new Date(testResult.data.lastUpdated).toLocaleString("ja-JP")}
                          </div>
                          {testResult.data.sampleOrder && (
                            <div className="col-span-2">
                              <span className="font-medium">サンプル注文:</span>
                              <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                                ID: {testResult.data.sampleOrder.id}<br />
                                日時: {new Date(testResult.data.sampleOrder.date).toLocaleString("ja-JP")}<br />
                                ステータス: {testResult.data.sampleOrder.status}<br />
                                金額: ¥{testResult.data.sampleOrder.amount?.toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!testResult.success && testResult.troubleshooting && (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                            <div>
                              <div className="font-medium text-orange-800">トラブルシューティング</div>
                              <div className="text-sm text-orange-700">{testResult.troubleshooting}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {testResult.config && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium">設定詳細</summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                            {JSON.stringify(testResult.config, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>参考リンク</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Button variant="outline" className="justify-start">
                <ExternalLink className="mr-2 h-4 w-4" />
                SP-API設定ガイド (docs/sp-api-setup.md)
              </Button>
              <Button variant="outline" className="justify-start">
                <ExternalLink className="mr-2 h-4 w-4" />
                Amazon SP-API Developer Guide
              </Button>
              <Button variant="outline" className="justify-start">
                <ExternalLink className="mr-2 h-4 w-4" />
                Login with Amazon Developer Guide
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}