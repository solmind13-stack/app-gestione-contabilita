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
    // Se il caricamento è finito e non c'è nessun utente (o nessun ruolo),
    // l'utente non è autorizzato, quindi reindirizza al login.
    if (!isUserLoading && (!user || !user.role)) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Mostra una schermata di caricamento mentre il provider Firebase determina lo stato dell'utente.
  if (isUserLoading) {
    return <DashboardLoading />;
  }

  // Se dopo il caricamento l'utente non è ancora valido (o non ha un ruolo),
  // non renderizzare nulla per prevenire flash di contenuto protetto.
  // L'useEffect si occuperà del reindirizzamento.
  if (!user || !user.role) {
    return null; 
  }

  // Se l'utente è valido e ha un ruolo, mostra il layout dell'applicazione.
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
