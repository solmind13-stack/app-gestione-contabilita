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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutGrid,
  ArrowRightLeft,
  CalendarDays,
  TrendingUp,
  FilePieChart,
  Sparkles,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/lib/constants";
import type { NavItem } from "@/lib/types";
import { useUser } from "@/firebase";

const ICONS: { [key: string]: React.ElementType } = {
  LayoutGrid,
  ArrowRightLeft,
  CalendarDays,
  TrendingUp,
  FilePieChart,
  Sparkles,
  Settings,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const renderNavItem = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const isActive = pathname === item.href || (item.subItems && pathname.startsWith(item.href));

    if (item.subItems) {
      return (
        <Collapsible key={item.href} defaultOpen={isActive}>
          <SidebarMenuItem>
             <CollapsibleTrigger
              className={cn(
                "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 justify-between h-8"
              )}
              data-active={isActive}
            >
              <div className="flex items-center gap-2">
                  <Icon />
                  <span>{item.label}</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </SidebarMenuItem>
          <CollapsibleContent>
            <SidebarMenu>
              {item.subItems.map(subItem => (
                <SidebarMenuItem key={subItem.href}>
                  <Link href={subItem.href}>
                    <SidebarMenuButton variant="ghost" className="h-8 justify-start" isActive={pathname === subItem.href}>
                        <span className="ml-6">{subItem.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      );
    }

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
