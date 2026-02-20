
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  Calendar,
  BrainCircuit,
  FlaskConical,
  Target
} from 'lucide-react';

// Components
import { LiquidityTrafficLight } from '@/components/pianificazione/liquidity-traffic-light';
import { CashflowProjectionChart } from '@/components/pianificazione/cashflow-projection-chart';
import { FiscalDeadlinesCard } from '@/components/pianificazione/fiscal-deadlines-card';
import { EntityScoresCard } from '@/components/pianificazione/entity-scores-card';
import { VisualTimeline } from '@/components/pianificazione/visual-timeline';
import { CategoryBudgetCard } from '@/components/pianificazione/category-budget-card';
import { AnomalyAlertsCard } from '@/components/pianificazione/anomaly-alerts-card';
import { CrossCompanyPatterns } from '@/components/pianificazione/cross-company-patterns';
import { NarrativeAiCard } from '@/components/pianificazione/narrative-ai-card';
import { StressTestCard } from '@/components/pianificazione/stress-test-card';
import { PaymentOptimizationCard } from '@/components/pianificazione/payment-optimization-card';
import { DecisionReportDialog } from '@/components/pianificazione/decision-report-dialog';

// AI Flows
import { calculateCashFlowProjection } from '@/ai/flows/calculate-cash-flow-projection';
import { calculateEntityScores } from '@/ai/flows/calculate-entity-scores';
import { detectSeasonalPatterns } from '@/ai/flows/detect-seasonal-patterns';
import { detectAnomalies } from '@/ai/flows/detect-anomalies';
import { liquidityEarlyWarning } from '@/ai/flows/liquidity-early-warning';
import { runStressTests } from '@/ai/flows/run-stress-tests';
import { optimizePaymentTiming } from '@/ai/flows/optimize-payment-timing';

import type { CompanyProfile, Movimento, LiquidityAlert } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';

