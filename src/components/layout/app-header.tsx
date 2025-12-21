// src/components/layout/app-header.tsx
'use client';
import { useState, useEffect } from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { Notifications } from "./notifications";
import { Breadcrumbs } from "./breadcrumbs";

export function AppHeader() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumbs />
      <div className="relative ml-auto flex items-center gap-2 md:grow-0">
        {/* Year/Company filters were here, now moved to individual pages for local control */}
      </div>
      <div className="flex items-center gap-2">
        {isClient && (
          <>
            <Notifications />
            <UserNav />
          </>
        )}
      </div>
    </header>
  );
}
