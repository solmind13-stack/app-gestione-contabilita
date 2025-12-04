import { SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserNav } from "@/components/layout/user-nav";
import { Notifications } from "./notifications";
import { Breadcrumbs } from "./breadcrumbs";
import { YEARS, COMPANIES } from "@/lib/constants";
import { Logo } from "../logo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumbs />
      <div className="relative ml-auto flex items-center gap-2 md:grow-0">
         <Select defaultValue="all">
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Società" />
            </SelectTrigger>
            <SelectContent>
                {COMPANIES.map(company => (
                    <SelectItem key={company.value} value={company.value}>{company.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Select defaultValue="2024">
            <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Anno" />
            </SelectTrigger>
            <SelectContent>
                {YEARS.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Notifications />
        <UserNav />
      </div>
    </header>
  );
}
