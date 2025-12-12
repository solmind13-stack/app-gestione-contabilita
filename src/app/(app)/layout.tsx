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

  // During loading, we show a skeleton to avoid flickering.
  if (isUserLoading) {
    return <DashboardLoading />;
  }

  // If the user has a role, they are authorized and can see the content.
  if (user?.role) {
    return (
      <SidebarProvider>
          <div className={cn("min-h-screen w-full bg-background text-foreground flex")}>
              <AppSidebar />
              <div className="flex flex-col flex-1">
                  <AppHeader />
                  <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                      {children}
                  </main>
              </div>
              <FloatingChatButton />
          </div>
      </SidebarProvider>
    );
  }

  // If loading is finished but the user is not valid, we show nothing
  // while useEffect handles the redirection.
  return null;
}
