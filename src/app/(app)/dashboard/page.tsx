// src/app/(app)/dashboard/page.tsx
'use client';

import { useMemo } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';

import { KpiCard } from "@/components/dashboard/kpi-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { CashflowChart } from '@/components/dashboard/cashflow-chart';
import DashboardLoading from './loading';

import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, Kpi } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Wallet, AlertTriangle, ArrowUp, TrendingUp } from 'lucide-react';


const getQuery = (firestore: any, user: AppUser | null, collectionName: string) => {
    if (!firestore || !user) return null;
    let q = collection(firestore, collectionName) as CollectionReference<DocumentData>;
    if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        return query(q, where('societa', '==', user.company));
    }
    return query(q);
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Firestore Queries
  const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user]);
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user]);

  // Data fetching hooks
  const { data: movimenti, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: scadenze, isLoading: isLoadingScadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: previsioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);

  const isLoading = isUserLoading || isLoadingMovements || isLoadingScadenze || isLoadingIncome || isLoadingExpenses;

  const allData = useMemo(() => ({
    movements: movimenti || [],
    incomeForecasts: previsioniEntrate || [],
    expenseForecasts: previsioniUscite || [],
    deadlines: scadenze || [],
  }), [movimenti, previsioniEntrate, previsioniUscite, scadenze]);

  const kpiData = useMemo((): Kpi[] => {
    const liquidita = (movimenti || []).reduce((acc, mov) => acc + mov.entrata - mov.uscita, 0);

    const oggi = new Date();
    const trentaGiorni = new Date();
    trentaGiorni.setDate(oggi.getDate() + 30);
    const setteGiorni = new Date();
    setteGiorni.setDate(oggi.getDate() + 7);

    const scadenze30gg = (scadenze || []).filter(s => {
        const dataScadenza = new Date(s.dataScadenza);
        return dataScadenza >= oggi && dataScadenza <= trentaGiorni && s.stato !== 'Pagato';
    });
    const importoScadenze30gg = scadenze30gg.reduce((acc, s) => acc + s.importoPrevisto - s.importoPagato, 0);
    const scadenze7ggCount = scadenze30gg.filter(s => new Date(s.dataScadenza) <= setteGiorni).length;

    const previsioniEntrateMese = (previsioniEntrate || []).filter(p => {
        const dataPrevista = new Date(p.dataPrevista);
        return dataPrevista.getMonth() === oggi.getMonth() && dataPrevista.getFullYear() === oggi.getFullYear();
    }).reduce((acc, p) => acc + (p.importoLordo * p.probabilita), 0);
    
    const previsioniUsciteMese = (previsioniUscite || []).filter(p => {
        const dataScadenza = new Date(p.dataScadenza);
        return dataScadenza.getMonth() === oggi.getMonth() && dataScadenza.getFullYear() === oggi.getFullYear();
    }).reduce((acc, p) => acc + (p.importoLordo * p.probabilita), 0);

    const cashFlowPrevisto = liquidita + previsioniEntrateMese - previsioniUsciteMese;

    return [
      {
        title: 'Liquidità Attuale',
        value: formatCurrency(liquidita),
        icon: 'Wallet',
        color: 'bg-green-100 dark:bg-green-900',
        textColor: 'text-green-800 dark:text-green-200'
      },
      {
        title: 'Scadenze (30gg)',
        value: formatCurrency(importoScadenze30gg),
        icon: 'AlertTriangle',
        subText: `${scadenze7ggCount} scadenze entro 7 giorni`,
        color: 'bg-orange-100 dark:bg-orange-900',
        textColor: 'text-orange-800 dark:text-orange-200'
      },
      {
        title: 'Entrate Previste (Mese)',
        value: formatCurrency(previsioniEntrateMese),
        icon: 'ArrowUp',
        color: 'bg-blue-100 dark:bg-blue-900',
        textColor: 'text-blue-800 dark:text-blue-200'
      },
      {
        title: 'Cash Flow Previsto (Mese)',
        value: formatCurrency(cashFlowPrevisto),
        icon: 'TrendingUp',
        color: 'bg-indigo-100 dark:bg-indigo-900',
        textColor: 'text-indigo-800 dark:text-indigo-200'
      }
    ];

  }, [movimenti, scadenze, previsioniEntrate, previsioniUscite]);


  if (isLoading) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} data={kpi} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OverviewChart data={allData} />
        </div>
        <div className="lg:col-span-1">
          <AiInsights />
        </div>
      </div>
       <div className="grid grid-cols-1 gap-6">
         <CashflowChart data={allData} />
      </div>
    </div>
  );
}
