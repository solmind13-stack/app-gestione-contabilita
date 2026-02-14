'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, DocumentData, CollectionReference } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { LiquidityAlert } from '@/lib/types/pianificazione';

interface LiquidityTrafficLightProps {
    societa: string;
}

const getQuery = (firestore: any, societa: string): CollectionReference<DocumentData> | Query<DocumentData> | null => {
    if (!firestore) return null;
    let q = query(collection(firestore, 'liquidityAlerts'), orderBy('triggeredAt', 'desc'), limit(1));
    if (societa !== 'Tutte') {
        q = query(collection(firestore, 'liquidityAlerts'), where('societa', '==', societa), orderBy('triggeredAt', 'desc'), limit(1));
    }
    return q;
}

export function LiquidityTrafficLight({ societa }: LiquidityTrafficLightProps) {
    const firestore = useFirestore();
    const alertQuery = useMemo(() => getQuery(firestore, societa), [firestore, societa]);
    const { data: alerts, isLoading, error } = useCollection<LiquidityAlert>(alertQuery);

    const latestAlert = useMemo(() => (alerts && alerts.length > 0 ? alerts[0] : null), [alerts]);

    const getStatusStyles = (status: 'green' | 'yellow' | 'red' | null) => {
        switch (status) {
            case 'green':
                return {
                    circle: 'bg-green-500/20 border-green-500',
                    iconColor: 'text-green-500',
                    pulse: 'animate-pulse border-green-400',
                    Icon: CheckCircle,
                    title: 'Liquidità OK'
                };
            case 'yellow':
                return {
                    circle: 'bg-yellow-500/20 border-yellow-500',
                    iconColor: 'text-yellow-500',
                    pulse: 'animate-pulse border-yellow-400',
                    Icon: AlertTriangle,
                    title: 'Attenzione'
                };
            case 'red':
                return {
                    circle: 'bg-red-500/20 border-red-500 shadow-lg shadow-red-500/40',
                    iconColor: 'text-red-500',
                    pulse: 'animate-pulse border-red-400',
                    Icon: XCircle,
                    title: 'Urgente'
                };
            default:
                 return {
                    circle: 'bg-muted border-dashed',
                    iconColor: 'text-muted-foreground',
                    pulse: '',
                    Icon: Info,
                    title: 'In attesa di analisi'
                };
        }
    };
    
    if (isLoading) {
        return (
            <Card className="lg:col-span-4 h-full">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center justify-center gap-8 h-full min-h-[250px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                    <div className="flex-1 space-y-4 w-full">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
        return (
             <Card className="lg:col-span-4">
                 <CardHeader>
                    <CardTitle>Semaforo Liquidità</CardTitle>
                 </CardHeader>
                 <CardContent className="flex items-center justify-center h-48 text-destructive">
                    <AlertTriangle className="mr-2"/> Errore nel caricamento degli alert. Controlla i permessi della collection 'liquidityAlerts'.
                 </CardContent>
            </Card>
        )
    }

    const { circle, iconColor, pulse, Icon, title } = getStatusStyles(latestAlert?.status ?? null);

    return (
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>Semaforo Liquidità</CardTitle>
                <CardDescription>
                    Monitoraggio in tempo reale del rischio di liquidità basato sulle proiezioni AI.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className={cn("relative h-48 w-48 rounded-full flex items-center justify-center border-4 flex-shrink-0", circle)}>
                        <div className={cn("absolute h-full w-full rounded-full", pulse)} style={{animationDuration: status === 'red' ? '1s' : '2s'}}></div>
                         <div className="text-center">
                            <Icon className={cn("h-16 w-16 mx-auto", iconColor)} />
                            <p className={cn("text-xl font-bold mt-2", iconColor)}>{title}</p>
                        </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        {latestAlert ? (
                             <div className="space-y-3">
                                <p className="text-lg font-medium">{latestAlert.message}</p>
                                {latestAlert.status !== 'green' && (
                                     <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 justify-center md:justify-start text-sm mt-4">
                                        <div>
                                            <span className="text-muted-foreground">Data Criticità: </span>
                                            <span className="font-semibold">{formatDate(latestAlert.projectedDate)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Saldo Previsto: </span>
                                            <span className="font-semibold text-red-600">{formatCurrency(latestAlert.projectedBalance)}</span>
                                        </div>
                                     </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground text-center">
                                <Info className="h-8 w-8 mb-2" />
                                <p className="font-semibold">Nessuna analisi di liquidità disponibile.</p>
                                <p className="text-sm">Genera una nuova proiezione dalla sezione Previsioni per attivare il semaforo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
