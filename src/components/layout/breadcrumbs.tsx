// src/components/layout/breadcrumbs.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import type { NavItem } from "@/lib/types";
import React from "react";

// Function to find a navigation item by its href
const findNavItem = (path: string, navItems: NavItem[]): NavItem | undefined => {
  for (const item of navItems) {
    if (item.href === path) {
      return item;
    }
    if (item.subItems) {
      const subItem = findNavItem(path, item.subItems as NavItem[]);
      if (subItem) {
        return subItem;
      }
    }
  }
  return undefined;
};


export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }
  
  const breadcrumbItems = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const navItem = findNavItem(href, NAV_ITEMS);
    return {
      label: navItem?.label || segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      href: href,
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center text-sm font-medium text-muted-foreground">
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.href}>
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          <Link
            href={item.href}
            className={cn(
              "hover:text-foreground",
              item.isLast && "text-foreground"
            )}
            aria-current={item.isLast ? "page" : undefined}
          >
            {item.label}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
}
