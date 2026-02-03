// src/components/layout/notifications.tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, History, ArrowUp } from "lucide-react";
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, DocumentData, CollectionReference } from 'firebase/firestore';
import type { AppUser, Scadenza, PrevisioneEntrata } from '@/lib/types';
import { formatCurrency, formatDate, parseDate } from '@/lib/utils';
import { addDays, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';

type Notification = {
    id: string;
    href: string;
    title: string;
    description: string;
    type: 'error' | 'warning' | 'info';
    icon: React.ElementType;
}

const getQuery = (firestore: any, user: AppUser | null, collectionName: string) => {
    if (!firestore || !user) return null;
    let q = collection(firestore, collectionName) as CollectionReference<DocumentData>;
    if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        return query(q, where('societa', '==', user.company));
    }
    return query(q);
};

export function Notifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const today = startOfToday();
  const sevenDaysFromNow = addDays(today, 7);

  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user?.uid, user?.role, user?.company]);
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user?.uid, user?.role, user?.company]);

  const { data: scadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: previsioniEntrate } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  
  const notifications: Notification[] = useMemo(() => {
    const allNotifications: Notification[] = [];
    const now = today;

    // Scadute
    (scadenze || []).filter(s => parseDate(s.dataScadenza) < now && s.stato !== 'Pagato' && s.stato !== 'Annullato').forEach(s => {
        allNotifications.push({
            id: `scadenza-scaduta-${s.id}`,
            href: '/scadenze',
            title: `Scadenza SCADUTA: ${s.descrizione}`,
            description: `Importo: ${formatCurrency(s.importoPrevisto - s.importoPagato)}`,
            type: 'error',
            icon: History
        });
    });

    // In scadenza
    (scadenze || []).filter(s => {
        const dueDate = parseDate(s.dataScadenza);
        return dueDate >= now && dueDate <= sevenDaysFromNow && s.stato !== 'Pagato' && s.stato !== 'Annullato';
    }).forEach(s => {
        allNotifications.push({
            id: `scadenza-imminente-${s.id}`,
            href: '/scadenze',
            title: `Scadenza imminente: ${s.descrizione}`,
            description: `Scade il ${formatDate(s.dataScadenza)} - ${formatCurrency(s.importoPrevisto - s.importoPagato)}`,
            type: 'warning',
            icon: AlertTriangle
        });
    });

    // Entrate previste
    (previsioniEntrate || []).filter(p => {
        const previstaDate = parseDate(p.dataPrevista);
        return previstaDate >= now && previstaDate <= sevenDaysFromNow && p.stato !== 'Incassato' && p.stato !== 'Annullato';
    }).forEach(p => {
        allNotifications.push({
            id: `entrata-prevista-${p.id}`,
            href: '/previsioni',
            title: `Entrata prevista: ${p.descrizione}`,
            description: `Prevista per il ${formatDate(p.dataPrevista)} - ${formatCurrency(p.importoLordo)}`,
            type: 'info',
            icon: ArrowUp
        });
    });

    return allNotifications.sort((a, b) => {
        if (a.type === 'error' && b.type !== 'error') return -1;
        if (a.type !== 'error' && b.type === 'error') return 1;
        if (a.type === 'warning' && b.type !== 'warning') return -1;
        if (a.type !== 'warning' && b.type === 'warning') return 1;
        return 0;
    }).slice(0, 5); // Limit to 5 notifications

  }, [scadenze, previsioniEntrate, today, sevenDaysFromNow]);


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", notifications[0].type === 'error' ? 'bg-red-400' : 'bg-orange-400')}></span>
              <span className={cn("relative inline-flex rounded-full h-2 w-2", notifications[0].type === 'error' ? 'bg-red-500' : 'bg-orange-500')}></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifiche</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length > 0 ? (
            notifications.map((notification) => {
                const Icon = notification.icon;
                return (
                    <Link href={notification.href} key={notification.id}>
                        <DropdownMenuItem className="flex items-start gap-3 cursor-pointer">
                            <Icon className={cn("h-4 w-4 mt-1", {
                                'text-red-500': notification.type === 'error',
                                'text-orange-500': notification.type === 'warning',
                                'text-blue-500': notification.type === 'info',
                            })} />
                            <div className="flex flex-col">
                                <p className="font-semibold text-sm">{notification.title}</p>
                                <p className="text-xs text-muted-foreground">{notification.description}</p>
                            </div>
                        </DropdownMenuItem>
                    </Link>
                )
            })
        ) : (
            <DropdownMenuItem disabled>Nessuna nuova notifica</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
