import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Eye, Package, Download } from "lucide-react"

const ordersData = [
  {
    id: "112-1234567-1234567",
    date: "2024年1月15日",
    customer: "田中太郎",
    amount: 12800,
    status: "発送済み",
    items: 2,
    fulfillmentChannel: "FBA"
  },
  {
    id: "112-1234567-1234568",
    date: "2024年1月14日",
    customer: "佐藤花子",
    amount: 8900,
    status: "処理中",
    items: 1,
    fulfillmentChannel: "FBM"
  },
  {
    id: "112-1234567-1234569",
    date: "2024年1月13日",
    customer: "鈴木次郎",
    amount: 15600,
    status: "配送中",
    items: 3,
    fulfillmentChannel: "FBA"
  },
  {
    id: "112-1234567-1234570",
    date: "2024年1月12日",
    customer: "山田三郎",
    amount: 9200,
    status: "完了",
    items: 1,
    fulfillmentChannel: "FBA"
  },
  {
    id: "112-1234567-1234571",
    date: "2024年1月11日",
    customer: "高橋四郎",
    amount: 21500,
    status: "完了",
    items: 4,
    fulfillmentChannel: "FBM"
  }
]

function getStatusColor(status: string) {
  switch (status) {
    case "完了":
      return "bg-green-100 text-green-800"
    case "発送済み":
      return "bg-blue-100 text-blue-800"
    case "配送中":
      return "bg-yellow-100 text-yellow-800"
    case "処理中":
      return "bg-orange-100 text-orange-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function OrdersPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">注文管理</h1>
            <p className="text-muted-foreground">
              Amazon注文の一覧と詳細
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              エクスポート
            </Button>
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              更新
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今月の注文数</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">156</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+12.5%</span> 前月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今月の売上</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥1,234,567</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+8.2%</span> 前月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均注文金額</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
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
              <CardTitle className="text-sm font-medium">処理中注文</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">
                要処理の注文
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>注文一覧</CardTitle>
            <CardDescription>
              直近の注文履歴
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>注文ID</TableHead>
                  <TableHead>注文日</TableHead>
                  <TableHead>顧客名</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>商品数</TableHead>
                  <TableHead>配送方法</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersData.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      {order.id}
                    </TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>¥{order.amount.toLocaleString()}</TableCell>
                    <TableCell>{order.items}個</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {order.fulfillmentChannel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                        詳細
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}