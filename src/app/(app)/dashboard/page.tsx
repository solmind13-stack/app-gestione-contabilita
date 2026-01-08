// src/app/(app)/dashboard/page.tsx
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';
import { endOfMonth, startOfMonth, addDays, isWithinInterval, startOfDay } from 'date-fns';

import { KpiCard } from "@/components/dashboard/kpi-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { CashflowChart } from '@/components/dashboard/cashflow-chart';
import DashboardLoading from './loading';
import { MonthlySummaryTable } from '@/components/dashboard/monthly-summary-table';

import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, Kpi } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

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
    const safeMovimenti = movimenti || [];
    const safeScadenze = scadenze || [];
    const safePrevisioniEntrate = previsioniEntrate || [];
    const safePrevisioniUscite = previsioniUscite || [];

    const oggi = startOfDay(new Date()); // Normalize 'today' to the start of the day
    const inizioMese = startOfMonth(oggi);
    const fineMese = endOfMonth(oggi);
    const trentaGiorni = addDays(oggi, 30);

    // 1. Liquidità Attuale - basata solo sui movimenti reali
    const liquidita = safeMovimenti.reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);

    // 2. Scadenze nei prossimi 30 giorni (non pagate)
    const scadenzeNei30gg = safeScadenze.filter(s => {
        const dataScadenza = startOfDay(new Date(s.dataScadenza)); // Normalize deadline date
        return isWithinInterval(dataScadenza, { start: oggi, end: trentaGiorni }) && s.stato !== 'Pagato';
    });
    
    const importoScadenze30gg = scadenzeNei30gg.reduce((acc, s) => acc + (s.importoPrevisto || 0) - (s.importoPagato || 0), 0);
    const scadenze7ggCount = scadenzeNei30gg.filter(s => {
        const dataScadenza = startOfDay(new Date(s.dataScadenza)); // Normalize deadline date
        return dataScadenza <= addDays(oggi, 7);
    }).length;

    // 3. Previsioni Entrate e Uscite per il mese corrente
    const previsioniEntrateMese = safePrevisioniEntrate
      .filter(p => {
        const dataPrevista = new Date(p.dataPrevista);
        return isWithinInterval(dataPrevista, { start: inizioMese, end: fineMese });
      })
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * (p.probabilita || 0)), 0);

    const previsioniUsciteMese = safePrevisioniUscite
      .filter(p => {
        const dataScadenza = new Date(p.dataScadenza);
        return isWithinInterval(dataScadenza, { start: inizioMese, end: fineMese });
      })
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * (p.probabilita || 0)), 0);
      
    // 4. Cash Flow Previsto a fine mese
    const cashFlowPrevisto = liquidita + previsioniEntrateMese - previsioniUsciteMese - importoScadenze30gg;

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
      <div className="grid grid-cols-1 gap-6">
         <MonthlySummaryTable allData={allData} isLoading={isLoading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OverviewChart data={allData} />
        </div>
        <div className="lg:col-span-1">
          <AiInsights allData={allData} company={user?.company || 'Tutte'} />
        </div>
      </div>
       <div className="grid grid-cols-1 gap-6">
         <CashflowChart data={allData} />
      </div>
    </div>
  );
}
