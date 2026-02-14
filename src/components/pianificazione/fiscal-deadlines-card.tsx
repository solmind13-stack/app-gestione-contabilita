// src/components/pianificazione/fiscal-deadlines-card.tsx
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, DocumentData, CollectionReference } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Landmark, FileText, Building, HeartPulse, Shield, FileQuestion, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getUpcomingFiscalDeadlines, estimateFiscalAmount } from '@/lib/fiscal-calendar-it';
import type { Movimento } from '@/lib/types';
import type { FiscalDeadline } from '@/lib/types/pianificazione';
import { differenceInDays } from 'date-fns';

interface FiscalDeadlinesCardProps {
    societa: string;
}

const deadlineTypeStyles: { [key: string]: { icon: React.ElementType, color: string } } = {
  IVA: { icon: FileText, color: 'text-blue-500' },
  IRPEF: { icon: Landmark, color: 'text-red-500' },
  IRES: { icon: Landmark, color: 'text-red-500' },
  INPS: { icon: HeartPulse, color: 'text-green-500' },
  INAIL: { icon: Shield, color: 'text-purple-500' },
  IMU: { icon: Building, color: 'text-orange-500' },
  F24: { icon: FileText, color: 'text-gray-500' },
  ALTRO: { icon: FileQuestion, color: 'text-gray-500' },
};

export function FiscalDeadlinesCard({ societa }: FiscalDeadlinesCardProps) {
    const firestore = useFirestore();

    const movementsQuery = useMemo(() => {
        if (!firestore) return null;
        let q: CollectionReference<DocumentData> | Query<DocumentData> = collection(firestore, 'movements');
        if (societa !== 'Tutte') {
            q = query(q, where('societa', '==', societa));
        }
        return q;
    }, [firestore, societa]);

    const { data: movements, isLoading } = useCollection<Movimento>(movementsQuery);
    
    const deadlinesWithEstimates = useMemo(() => {
        // Assuming both LNC and STG are 'srl'. This could be enhanced by reading company type from a profile.
        const companyType = 'srl'; 
        const upcoming = getUpcomingFiscalDeadlines(12, companyType);

        return upcoming.map((deadline) => {
            const historicalPayments = (movements || [])
                .filter(mov => {
                    if (mov.categoria !== 'Tasse') return false;
                    const movDesc = mov.descrizione.toLowerCase();
                    const deadlineName = deadline.name.toLowerCase();
                    const deadlineType = deadline.type.toLowerCase();
                    
                    if (mov.sottocategoria?.toLowerCase() === deadlineType || movDesc.includes(deadlineType)) {
                        return true;
                    }
                    if (deadlineName.includes(movDesc) || movDesc.includes(deadlineName.split(' ')[0])) {
                         return true;
                    }
                    return false;
                })
                .map(mov => mov.uscita)
                .filter(amount => amount > 0);

            const estimatedAmount = estimateFiscalAmount(deadline.name, historicalPayments);

            return { ...deadline, estimatedAmount };
        }).filter(d => d.dueDate >= new Date()).slice(0, 6);
    }, [movements, societa]);

    const totalEstimated = useMemo(() => {
        return deadlinesWithEstimates.reduce((acc, d) => acc + d.estimatedAmount, 0);
    }, [deadlinesWithEstimates]);


    if (isLoading) {
        return (
            <Card className="lg:col-span-2">
                <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Prossime Scadenze Fiscali</CardTitle>
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {deadlinesWithEstimates.length > 0 ? (
                    <div className="space-y-4">
                        {deadlinesWithEstimates.map((deadline, index) => {
                             const today = new Date();
                             const dueDate = new Date(deadline.dueDate);
                             const daysUntilDue = differenceInDays(dueDate, today);
                             const Icon = deadlineTypeStyles[deadline.type]?.icon || FileQuestion;
                             const iconColor = deadlineTypeStyles[deadline.type]?.color || 'text-gray-500';

                             let dateBadgeVariant: "destructive" | "default" | "secondary" = "secondary";
                             if (daysUntilDue < 7) {
                                dateBadgeVariant = "destructive";
                             } else if (daysUntilDue < 30) {
                                dateBadgeVariant = "default";
                             }
                             
                             return (
                                <div key={index} className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-full bg-muted flex-shrink-0", iconColor)}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-medium truncate">{deadline.name}</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(dueDate)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold">
                                            {deadline.estimatedAmount > 0 ? formatCurrency(deadline.estimatedAmount) : <span className="text-xs text-muted-foreground">Da stimare</span>}
                                        </p>
                                        <Badge variant={dateBadgeVariant}>
                                            {daysUntilDue < 0 ? 'Scaduta' : `tra ${daysUntilDue}gg`}
                                        </Badge>
                                    </div>
                                </div>
                             )
                        })}
                        <div className="flex justify-between items-center pt-3 border-t">
                            <p className="text-sm font-bold">Totale Stimato</p>
                            <p className="text-sm font-bold">{formatCurrency(totalEstimated)}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground h-40 flex items-center justify-center">Nessuna scadenza fiscale imminente.</p>
                )}
            </CardContent>
        </Card>
    )
}
