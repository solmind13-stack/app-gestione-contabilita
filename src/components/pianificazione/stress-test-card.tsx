'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  Sparkles,
  TrendingDown,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { runStressTests } from '@/ai/flows/run-stress-tests';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface StressTestCardProps {
  societa: string;
  userId: string;
}

export function StressTestCard({ societa, userId }: StressTestCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  // Recupero l'ultimo stress test eseguito
  const testQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(
      collection(firestore, 'stressTests'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, societa]);

  const { data: results, isLoading } = useCollection<any>(testQuery);
  const latestResult = results?.[0];

  const handleRunTests = async () => {
    if (!userId) return;
    
    setIsRunning(true);
    toast({ 
      title: 'Esecuzione Stress Test', 
      description: 'L\'AI sta simulando scenari critici per testare la resilienza della cassa...' 
    });

    try {
      await runStressTests({ 
        societa: societa === 'Tutte' ? 'LNC' : societa, 
        userId 
      });
      toast({ 
        title: 'Analisi Completata', 
        description: 'Gli stress test sono stati eseguiti con successo.',
        className: 'bg-green-100 dark:bg-green-900'
      });
    } catch (error: any) {
      console.error("Stress tests failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore', 
        description: error.message || 'Impossibile completare gli stress test.' 
      });
    } finally {
      setIsRunning(false);
    }
  };

  const statusInfo = useMemo(() => {
    if (!latestResult) return null;
    
    const { passedCount, totalCount, tests } = latestResult;
    const hasSevere = tests.some((t: any) => t.result === 'severe');
    const failedCount = totalCount - passedCount;

    if (failedCount === 0) {
      return { 
        label: 'Resilienza Eccellente', 
        color: 'text-green-600', 
        bg: 'bg-green-500', 
        description: 'L\'azienda ha superato tutti gli scenari critici simulati.' 
      };
    }
    if (failedCount <= 2 && !hasSevere) {
      return { 
        label: 'Resilienza Moderata', 
        color: 'text-amber-600', 
        bg: 'bg-amber-500', 
        description: 'Alcuni scenari estremi potrebbero creare tensioni di liquidità.' 
      };
    }
    return { 
      label: 'Rischio Elevato', 
      color: 'text-red-600', 
      bg: 'bg-red-500', 
      description: 'La cassa è vulnerabile a ritardi o spese impreviste significative.' 
    };
  }, [latestResult]);

  return (
    <Card className="lg:col-span-2 shadow-md flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Financial Stress Test
          </CardTitle>
          <CardDescription>Simulazione di scenari avversi sulla liquidità</CardDescription>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRunTests} 
          disabled={isRunning || isLoading}
          className="gap-2 h-8 text-xs font-bold"
        >
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Esegui Test
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-8">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : latestResult ? (
          <>
            {/* Riepilogo in alto */}
            <div className="p-6 rounded-2xl bg-muted/30 border space-y-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className={cn("text-xl font-black uppercase tracking-tighter", statusInfo?.color)}>
                    {statusInfo?.label}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">{statusInfo?.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black font-mono tracking-tighter">
                    {latestResult.passedCount} <span className="text-muted-foreground text-sm">/ {latestResult.totalCount}</span>
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Test Superati</p>
                </div>
              </div>
              <Progress 
                value={(latestResult.passedCount / latestResult.totalCount) * 100} 
                className="h-2" 
                indicatorClassName={statusInfo?.bg}
              />
            </div>

            {/* Lista Test Individuali */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Dettaglio Scenari Simulati</h4>
              <div className="grid gap-3">
                {latestResult.tests.map((test: any, idx: number) => {
                  const Icon = test.result === 'passed' ? CheckCircle2 : test.result === 'critical' ? AlertTriangle : XCircle;
                  const color = test.result === 'passed' ? 'text-green-500' : test.result === 'critical' ? 'text-amber-500' : 'text-red-500';
                  
                  // Calcolo vicinanza alla soglia (5000)
                  const safetyProgress = Math.min(100, Math.max(0, (test.minBalance / 10000) * 100));

                  return (
                    <div key={idx} className="p-3 rounded-xl border bg-background flex flex-col gap-2 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-1.5 rounded-lg bg-muted", color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-none">{test.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{test.scenario}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-xs font-mono font-bold", test.minBalance < 0 ? "text-red-600" : "text-foreground")}>
                            Min: {formatCurrency(test.minBalance)}
                          </p>
                          <div className="flex items-center gap-1 justify-end text-[9px] font-bold text-muted-foreground/60 uppercase">
                            <TrendingDown className="h-2.5 w-2.5" />
                            {formatCurrency(Math.abs(test.impactAmount))}
                          </div>
                        </div>
                      </div>
                      <Progress 
                        value={safetyProgress} 
                        className="h-1" 
                        indicatorClassName={test.minBalance < 5000 ? "bg-red-500" : "bg-primary"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Narrative AI */}
            <div className="space-y-3 pt-4 border-t border-dashed">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Diagnosi del Risk Manager AI</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium italic italic-primary">
                "{latestResult.narrative}"
              </p>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6">
            <div className="p-4 rounded-full bg-primary/5">
              <Activity className="h-12 w-12 text-primary/30" />
            </div>
            <div className="space-y-2">
              <p className="font-bold text-lg">Stress Test mai eseguiti</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
                Verifica quanto la tua azienda è pronta ad affrontare imprevisti, ritardi e cali di fatturato.
              </p>
            </div>
            <Button onClick={handleRunTests} disabled={isRunning} className="font-bold uppercase tracking-tighter text-[10px] h-9 gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Esegui Prima Simulazione
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 border-t bg-muted/10 py-3">
        <div className="w-full flex justify-between items-center">
          <p className="text-[9px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Ultima Simulazione: {latestResult ? formatDate(latestResult.createdAt, 'dd/MM/yy HH:mm') : 'Mai'}
          </p>
          <Badge variant="outline" className="text-[9px] font-bold opacity-50">SOGLIA: 5.000€</Badge>
        </div>
      </CardFooter>
    </Card>
  );
}
