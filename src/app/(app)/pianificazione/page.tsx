
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
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  Calendar,
  BrainCircuit,
  FlaskConical,
  Target,
  Database,
  Globe,
  History,
  Activity,
  Zap,
  TrendingUp,
  ShieldAlert,
  Clock,
  Briefcase
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
import { DataIntegrityCard } from '@/components/pianificazione/data-integrity-card';
import { SectorBenchmarkCard } from '@/components/pianificazione/sector-benchmark-card';
import { FiscalSentinelCard } from '@/components/pianificazione/fiscal-sentinel-card';
import { MonthlyReplayCard } from '@/components/pianificazione/monthly-replay-card';

// AI Flows
import { calculateCashFlowProjection } from '@/ai/flows/calculate-cash-flow-projection';
import { calculateEntityScores } from '@/ai/flows/calculate-entity-scores';
import { detectSeasonalPatterns } from '@/ai/flows/detect-seasonal-patterns';
import { detectAnomalies } from '@/ai/flows/detect-anomalies';
import { liquidityEarlyWarning } from '@/ai/flows/liquidity-early-warning';
import { runStressTests } from '@/ai/flows/run-stress-tests';
import { optimizePaymentTiming } from '@/ai/flows/optimize-payment-timing';
import { verifyDataIntegrity } from '@/ai/flows/data-audit-trail';
import { fetchSectorBenchmarks } from '@/ai/flows/fetch-sector-benchmarks';
import { fiscalSentinel } from '@/ai/flows/fiscal-sentinel';

import type { CompanyProfile, Movimento, LiquidityAlert } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';

