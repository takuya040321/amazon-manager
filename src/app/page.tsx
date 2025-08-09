import { MainLayout } from "@/components/layout/main-layout"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Package, ShoppingCart, TrendingUp, RefreshCw } from "lucide-react"

export default function Dashboard() {
  const statsData = [
    {
      title: "総売上",
      value: "¥1,234,567",
      description: "今月の売上",
      icon: DollarSign,
      trend: { value: 12.5, isPositive: true }
    },
    {
      title: "注文数",
      value: "156",
      description: "今月の注文",
      icon: ShoppingCart,
      trend: { value: 8.2, isPositive: true }
    },
    {
      title: "商品数",
      value: "89",
      description: "出品中の商品",
      icon: Package,
      trend: { value: 2.1, isPositive: true }
    },
    {
      title: "利益率",
      value: "23.4%",
      description: "平均利益率",
      icon: TrendingUp,
      trend: { value: -1.2, isPositive: false }
    }
  ]

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
            <p className="text-muted-foreground">
              Amazon販売データの概要
            </p>
          </div>
          <Button>
            <RefreshCw className="mr-2 h-4 w-4" />
            データを更新
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>最近の注文</CardTitle>
              <CardDescription>
                直近の注文状況
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">注文 #12345</p>
                    <p className="text-xs text-muted-foreground">2024年1月15日</p>
                  </div>
                  <div className="text-sm font-medium">¥12,800</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">注文 #12344</p>
                    <p className="text-xs text-muted-foreground">2024年1月14日</p>
                  </div>
                  <div className="text-sm font-medium">¥8,900</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">注文 #12343</p>
                    <p className="text-xs text-muted-foreground">2024年1月13日</p>
                  </div>
                  <div className="text-sm font-medium">¥15,600</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>在庫アラート</CardTitle>
              <CardDescription>
                在庫切れ・少量商品
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">商品A</p>
                    <p className="text-xs text-muted-foreground">在庫: 2個</p>
                  </div>
                  <div className="text-xs text-red-600 font-medium">要補充</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">商品B</p>
                    <p className="text-xs text-muted-foreground">在庫: 0個</p>
                  </div>
                  <div className="text-xs text-red-600 font-medium">売切れ</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">商品C</p>
                    <p className="text-xs text-muted-foreground">在庫: 5個</p>
                  </div>
                  <div className="text-xs text-yellow-600 font-medium">注意</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}
