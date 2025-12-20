// src/app/(app)/layout.tsx
'use client';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { FloatingChatButton } from '@/components/layout/floating-chat-button';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLoading from './dashboard/loading';
import { FilterProvider } from '@/context/filter-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // When loading is finished, if there is no user or the user has no role,
    // it means they are not authorized, so we redirect them to the login page.
    if (!isUserLoading && !user?.role) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // If loading is finished but the user is not valid, we show the loading skeleton
  // while useEffect handles the redirection. This prevents rendering a blank page.
  if (!isUserLoading && !user?.role) {
    return <DashboardLoading />;
  }
  
  // Render the full app layout, but conditionally show the loading skeleton
  // or the actual page content based on the user loading state.
  // This ensures the main layout structure is consistent between server and client.
  return (
    <FilterProvider>
      <SidebarProvider>
          <div className={cn("min-h-screen w-full bg-background text-foreground flex")}>
              <AppSidebar />
              <div className="flex flex-col flex-1">
                  <AppHeader />
                  <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                      {isUserLoading ? <DashboardLoading /> : children}
                  </main>
              </div>
              <FloatingChatButton />
          </div>
      </SidebarProvider>
    </FilterProvider>
  );
}