const SectionHeader = ({ title, subtitle, icon: Icon }: { title: string, subtitle?: string, icon?: any }) => (
  <div className="space-y-1 mb-6 border-b pb-3">
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-5 w-5 text-primary" />}
      <h2 className="text-xl font-black uppercase tracking-tighter">{title}</h2>
    </div>
    {subtitle && <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{subtitle}</p>}
  </div>
);

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

      setRefreshStep('Analisi affidabilità partner...');
      setRefreshProgress(15);
      await calculateEntityScores({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Rilevamento pattern stagionali...');
      setRefreshProgress(30);
      await detectSeasonalPatterns({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Controllo anomalie recenti...');
      setRefreshProgress(45);
      await detectAnomalies({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Esecuzione stress test...');
      setRefreshProgress(60);
      await runStressTests({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Ottimizzazione pagamenti...');
      setRefreshProgress(75);
      await optimizePaymentTiming({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Confronto benchmark...');
      setRefreshProgress(85);
      await fetchSectorBenchmarks({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Radar novità fiscali...');
      setRefreshProgress(90);
      await fiscalSentinel({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Monitoraggio liquidità...');
      setRefreshProgress(95);
      await liquidityEarlyWarning({ societa: societaToAnalyze, userId: user.uid });

      setRefreshStep('Verifica integrità...');
      setRefreshProgress(98);
      await verifyDataIntegrity({ societa: societaToAnalyze, userId: user.uid });

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
    <div className="space-y-12 max-w-[1600px] mx-auto pb-20">
      <DecisionReportDialog 
        isOpen={isDecisionDialogOpen} 
        setIsOpen={setIsDecisionDialogOpen} 
        societa={currentSocieta}
        userId={user?.uid || ''}
      />

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row gap-6 justify-between md:items-end">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">Pianificazione Spese</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="secondary" className="font-bold tracking-widest text-[10px] uppercase px-2 py-0.5">Digital Twin Finanziario</Badge>
            {lastUpdate && (
              <span className="text-[10px] flex items-center gap-1 font-bold uppercase opacity-60">
                <Clock className="h-3.5 w-3.5" />
                Ultimo Sync: {formatDate(lastUpdate, 'dd MMM HH:mm')}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => setIsDecisionDialogOpen(true)}
            className="gap-2 font-black uppercase tracking-tighter text-[10px] h-10 border-primary/20 hover:bg-primary/5"
          >
            <Target className="h-4 w-4 text-primary" />
            Valuta Decisione
          </Button>

          <Button 
            variant="outline"
            onClick={() => router.push('/pianificazione/sandbox')}
            className="gap-2 font-black uppercase tracking-tighter text-[10px] h-10 border-primary/20 hover:bg-primary/5"
          >
            <FlaskConical className="h-4 w-4 text-primary" />
            Apri Sandbox
          </Button>

          {user && (user.role === 'admin' || user.role === 'editor') && (
            <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background h-10 font-bold text-xs">
                <SelectValue placeholder="Società" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutte">Tutte le società</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          
          <Button 
            onClick={handleRefreshAll} 
            disabled={isGlobalRefreshing}
            className="gap-2 font-black uppercase tracking-tighter text-[10px] h-10 shadow-lg shadow-primary/20"
          >
            {isGlobalRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Aggiorna Tutto
          </Button>
        </div>
      </div>

      {/* --- PROGRESS BAR --- */}
      {isGlobalRefreshing && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary px-1">
            <span>{refreshStep}</span>
            <span>{refreshProgress}%</span>
          </div>
          <Progress value={refreshProgress} className="h-1.5" />
        </div>
      )}

      {/* --- EMPTY STATE --- */}
      {isEmptyState && (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
          <CardContent className="py-16 flex flex-col items-center text-center space-y-6">
            <div className="p-6 rounded-3xl bg-background shadow-xl border">
              <BrainCircuit className="h-16 w-16 text-primary animate-pulse" />
            </div>
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Attiva il tuo Digital Twin</h2>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Il sistema di pianificazione richiede un'analisi iniziale per processare lo storico dei movimenti e le scadenze future. Genera ora la prima proiezione di cassa e gli score di affidabilità.
              </p>
            </div>
            <Button onClick={handleRefreshAll} disabled={isGlobalRefreshing} className="gap-2 px-10 h-12 rounded-2xl shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-xs">
              {isGlobalRefreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              Genera Prima Analisi
            </Button>
          </CardContent>
        </Card>
      )}

      {!isEmptyState && (
        <div className={cn("space-y-16 transition-opacity duration-500", isGlobalRefreshing && "opacity-40 pointer-events-none")}>
          
          {/* SEZIONE 1: Situazione Attuale */}
          <section>
            <SectionHeader title="Situazione Attuale" subtitle="Stato della liquidità e briefing direzionale" icon={Activity} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LiquidityTrafficLight societa={currentSocieta} userId={user?.uid || ''} />
              <NarrativeAiCard societa={currentSocieta} userId={user?.uid || ''} />
            </div>
          </section>

          {/* SEZIONE 2: Proiezioni e Timeline */}
          <section>
            <SectionHeader title="Proiezioni e Timeline" subtitle="Analisi temporale dei flussi di cassa previsti" icon={TrendingUp} />
            <div className="space-y-8">
              <CashflowProjectionChart societa={currentSocieta} userId={user?.uid || ''} />
              <VisualTimeline societa={currentSocieta} />
            </div>
          </section>

          {/* SEZIONE 3: Analisi Operativa */}
          <section>
            <SectionHeader title="Analisi Operativa" subtitle="Gestione scadenze, budget e ottimizzazione partner" icon={Briefcase} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-8">
                <FiscalDeadlinesCard societa={currentSocieta} />
                <CategoryBudgetCard societa={currentSocieta} />
              </div>
              <div className="space-y-8">
                <EntityScoresCard societa={currentSocieta} userId={user?.uid || ''} />
                <PaymentOptimizationCard societa={currentSocieta} userId={user?.uid || ''} />
              </div>
            </div>
          </section>

          {/* SEZIONE 4: Rischi e Anomalie */}
          <section>
            <SectionHeader title="Rischi e Anomalie" subtitle="Monitoraggio resilienza e controllo conformità spese" icon={ShieldAlert} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <StressTestCard societa={currentSocieta} userId={user?.uid || ''} />
              <AnomalyAlertsCard societa={currentSocieta} userId={user?.uid || ''} />
            </div>
          </section>

          {/* SEZIONE 5: Multi-Azienda */}
          <section>
            <SectionHeader title="Intelligenza di Gruppo" subtitle="Sinergie e flussi cross-aziendali" icon={Zap} />
            <CrossCompanyPatterns userId={user?.uid || ''} />
          </section>

          {/* SEZIONE 6: Apprendimento */}
          <section>
            <SectionHeader title="Apprendimento Continuo" subtitle="Monthly Replay e calibrazione dei modelli AI" icon={History} />
            <MonthlyReplayCard societa={currentSocieta} userId={user?.uid || ''} />
          </section>

          {/* SEZIONE 7: Intelligence Esterna */}
          <section>
            <SectionHeader title="Intelligence Esterna" subtitle="Contesto di mercato e sentinella fiscale" icon={Globe} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SectorBenchmarkCard societa={currentSocieta} userId={user?.uid || ''} />
              <FiscalSentinelCard societa={currentSocieta} userId={user?.uid || ''} />
            </div>
          </section>

          {/* SEZIONE 8: Salute Dati */}
          <section>
            <SectionHeader title="Salute dei Dati" subtitle="Audit trail e integrità del database finanziario" icon={Database} />
            <DataIntegrityCard societa={currentSocieta} userId={user?.uid || ''} />
          </section>

        </div>
      )}
    </div>
  );
}
