'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { CompanyProfile } from '@/lib/types';
import { 
  Lightbulb, 
  Target, 
  ShieldAlert 
} from 'lucide-react';
import { LiquidityTrafficLight } from '@/components/pianificazione/liquidity-traffic-light';
import { CashflowProjectionChart } from '@/components/pianificazione/cashflow-projection-chart';
import { FiscalDeadlinesCard } from '@/components/pianificazione/fiscal-deadlines-card';
import { EntityScoresCard } from '@/components/pianificazione/entity-scores-card';
import { VisualTimeline } from '@/components/pianificazione/visual-timeline';
import { CategoryBudgetCard } from '@/components/pianificazione/category-budget-card';
import { AnomalyAlertsCard } from '@/components/pianificazione/anomaly-alerts-card';
import { CrossCompanyPatterns } from '@/components/pianificazione/cross-company-patterns';

export default function PianificazionePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');

  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  const { data: companies } = useCollection<CompanyProfile>(companiesQuery);

  useEffect(() => {
    if (user?.role === 'company' || user.role === 'company-editor') {
      if (user.company) setSelectedCompany(user.company);
    }
  }, [user]);

  const currentSocieta = selectedCompany === 'Tutte' ? (user?.company || 'LNC') : selectedCompany;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Pianificazione Spese</h1>
          <p className="text-muted-foreground">
            Digital Twin Finanziario per simulazioni e analisi predittiva.
          </p>
        </div>
        {user && (user.role === 'admin' || user.role === 'editor') && (
          <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Seleziona società" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tutte">Tutte le società</SelectItem>
              {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Semaforo Liquidità */}
        <LiquidityTrafficLight 
          societa={currentSocieta} 
          userId={user?.uid || ''} 
        />

        {/* Proiezione Cash Flow */}
        <CashflowProjectionChart 
          societa={currentSocieta}
          userId={user?.uid || ''}
        />

        {/* Intelligence Cross-Azienda - Full Width Section */}
        <div className="lg:col-span-4 mt-4 mb-2">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-black uppercase tracking-tighter">Intelligence Cross-Azienda</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <CrossCompanyPatterns userId={user?.uid || ''} />
        </div>

        {/* Timeline Decisionale */}
        <VisualTimeline societa={currentSocieta} />

        {/* Prossime Scadenze Fiscali */}
        <FiscalDeadlinesCard societa={currentSocieta} />

        {/* Score Clienti/Fornitori */}
        <EntityScoresCard societa={currentSocieta} userId={user?.uid || ''} />

        {/* Budget per Categoria */}
        <CategoryBudgetCard societa={currentSocieta} />

        {/* Anomalie Rilevate */}
        <AnomalyAlertsCard 
          societa={currentSocieta} 
          userId={user?.uid || ''} 
        />
      </div>
    </div>
  );
}
