// src/components/layout/app-header.tsx
'use client';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserNav } from "@/components/layout/user-nav";
import { Notifications } from "./notifications";
import { Breadcrumbs } from "./breadcrumbs";
import { useFilter } from "@/context/filter-context";
import { COMPANIES } from "@/lib/constants";

export function AppHeader() {
  const { selectedCompany, setSelectedCompany } = useFilter();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumbs />
      <div className="relative ml-auto flex items-center gap-2 md:grow-0">
        {/* The company selector can be added back if needed */}
      </div>
      <div className="flex items-center gap-2">
        <Notifications />
        <UserNav />
      </div>
    </header>
  );
}
