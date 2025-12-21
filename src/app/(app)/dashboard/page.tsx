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

import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';
import { kpiData } from "@/lib/data";

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
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user]);

  // Data fetching hooks
  const { data: movimenti, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: previsioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);

  const isLoading = isUserLoading || isLoadingMovements || isLoadingIncome || isLoadingExpenses;

  const allData = useMemo(() => ({
    movements: movimenti || [],
    incomeForecasts: previsioniEntrate || [],
    expenseForecasts: previsioniUscite || [],
  }), [movimenti, previsioniEntrate, previsioniUscite]);


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
