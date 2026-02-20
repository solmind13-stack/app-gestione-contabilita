'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, DocumentData, CollectionReference } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Landmark, 
  FileText, 
  Building, 
  Shield, 
  FileQuestion, 
  CalendarClock,
  Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, parseDate } from '@/lib/utils';
import { getUpcomingFiscalDeadlines, estimateFiscalAmount } from '@/lib/fiscal-calendar-it';
import type { Movimento } from '@/lib/types';
import { differenceInDays, startOfToday } from 'date-fns';

interface FiscalDeadlinesCardProps {
    societa: string;
}

const deadlineTypeStyles: { [key: string]: { icon: React.ElementType, color: string, bgColor: string } } = {
  IVA: { icon: FileText, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  IRPEF: { icon: Landmark, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  IRES: { icon: Landmark, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  INPS: { icon: Activity, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  INAIL: { icon: Shield, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  IMU: { icon: Building, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  F24: { icon: FileText, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
  ALTRO: { icon: FileQuestion, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
};

export function FiscalDeadlinesCard({ societa }: FiscalDeadlinesCardProps) {
    const firestore = useFirestore();

    const movementsQuery = useMemo(() => {
        if (!firestore) return null;
        let q = collection(firestore, 'movements') as CollectionReference<DocumentData>;
        if (societa !== 'Tutte') {
            return query(q, where('societa', '==', societa));
        }
        return query(q);
    }, [firestore, societa]);

    const { data: movements, isLoading } = useCollection<Movimento>(movementsQuery);
    
    const deadlinesWithEstimates = useMemo(() => {
        // Generiamo le scadenze per i prossimi 12 mesi
        const upcoming = getUpcomingFiscalDeadlines(12);

        return upcoming.map((deadline) => {
            // Cerchiamo pagamenti storici simili per stimare l'importo
            const historicalPayments = (movements || [])
                .filter(mov => {
                    if (mov.categoria !== 'Tasse') return false;
                    
                    const movDesc = mov.descrizione.toLowerCase();
                    const deadlineName = deadline.name.toLowerCase();
                    const deadlineType = deadline.type.toLowerCase();
                    
                    // Match per sottocategoria o per parole chiave nella descrizione
                    return (
                        mov.sottocategoria?.toLowerCase() === deadlineType || 
                        movDesc.includes(deadlineType) ||
                        deadlineName.split(' ').some(word => word.length > 3 && movDesc.includes(word.toLowerCase()))
                    );
                })
                .sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime())
                .map(mov => mov.uscita)
                .filter(amount => amount > 0);

            const estimatedAmount = estimateFiscalAmount(deadline.name, historicalPayments);

            return { ...deadline, estimatedAmount };
        })
        .filter(d => parseDate(d.dueDate) >= startOfToday())
        .slice(0, 6); // Mostriamo le prime 6
    }, [movements, societa]);

    const totalEstimated = useMemo(() => {
        return deadlinesWithEstimates.reduce((acc, d) => acc + d.estimatedAmount, 0);
    }, [deadlinesWithEstimates]);


    if (isLoading) {
        return (
            <Card className="lg:col-span-2 shadow-md">
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Scadenze Fiscali
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                            <Skeleton className="h-8 w-20" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="lg:col-span-2 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Prossime Scadenze Fiscali
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Scadenze tributarie basate sul calendario italiano
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {deadlinesWithEstimates.length > 0 ? (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            {deadlinesWithEstimates.map((deadline, index) => {
                                const today = startOfToday();
                                const dueDate = parseDate(deadline.dueDate);
                                const daysUntilDue = differenceInDays(dueDate, today);
                                
                                const typeConfig = deadlineTypeStyles[deadline.type] || deadlineTypeStyles.ALTRO;
                                const Icon = typeConfig.icon;

                                let urgencyColor = "text-muted-foreground border-muted-foreground/30";
                                if (daysUntilDue < 7) {
                                    urgencyColor = "text-red-600 border-red-600 bg-red-50 dark:bg-red-950/20";
                                } else if (daysUntilDue < 30) {
                                    urgencyColor = "text-amber-600 border-amber-600 bg-amber-50 dark:bg-amber-950/20";
                                }
                                
                                return (
                                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                                        <div className={cn("p-2.5 rounded-full transition-transform group-hover:scale-110", typeConfig.bgColor, typeConfig.color)}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate leading-tight">{deadline.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[11px] text-muted-foreground font-medium">
                                                    {formatDate(dueDate, 'dd MMMM yyyy')}
                                                </p>
                                                {daysUntilDue <= 30 && (
                                                    <Badge variant="outline" className={cn("text-[9px] py-0 px-1.5 font-bold h-4 uppercase", urgencyColor)}>
                                                        {daysUntilDue === 0 ? 'OGGI' : daysUntilDue === 1 ? 'DOMANI' : `tra ${daysUntilDue}gg`}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn(
                                                "text-sm font-bold tracking-tight",
                                                deadline.estimatedAmount > 0 ? "text-foreground" : "text-muted-foreground/50 italic font-normal"
                                            )}>
                                                {deadline.estimatedAmount > 0 ? formatCurrency(deadline.estimatedAmount) : 'Da stimare'}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Stima AI</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="pt-4 border-t border-dashed flex justify-between items-center px-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Impegno Totale</span>
                                <span className="text-xs text-muted-foreground font-medium">Prossimi 12 mesi</span>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-primary tracking-tighter">
                                    {formatCurrency(totalEstimated)}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-xl bg-muted/50">
                        <CalendarClock className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Nessuna scadenza imminente rilevata</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}