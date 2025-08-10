"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Home, Package, ShoppingCart, BarChart3, Settings, Mail } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  {
    title: "ダッシュボード",
    url: "/",
    icon: Home,
  },
  {
    title: "注文管理",
    url: "/orders",
    icon: ShoppingCart,
  },
  {
    title: "商品管理",
    url: "/products",
    icon: Package,
  },
  {
    title: "レポート",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "SP-API設定",
    url: "/setup",
    icon: Settings,
  },
  {
    title: "レビューテンプレート設定",
    url: "/settings/review-template",
    icon: Mail,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  
  return (
    <Sidebar>
      <SidebarHeader>
        <h2 className="text-lg font-semibold px-4 py-2">Amazon Manager</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={pathname === item.url}>
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}