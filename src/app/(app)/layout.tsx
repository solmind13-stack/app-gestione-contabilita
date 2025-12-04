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
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) {
    return <DashboardLoading />;
  }

  if (!user) {
    return null;
  }

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
