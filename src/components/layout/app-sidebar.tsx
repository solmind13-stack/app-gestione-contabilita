// src/components/layout/app-sidebar.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutGrid,
  ArrowRightLeft,
  CalendarDays,
  TrendingUp,
  FilePieChart,
  Sparkles,
  Settings,
  ClipboardCheck,
  BrainCircuit,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useUser } from "@/firebase";
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/lib/constants";
import type { NavItem } from "@/lib/types";

const ICONS: { [key: string]: React.ElementType } = {
  LayoutGrid,
  ArrowRightLeft,
  CalendarDays,
  TrendingUp,
  FilePieChart,
  Sparkles,
  Settings,
  ClipboardCheck,
  BrainCircuit,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const renderNavItem = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const isActive = pathname === item.href;

    return (
      <SidebarMenuItem key={item.href}>
        <Link href={item.href}>
          <SidebarMenuButton isActive={isActive} tooltip={item.label}>
            <Icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>{NAV_ITEMS.map(renderNavItem)}</SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
            {user?.role === 'admin' && ADMIN_NAV_ITEMS.map(renderNavItem)}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
