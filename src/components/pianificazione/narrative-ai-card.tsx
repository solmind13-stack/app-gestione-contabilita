'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Loader2, 
  Target, 
  AlertCircle, 
  Lightbulb, 
  TrendingUp,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateNarrativeInsights, type GenerateNarrativeInsightsOutput } from '@/ai/flows/generate-narrative-insights';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { CashFlowProjection, LiquidityAlert, Scadenza, SeasonalAnalysis } from '@/lib/types';

interface NarrativeAiCardProps {
  societa: string;
  userId: string;
}

export function NarrativeAiCard({ societa, userId }: NarrativeAiCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [narrative, setNarrative] = useState<GenerateNarrativeInsightsOutput | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 1. Fetch Proiezioni (per gli scenari)
  const projQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'cashFlowProjections'),
      where('societa', '==', societa),
      orderBy('generatedAt', 'desc'),
      limit(15)
    );
  }, [firestore, societa]);

  // 2. Fetch Alert Liquidità
  const alertQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'liquidityAlerts'),
      where('societa', '==', societa),
      orderBy('triggeredAt', 'desc'),
      limit(1)
    );
  }, [firestore, societa]);

  // 3. Fetch Scadenze Imminenti
  const deadlinesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'deadlines'),
      where('societa', '==', societa),
      where('stato', '!=', 'Pagato'),
      limit(5)
    );
  }, [firestore, societa]);

  // 4. Fetch Analisi Stagionale
  const seasonalQuery = useMemo(() => {
    if (!firestore || !userId) return null;
    return query(
      collection(firestore, 'users', userId, 'seasonalPatterns'),
      where('societa', '==', societa),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
  }, [firestore, userId, societa]);

  const { data: projections } = useCollection<CashFlowProjection>(projQuery);
  const { data: alerts } = useCollection<LiquidityAlert>(alertQuery);
  const { data: deadlines } = useCollection<Scadenza>(deadlinesQuery);
  const { data: seasonal } = useCollection<SeasonalAnalysis>(seasonalQuery);

  const scenarios = useMemo(() => {
    if (!projections || projections.length === 0) return null;
    const latestTimestamp = projections[0].generatedAt;
    const latestSet = projections.filter(p => p.generatedAt === latestTimestamp);
    
    return {
      realistic: latestSet.find(p => p.scenarioType === 'realistic'),
      optimistic: latestSet.find(p => p.scenarioType === 'optimistic'),
      pessimistic: latestSet.find(p => p.scenarioType === 'pessimistic'),
    };
  }, [projections]);

  const handleGenerateBriefing = async () => {
    if (!userId || !scenarios?.realistic) {
      toast({ variant: 'destructive', title: 'Dati insufficienti', description: 'Genera prima una proiezione di cassa.' });
      return;
    }

    setIsGenerating(true);
    toast({ title: 'Generazione Briefing', description: 'L\'AI sta traducendo i dati finanziari...' });

    try {
      // Prepariamo i dati per il flow
      const cashFlowSummary = JSON.stringify({
        baseBalance: scenarios.realistic.baseBalance,
        endBalance: scenarios.realistic.monthlyProjections[scenarios.realistic.monthlyProjections.length - 1].cumulativeBalance,
        confidence: scenarios.realistic.confidenceScore
      });

      const upcomingDeadlines = JSON.stringify((deadlines || []).map(d => ({
        desc: d.descrizione,
        amount: d.importoPrevisto,
        due: d.dataScadenza
      })));

      const liquidityStatus = JSON.stringify(alerts?.[0] || { status: 'green', message: 'Nessun alert rilevato' });
      const seasonalPatterns = JSON.stringify(seasonal?.[0]?.narrative || "Nessun pattern rilevato");

      const result = await generateNarrativeInsights({
        societa,
        userId,
        cashFlowSummary,
        upcomingDeadlines,
        liquidityStatus,
        seasonalPatterns
      });

      setNarrative(result);
      setLastUpdated(new Date());
      toast({ title: 'Briefing Aggiornato', className: 'bg-green-100 dark:bg-green-900' });
    } catch (error) {
      console.error("Narrative generation failed:", error);
      toast({ variant: 'destructive', title: 'Errore AI', description: 'Impossibile generare il briefing narrativo.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="lg:col-span-2 shadow-md flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Briefing Strategico AI
          </CardTitle>
          <CardDescription>Analisi narrativa della situazione finanziaria</CardDescription>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleGenerateBriefing} 
          disabled={isGenerating || !scenarios?.realistic}
          className="gap-2 h-8 text-xs font-bold"
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Aggiorna
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1">
        <ScrollArea className="h-[400px] pr-4">
          {!narrative ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="p-4 rounded-full bg-primary/5">
                <Sparkles className="h-10 w-10 text-primary/40" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-muted-foreground">Briefing non generato</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
                  L'AI può analizzare tutti i dati della pianificazione per darti un riassunto strategico.
                </p>
              </div>
              <Button onClick={handleGenerateBriefing} disabled={!scenarios?.realistic} variant="secondary" size="sm" className="font-bold uppercase tracking-wider text-[10px]">
                Inizia Analisi
              </Button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Situazione Attuale */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Situazione Attuale
                </div>
                <p className="text-sm leading-relaxed text-foreground/90 font-medium bg-primary/5 p-4 rounded-xl border border-primary/10">
                  {narrative.currentSituation}
                </p>
              </div>

              {/* Prossime Sfide */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-destructive">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  Sfide in Arrivo
                </div>
                <div className="space-y-2">
                  {narrative.challenges.map((item, i) => (
                    <div key={i} className="flex gap-3 text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opportunità */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Opportunità
                </div>
                <div className="space-y-2">
                  {narrative.opportunities.map((item, i) => (
                    <div key={i} className="flex gap-3 text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Lightbulb className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consiglio del Mese */}
              <div className="p-4 rounded-xl bg-muted border-2 border-dashed border-border flex items-start gap-4">
                <div className="p-2 bg-background rounded-lg shadow-sm">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consiglio del Mese</p>
                  <p className="text-sm font-bold leading-tight">{narrative.monthlyAdvice}</p>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Scenari Sezione */}
              <div className="space-y-4 pb-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Scenari & Probabilità</h4>
                <div className="grid gap-3">
                  {/* Realistico */}
                  <div className="p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-50/30 border shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-blue-600">Realistico (55%)</span>
                      <span className="text-[10px] font-mono font-bold">{formatCurrency(scenarios?.realistic?.monthlyProjections[0].cumulativeBalance || 0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Stabilità dei flussi core. Il balance si attesta sui valori storici medi.
                    </p>
                  </div>
                  {/* Ottimistico */}
                  <div className="p-3 rounded-lg border-l-4 border-l-green-500 bg-green-50/30 border shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-green-600">Ottimistico (25%)</span>
                      <span className="text-[10px] font-mono font-bold">+{formatCurrency((scenarios?.optimistic?.monthlyProjections[0].cumulativeBalance || 0) - (scenarios?.realistic?.monthlyProjections[0].cumulativeBalance || 0))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Incassi anticipati e riduzione spese variabili. Massima capacità d'investimento.
                    </p>
                  </div>
                  {/* Pessimistico */}
                  <div className="p-3 rounded-lg border-l-4 border-l-red-500 bg-red-50/30 border shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-red-600">Pessimistico (20%)</span>
                      <span className="text-[10px] font-mono font-bold">-{formatCurrency((scenarios?.realistic?.monthlyProjections[0].cumulativeBalance || 0) - (scenarios?.pessimistic?.monthlyProjections[0].cumulativeBalance || 0))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Ritardi incassi e imprevisti operativi. Monitorare soglia di sicurezza.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="pt-0 border-t bg-muted/10">
        <div className="w-full flex justify-between items-center py-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            Ultima Analisi: {lastUpdated ? formatDate(lastUpdated, 'dd/MM/yy HH:mm') : 'N/A'}
          </p>
          <div className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline cursor-pointer group">
            Dettagli Analisi <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