export default function PianificazionePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStep, setRefreshStep] = useState('');
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);

  // 1. Fetch Companies
  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);

  useEffect(() => {
    if (user?.role === 'company' || user.role === 'company-editor') {
      if (user.company) setSelectedCompany(user.company);
    }
  }, [user]);

  const currentSocieta = selectedCompany === 'Tutte' ? (user?.company || 'LNC') : selectedCompany;

  // 2. Fetch Latest Update Info
  const alertsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liquidityAlerts'), orderBy('triggeredAt', 'desc'), limit(1));
  }, [firestore]);
  const { data: latestAlerts, isLoading: isLoadingAlerts } = useCollection<LiquidityAlert>(alertsQuery);

  const lastUpdate = useMemo(() => {
    if (latestAlerts && latestAlerts.length > 0) {
      return latestAlerts[0].triggeredAt;
    }
    return null;
  }, [latestAlerts]);

  // 3. Global Refresh Function
  const handleRefreshAll = async () => {
    if (!user || !firestore) return;
    
    setIsGlobalRefreshing(true);
    setRefreshProgress(0);
    const societaToAnalyze = currentSocieta === 'Tutte' ? 'LNC' : currentSocieta;

    try {
      // Step 1: Projection
      setRefreshStep('Proiezione flussi di cassa...');
      setRefreshProgress(5);
      
      const movementsRef = collection(firestore, 'movements');
      const q = query(movementsRef, where('societa', '==', societaToAnalyze));
      const snap = await getDocs(q);
      const movements = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
      const baseBalance = movements.reduce((acc, m) => acc + (m.entrata || 0) - (m.uscita || 0), 0);

      await calculateCashFlowProjection({
        societa: societaToAnalyze,
        userId: user.uid,
        baseBalance,
        movements: JSON.stringify(movements.slice(0, 500)),
        deadlines: "[]",
        incomeForecasts: "[]",
        expenseForecasts: "[]"
      });

      // Step 2: Entity Scores
      setRefreshStep('Analisi affidabilità clienti/fornitori...');
      setRefreshProgress(20);
      await calculateEntityScores({ societa: societaToAnalyze, userId: user.uid });

      // Step 3: Seasonal Patterns
      setRefreshStep('Rilevamento pattern stagionali...');
      setRefreshProgress(35);
      await detectSeasonalPatterns({ societa: societaToAnalyze, userId: user.uid });

      // Step 4: Anomalies
      setRefreshStep('Controllo anomalie recenti...');
      setRefreshProgress(50);
      await detectAnomalies({ societa: societaToAnalyze, userId: user.uid });

      // Step 5: Stress Tests
      setRefreshStep('Esecuzione simulazioni di resilienza...');
      setRefreshProgress(65);
      await runStressTests({ societa: societaToAnalyze, userId: user.uid });

      // Step 6: Payment Optimization
      setRefreshStep('Ottimizzazione timing pagamenti...');
      setRefreshProgress(80);
      await optimizePaymentTiming({ societa: societaToAnalyze, userId: user.uid });

      // Step 7: Early Warning
      setRefreshStep('Monitoraggio liquidità critiche...');
      setRefreshProgress(95);
      await liquidityEarlyWarning({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Completato!');
      setRefreshProgress(100);
      toast({ title: 'Analisi Globale Completata', className: 'bg-green-100 dark:bg-green-900' });
    } catch (error: any) {
      console.error("Refresh all failed:", error);
      toast({ variant: 'destructive', title: 'Errore durante l\'analisi', description: error.message });
    } finally {
      setTimeout(() => {
        setIsGlobalRefreshing(false);
        setRefreshProgress(0);
        setRefreshStep('');
      }, 1000);
    }
  };

  const isEmptyState = !isLoadingAlerts && (!latestAlerts || latestAlerts.length === 0);

  return (
    <div className="space-y-10">
      <DecisionReportDialog 
        isOpen={isDecisionDialogOpen} 
        setIsOpen={setIsDecisionDialogOpen} 
        societa={currentSocieta}
        userId={user?.uid || ''}
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Pianificazione Spese</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm font-medium">Digital Twin Finanziario</span>
            {lastUpdate && (
              <>
                <span className="text-xs opacity-50">•</span>
                <span className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Ultimo aggiornamento: {formatDate(lastUpdate, 'dd MMM HH:mm')}
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="secondary"
            onClick={() => setIsDecisionDialogOpen(true)}
            className="gap-2 font-bold uppercase tracking-tighter text-[10px] h-9 border-primary/20 hover:bg-primary/10"
          >
            <Target className="h-3.5 w-3.5" />
            Valuta Decisione
          </Button>

          <Button 
            onClick={() => router.push('/pianificazione/sandbox')}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-primary/20 transition-all font-bold uppercase tracking-tighter text-[10px] h-9"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Apri Live Sandbox
          </Button>

          {user && (user.role === 'admin' || user.role === 'editor') && (
            <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background">
                <SelectValue placeholder="Seleziona società" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutte">Tutte le società</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshAll} 
            disabled={isGlobalRefreshing}
            className="gap-2 font-bold uppercase tracking-tighter text-[10px] h-9"
          >
            {isGlobalRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Aggiorna Tutto
          </Button>
        </div>
      </div>

      {/* Global Progress Bar */}
      {isGlobalRefreshing && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary px-1">
            <span>{refreshStep}</span>
            <span>{refreshProgress}%</span>
          </div>
          <Progress value={refreshProgress} className="h-1.5" />
        </div>
      )}

      {/* Empty State Welcome */}
      {isEmptyState && (
        <Card className="border-primary/20 bg-primary/5 shadow-inner">
          <CardContent className="py-10 flex flex-col items-center text-center space-y-6">
            <div className="p-4 rounded-full bg-background shadow-sm border">
              <BrainCircuit className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="space-y-2 max-w-xl">
              <h2 className="text-xl font-bold">Benvenuto nella Pianificazione Spese!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Il tuo Digital Twin non ha ancora dati analizzati. L'AI ha bisogno di elaborare lo storico dei tuoi movimenti per generare proiezioni, valutare l'affidabilità dei partner e rilevare anomalie.
              </p>
            </div>
            <Button onClick={handleRefreshAll} disabled={isGlobalRefreshing} className="gap-2 px-8">
              {isGlobalRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Genera Prima Analisi
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Grid Layout */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", isGlobalRefreshing && "opacity-50 pointer-events-none transition-opacity")}>
        
        {/* Row 1: The most prominent indicator */}
        <div className="md:col-span-2">
          <LiquidityTrafficLight 
            societa={currentSocieta} 
            userId={user?.uid || ''} 
          />
        </div>

        {/* Row 2: Prediction and AI Interpretation */}
        <CashflowProjectionChart 
          societa={currentSocieta}
          userId={user?.uid || ''}
        />
        <NarrativeAiCard 
          societa={currentSocieta} 
          userId={user?.uid || ''} 
        />

        {/* Row 3: Group Intelligence */}
        <div className="md:col-span-2 mt-4">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-black uppercase tracking-tighter">Intelligence Cross-Azienda</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <CrossCompanyPatterns userId={user?.uid || ''} />
        </div>

        {/* Row 4: Resilience & Optimization Section */}
        <div className="md:col-span-2 mt-4">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-black uppercase tracking-tighter">Analisi di Resilienza e Strategia</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
               <StressTestCard 
                societa={currentSocieta} 
                userId={user?.uid || ''} 
              />
            </div>
            <div className="md:col-span-1">
               <PaymentOptimizationCard 
                societa={currentSocieta} 
                userId={user?.uid || ''} 
              />
            </div>
          </div>
        </div>

        {/* Row 5: Anomalies & Patterns */}
        <div className="md:col-span-2 mt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnomalyAlertsCard 
                societa={currentSocieta} 
                userId={user?.uid || ''} 
              />
              <EntityScoresCard societa={currentSocieta} userId={user?.uid || ''} />
           </div>
        </div>

        {/* Row 6: Timeline */}
        <div className="md:col-span-2 mt-4">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-black uppercase tracking-tighter">Mappa Temporale dei Flussi</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <VisualTimeline societa={currentSocieta} />
        </div>

        {/* Row 7+: Utility Cards (2 per row) */}
        <FiscalDeadlinesCard societa={currentSocieta} />
        <CategoryBudgetCard societa={currentSocieta} />
      </div>
    </div>
  );
}
