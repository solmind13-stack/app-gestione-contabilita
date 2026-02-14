'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateCashFlowProjection, type CalculateCashFlowProjectionOutput } from '@/ai/flows/calculate-cash-flow-projection';
import { formatCurrency, formatDate, parseDate } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import type { Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';
import { subYears, startOfToday } from 'date-fns';

const SAFETY_THRESHOLD = 5000;

interface CashflowProjectionChartProps {
  societa: string;
}

const getQuery = (firestore: any, societa: string, collectionName: string) => {
    if (!firestore) return null;
    let q: CollectionReference<DocumentData> | Query<DocumentData> = collection(firestore, collectionName);
    if (societa !== 'Tutte') {
        q = query(q, where('societa', '==', societa));
    }
    return q;
};

// Custom Dot for highlighting points below the threshold
const CustomizedDot = (props: any) => {
    const { cx, cy, payload, value } = props;
    if (value < SAFETY_THRESHOLD) {
        return <Dot cx={cx} cy={cy} r={5} fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth={2} />;
    }
    return null;
};

export function CashflowProjectionChart({ societa }: CashflowProjectionChartProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [projection, setProjection] = useState<CalculateCashFlowProjectionOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');

  const twoYearsAgo = subYears(startOfToday(), 2);

  // Memoized queries
  const movementsQuery = useMemo(() => getQuery(firestore, societa, 'movements'), [firestore, societa]);
  const deadlinesQuery = useMemo(() => getQuery(firestore, societa, 'deadlines'), [firestore, societa]);
  const incomeForecastsQuery = useMemo(() => getQuery(firestore, societa, 'incomeForecasts'), [firestore, societa]);
  const expenseForecastsQuery = useMemo(() => getQuery(firestore, societa, 'expenseForecasts'), [firestore, societa]);

  // Data fetching
  const { data: allMovements, isLoading: loadingMovements } = useCollection<Movimento>(movementsQuery);

  // We only need the future items for the projection input
  const { data: deadlines, isLoading: loadingDeadlines } = useCollection<Scadenza>(
    useMemo(() => deadlinesQuery ? query(deadlinesQuery, where('dataScadenza', '>=', new Date().toISOString().split('T')[0])) : null, [deadlinesQuery])
  );
  const { data: incomeForecasts, isLoading: loadingIncome } = useCollection<PrevisioneEntrata>(
    useMemo(() => incomeForecastsQuery ? query(incomeForecastsQuery, where('dataPrevista', '>=', new Date().toISOString().split('T')[0])) : null, [incomeForecastsQuery])
  );
  const { data: expenseForecasts, isLoading: loadingExpenses } = useCollection<PrevisioneUscita>(
    useMemo(() => expenseForecastsQuery ? query(expenseForecastsQuery, where('dataScadenza', '>=', new Date().toISOString().split('T')[0])) : null, [expenseForecastsQuery])
  );
  
  const isLoading = loadingMovements || loadingDeadlines || loadingIncome || loadingExpenses;

  const handleGenerateProjection = async () => {
    if (!user || !allMovements) {
        toast({ variant: 'destructive', title: 'Dati non pronti', description: 'Attendi il caricamento dei dati prima di generare una proiezione.'});
        return;
    }
    setIsGenerating(true);
    setProjection(null);
    toast({ title: 'Generazione Proiezione in Corso...', description: 'L\'AI sta analizzando i dati per creare gli scenari.' });

    try {
        const baseBalance = allMovements.reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
        const recentMovements = allMovements.filter(m => parseDate(m.data) >= twoYearsAgo);
        
        const result = await calculateCashFlowProjection({
            societa: societa,
            userId: user.uid,
            baseBalance: baseBalance,
            movements: JSON.stringify(recentMovements),
            deadlines: JSON.stringify(deadlines || []),
            incomeForecasts: JSON.stringify(incomeForecasts || []),
            expenseForecasts: JSON.stringify(expenseForecasts || []),
        });
        
        setProjection(result);
        toast({ title: 'Proiezione Generata!', description: 'Gli scenari sono pronti per essere visualizzati.', className: 'bg-green-100 dark:bg-green-900' });
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Errore Generazione', description: e.message || 'Impossibile completare la generazione della proiezione.' });
    } finally {
        setIsGenerating(false);
    }
  };

  const chartData = useMemo(() => {
    if (!projection) return [];
    const projectionData = view === 'weekly' 
        ? projection.realistic.weeklyProjections 
        : projection.realistic.monthlyProjections;
        
    const optimisticData = view === 'weekly' ? projection.optimistic.weeklyProjections : projection.optimistic.monthlyProjections;
    const pessimisticData = view === 'weekly' ? projection.pessimistic.weeklyProjections : projection.pessimistic.monthlyProjections;

    return projectionData.map((point, index) => ({
      name: view === 'weekly' ? formatDate(point.weekStart, 'dd/MM') : (point as any).month,
      inflows: point.inflows,
      outflows: point.outflows,
      netFlow: point.netFlow,
      Realistico: point.cumulativeBalance,
      Ottimistico: optimisticData[index]?.cumulativeBalance,
      Pessimistico: pessimisticData[index]?.cumulativeBalance,
      confidenceRange: [pessimisticData[index]?.cumulativeBalance, optimisticData[index]?.cumulativeBalance]
    }));

  }, [projection, view]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Proiezione Cash Flow</CardTitle>
        <CardDescription>Simula scenari ottimistici, realistici e pessimistici per il flusso di cassa futuro.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="font-semibold text-lg">Analisi AI in corso...</p>
                <p className="text-sm text-muted-foreground">L'assistente sta calcolando gli scenari. Questo potrebbe richiedere fino a un minuto.</p>
            </div>
        ) : !projection ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-4 rounded-lg bg-muted/50">
            <Info className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-semibold">Nessuna proiezione disponibile.</p>
            <p className="text-sm text-muted-foreground mb-6">Clicca il bottone per avviare un'analisi AI del tuo cash flow.</p>
            <Button onClick={handleGenerateProjection} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
              Genera Proiezione
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={view} onValueChange={(v) => setView(v as 'weekly' | 'monthly')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="weekly">Settimanale (13 sett.)</TabsTrigger>
                <TabsTrigger value="monthly">Mensile (12 mesi)</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${Number(value) / 1000}k`} />
                        <Tooltip
                            formatter={(value: number, name: string) => [formatCurrency(value), name]}
                            labelFormatter={(label) => view === 'weekly' ? `Settimana del ${label}` : `Mese di ${label}`}
                            contentStyle={{background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))'}}
                        />
                        <Legend />
                        
                        <defs>
                            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        
                        <Area type="monotone" dataKey="confidenceRange" stroke="none" fill="url(#colorConfidence)" name="Banda di Confidenza"/>
                        <Line type="monotone" dataKey="Realistico" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={<CustomizedDot />} />
                        <Line type="monotone" dataKey="Ottimistico" stroke="hsl(var(--chart-2))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="Pessimistico" stroke="hsl(var(--chart-4))" strokeWidth={1.5} strokeDasharray="5 5" dot={<CustomizedDot />} />

                        <ReferenceLine y={SAFETY_THRESHOLD} label={{ value: "Soglia", position: "insideTopRight", fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            
            <div className="space-y-3 pt-4">
                 <div>
                    <div className="flex justify-between items-center mb-1">
                        <Label className="text-sm font-medium">Affidabilità Proiezione</Label>
                        <span className="text-sm font-bold">{projection.confidenceScore}%</span>
                    </div>
                     <Progress value={projection.confidenceScore} aria-label={`${projection.confidenceScore}% di affidabilità`} />
                </div>
                <div>
                     <Label className="text-sm font-medium">Analisi AI</Label>
                     <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md border">{projection.narrative}</p>
                </div>
                 <Button onClick={handleGenerateProjection} disabled={isLoading} size="sm" variant="outline">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                    Rigenera Proiezione
                </Button>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
