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
    // Quando il caricamento finisce, se non c'è utente o non ha un ruolo,
    // significa che non è autorizzato, quindi lo rimandiamo al login.
    if (!isUserLoading && !user?.role) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Durante il caricamento, mostriamo uno scheletro per evitare sfarfallii.
  if (isUserLoading) {
    return <DashboardLoading />;
  }

  // Se l'utente ha un ruolo, allora è autorizzato e può vedere il contenuto.
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

  // Se il caricamento è finito ma l'utente non è valido, non mostriamo nulla
  // mentre l'useEffect esegue il reindirizzamento.
  return null;
}
