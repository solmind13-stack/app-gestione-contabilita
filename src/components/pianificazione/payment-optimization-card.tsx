'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Coins, 
  Clock, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight,
  TrendingUp,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { optimizePaymentTiming } from '@/ai/flows/optimize-payment-timing';
import { formatCurrency, formatDate, parseDate, cn } from '@/lib/utils';
import { differenceInDays, startOfToday } from 'date-fns';

interface PaymentOptimizationCardProps {
  societa: string;
  userId: string;
}

export function PaymentOptimizationCard({ societa, userId }: PaymentOptimizationCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Recupero l'ultima ottimizzazione salvata
  const optimizationQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(
      collection(firestore, 'paymentOptimizations'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, societa]);

  const { data: results, isLoading } = useCollection<any>(optimizationQuery);
  const latestResult = results?.[0];

  const handleRunAnalysis = async () => {
    if (!userId) return;
    
    setIsAnalyzing(true);
    toast({ 
      title: 'Ottimizzazione Pagamenti', 
      description: 'L\'AI sta analizzando sconti e liquidità per pianificare il timing ideale...' 
    });

    try {
      await optimizePaymentTiming({ 
        societa: societa === 'Tutte' ? 'LNC' : societa, 
        userId 
      });
      toast({ 
        title: 'Analisi Completata', 
        description: 'I suggerimenti di pagamento sono stati aggiornati.',
        className: 'bg-green-100 dark:bg-green-900'
      });
    } catch (error: any) {
      console.error("Payment optimization failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore', 
        description: error.message || 'Impossibile completare l\'ottimizzazione.' 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalPotentialSavings = useMemo(() => {
    if (!latestResult?.suggestions) return 0;
    return latestResult.suggestions
      .filter((s: any) => s.recommendation === 'pay_now' || s.recommendation === 'anticipate')
      .reduce((acc: number, curr: any) => acc + (curr.savingsOrImpact > 0 ? curr.savingsOrImpact : 0), 0);
  }, [latestResult]);

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'pay_now':
        return { label: 'PAGA SUBITO', color: 'bg-green-500', text: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50' };
      case 'consider_delay':
        return { label: 'VALUTA RITARDO', color: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50' };
      case 'anticipate':
        return { label: 'ANTICIPA', color: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' };
      default:
        return { label: 'ALLA SCADENZA', color: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' };
    }
  };

  return (
    <Card className="lg:col-span-1 shadow-md flex flex-col h-full border-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Ottimizzazione Pagamenti
          </CardTitle>
          <CardDescription>Strategia di uscita basata su sconti e cassa</CardDescription>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRunAnalysis} 
          disabled={isAnalyzing || isLoading}
          className="h-8 gap-2 text-[10px] font-black uppercase tracking-tighter"
        >
          {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Analizza
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-6">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : latestResult ? (
          <>
            {totalPotentialSavings > 0 && (
              <div className="p-4 rounded-xl bg-green-600 text-white flex items-center justify-between shadow-lg shadow-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Risparmio Potenziale</p>
                    <p className="text-2xl font-black font-mono tracking-tighter">{formatCurrency(totalPotentialSavings)}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-8 w-8 opacity-20" />
              </div>
            )}

            <ScrollArea className="h-[350px] pr-4 -mr-4">
              <div className="space-y-3">
                {latestResult.suggestions.map((s: any, idx: number) => {
                  const style = getRecommendationStyle(s.recommendation);
                  const today = startOfToday();
                  const daysLeft = differenceInDays(parseDate(s.dueDate), today);

                  return (
                    <div key={idx} className="p-3 rounded-xl border bg-muted/20 flex flex-col gap-3 group transition-all hover:bg-muted/40">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-xs font-black leading-tight truncate max-w-[180px]">{s.paymentName}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                            <Clock className="h-3 w-3" />
                            {daysLeft === 0 ? 'Oggi' : daysLeft === 1 ? 'Domani' : `tra ${daysLeft} giorni`}
                            <span>•</span>
                            {formatCurrency(s.amount)}
                          </div>
                        </div>
                        <Badge className={cn("text-[9px] font-black h-5", style.text, style.border, style.bg)} variant="outline">
                          {style.label}
                        </Badge>
                      </div>
                      
                      <div className="flex items-start gap-2 pt-1 border-t border-dashed border-border/50">
                        <div className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", style.color)} />
                        <p className="text-[11px] leading-relaxed text-muted-foreground italic font-medium">
                          {s.reason}
                          {s.savingsOrImpact > 0 && s.recommendation === 'pay_now' && (
                            <span className="font-bold text-green-600 ml-1">
                              (Risparmio: {formatCurrency(s.savingsOrImpact)})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Suggerimento Strategico</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground font-medium">
                {latestResult.narrative}
              </p>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6">
            <div className="p-4 rounded-full bg-primary/5">
              <Clock className="h-12 w-12 text-primary/30" />
            </div>
            <div className="space-y-2">
              <p className="font-bold text-lg">Nessuna Ottimizzazione</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
                Avvia l'analisi per scoprire come ottimizzare il timing dei tuoi pagamenti per risparmiare e proteggere la cassa.
              </p>
            </div>
            <Button onClick={handleRunAnalysis} disabled={isAnalyzing} className="font-bold uppercase tracking-tighter text-[10px] h-9 gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Analizza Pagamenti
            </Button>
          </div>
        )}
      </CardContent>
      
      {latestResult && (
        <CardFooter className="pt-0 border-t bg-muted/10 py-3">
          <p className="text-[9px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Ultimo aggiornamento: {formatDate(latestResult.createdAt, 'dd/MM/yy HH:mm')}
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
