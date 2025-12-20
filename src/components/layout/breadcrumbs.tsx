"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const formatSegment = (segment: string) => {
    if (segment.toLowerCase() === 'dashboard') {
      return 'Dashboard';
    }
    return segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (segments.length === 0) {
    return null;
  }
  
  const isDashboardHome = segments.length === 1 && segments[0] === 'dashboard';

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center text-sm font-medium text-muted-foreground">
      <Link href="/dashboard" className={cn("hover:text-foreground", isDashboardHome && "text-foreground")}>
        {formatSegment('dashboard')}
      </Link>
      {!isDashboardHome && segments.slice(1).map((segment, index) => {
        // Adjust index to account for slicing
        const realIndex = index + 1;
        const href = "/" + segments.slice(0, realIndex + 1).join("/");
        const isLast = realIndex === segments.length - 1;

        return (
          <div key={href} className="flex items-center">
            <ChevronRight className="h-4 w-4 mx-1" />
            <Link
              href={href}
              className={cn(
                "hover:text-foreground",
                isLast && "text-foreground"
              )}
              aria-current={isLast ? "page" : undefined}
            >
              {formatSegment(segment)}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}