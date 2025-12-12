// src/app/(app)/layout.tsx
'use client';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { FloatingChatButton } from '@/components/layout/floating-chat-button';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import DashboardLoading from './dashboard/loading';
import { useToast } from '@/hooks/use-toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
      return;
    }

    const setupUserProfile = async () => {
        if (firestore && user && !user.role) { // User is authenticated but doesn't have a role yet.
            const userDocRef = doc(firestore, 'users', user.uid);
            try {
                const docSnap = await getDoc(userDocRef);
                if (!docSnap.exists()) {
                    // This is a new user, let's create their profile.
                    // For this app, we'll make the first user an admin.
                    // In a real app, you might have a different logic.
                    const newUserProfile = {
                        id: user.uid,
                        email: user.email,
                        firstName: user.displayName?.split(' ')[0] || 'Nuovo',
                        lastName: user.displayName?.split(' ')[1] || 'Utente',
                        role: 'admin', // Make the first user an admin
                        company: 'LNC', // Default company
                        lastLogin: new Date().toISOString(),
                        creationDate: new Date().toISOString(),
                    };
                    await setDoc(userDocRef, newUserProfile);
                    toast({
                        title: "Profilo Utente Creato",
                        description: "Il tuo profilo è stato configurato come amministratore.",
                    });
                     // Force a reload of the page to get the new user role
                    router.refresh();
                }
            } catch (error) {
                console.error("Failed to set up user profile:", error);
                toast({
                    variant: 'destructive',
                    title: "Errore Profilo",
                    description: "Impossibile configurare il profilo utente.",
                });
            }
        }
    };

    if(user) {
        setupUserProfile();
    }

  }, [user, isUserLoading, router, firestore, toast]);

  if (isUserLoading || !user?.role) { // Also show loading while user profile is being set up
    return <DashboardLoading />;
  }

  if (!user) {
    return null; // or redirect, but useEffect handles that.
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
