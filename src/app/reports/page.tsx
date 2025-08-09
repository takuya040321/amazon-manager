import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, TrendingUp, TrendingDown } from "lucide-react"

const salesData = [
  { month: "2024年1月", sales: 1234567, orders: 156, growth: 12.5 },
  { month: "2023年12月", sales: 1098234, orders: 139, growth: 8.3 },
  { month: "2023年11月", sales: 1015678, orders: 128, growth: -2.1 },
  { month: "2023年10月", sales: 1037890, orders: 131, growth: 15.7 },
  { month: "2023年9月", sales: 897654, orders: 113, growth: 5.4 },
  { month: "2023年8月", sales: 851234, orders: 107, growth: -1.8 }
]

const topProducts = [
  { name: "スマホケース", sales: 245670, orders: 45, asin: "B08N5WRWNA" },
  { name: "ワイヤレスイヤホン", sales: 156780, orders: 18, asin: "B08N5WRWNW" },
  { name: "モバイルバッテリー", sales: 123450, orders: 38, asin: "B08N5WRWNZ" },
  { name: "USB充電器", sales: 89120, orders: 32, asin: "B08N5WRWNB" },
  { name: "スマートウォッチ", sales: 78000, orders: 5, asin: "B08N5WRWNY" }
]

export default function ReportsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">レポート</h1>
            <p className="text-muted-foreground">
              売上分析とパフォーマンス指標
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              レポート出力
            </Button>
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              更新
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今月売上</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥1,234,567</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+12.5%</span> 前月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均注文金額</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥7,915</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-red-600">-2.1%</span> 前月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">転換率</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8.7%</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+1.2%</span> 前月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">利益率</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23.4%</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-red-600">-1.2%</span> 前月比
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>月別売上推移</CardTitle>
              <CardDescription>
                過去6ヶ月の売上とトレンド
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salesData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{data.month}</p>
                      <p className="text-xs text-muted-foreground">
                        {data.orders}件の注文
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium">
                        ¥{data.sales.toLocaleString()}
                      </p>
                      <p className={`text-xs ${data.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.growth > 0 ? '+' : ''}{data.growth}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>売上上位商品</CardTitle>
              <CardDescription>
                今月のベストセラー商品
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {product.asin} • {product.orders}件
                      </p>
                    </div>
                    <div className="text-sm font-medium">
                      ¥{product.sales.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>詳細レポート</CardTitle>
            <CardDescription>
              追加のレポートと分析ツール
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button variant="outline" className="h-20 flex-col">
                <TrendingUp className="mb-2 h-5 w-5" />
                売上詳細レポート
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <Download className="mb-2 h-5 w-5" />
                在庫レポート
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <RefreshCw className="mb-2 h-5 w-5" />
                キャッシュフローレポート
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}