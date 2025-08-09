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
import { RefreshCw, Eye, Edit, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import Image from "next/image"

const productsData = [
  {
    asin: "B08N5WRWNW",
    title: "ワイヤレスイヤホン",
    sku: "WH-001",
    price: 8900,
    stock: 25,
    status: "Active",
    sales30Days: 12,
    imageUrl: "/placeholder-product.jpg"
  },
  {
    asin: "B08N5WRWNY",
    title: "スマートウォッチ",
    sku: "SW-001",
    price: 15600,
    stock: 8,
    status: "Active",
    sales30Days: 5,
    imageUrl: "/placeholder-product.jpg"
  },
  {
    asin: "B08N5WRWNZ",
    title: "モバイルバッテリー",
    sku: "MB-001",
    price: 3200,
    stock: 0,
    status: "Inactive",
    sales30Days: 0,
    imageUrl: "/placeholder-product.jpg"
  },
  {
    asin: "B08N5WRWNA",
    title: "スマホケース",
    sku: "SC-001",
    price: 1200,
    stock: 150,
    status: "Active",
    sales30Days: 45,
    imageUrl: "/placeholder-product.jpg"
  },
  {
    asin: "B08N5WRWNB",
    title: "USB充電器",
    sku: "UC-001",
    price: 2800,
    stock: 3,
    status: "Active",
    sales30Days: 8,
    imageUrl: "/placeholder-product.jpg"
  }
]

function getStockStatus(stock: number) {
  if (stock === 0) return { label: "売切れ", color: "bg-red-100 text-red-800", icon: XCircle }
  if (stock <= 5) return { label: "要補充", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle }
  return { label: "在庫あり", color: "bg-green-100 text-green-800", icon: CheckCircle }
}

function getStatusColor(status: string) {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-800"
    case "Inactive":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function ProductsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">商品管理</h1>
            <p className="text-muted-foreground">
              Amazon商品の一覧と在庫管理
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              詳細表示
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
              <CardTitle className="text-sm font-medium">総商品数</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">
                出品中の商品
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">アクティブ商品</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">76</div>
              <p className="text-xs text-muted-foreground">
                販売中
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">要補充商品</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">
                在庫5個以下
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">売切れ商品</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">
                在庫0個
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>商品一覧</CardTitle>
            <CardDescription>
              全商品の在庫と販売状況
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品画像</TableHead>
                  <TableHead>商品名</TableHead>
                  <TableHead>ASIN/SKU</TableHead>
                  <TableHead>価格</TableHead>
                  <TableHead>在庫</TableHead>
                  <TableHead>30日販売数</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>在庫状況</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsData.map((product) => {
                  const stockStatus = getStockStatus(product.stock)
                  const StatusIcon = stockStatus.icon
                  return (
                    <TableRow key={product.asin}>
                      <TableCell>
                        <div className="h-12 w-12 relative bg-gray-100 rounded-md flex items-center justify-center">
                          <div className="text-xs text-gray-500">画像</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {product.title}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-xs">{product.asin}</div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>¥{product.price.toLocaleString()}</TableCell>
                      <TableCell>{product.stock}個</TableCell>
                      <TableCell>{product.sales30Days}個</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(product.status)}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={stockStatus.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}