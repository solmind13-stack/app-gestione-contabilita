// src/app/(app)/dashboard/page.tsx
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';
import { endOfMonth, startOfMonth, addMonths, isWithinInterval, startOfQuarter, endOfQuarter, startOfYear, endOfYear, startOfDay } from 'date-fns';

import { KpiCard } from "@/components/dashboard/kpi-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { CashflowChart } from '@/components/dashboard/cashflow-chart';
import DashboardLoading from './loading';
import { MonthlySummaryTable } from '@/components/dashboard/monthly-summary-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, Kpi, CompanyProfile } from '@/lib/types';
import { formatCurrency, parseDate } from '@/lib/utils';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';


type Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

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
  const [isClient, setIsClient] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');

  const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user?.uid, user?.role, user?.company]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user?.uid, user?.role, user?.company]);
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user?.uid, user?.role, user?.company]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user?.uid, user?.role, user?.company]);
  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);

  const { data: allMovements, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: allScadenze, isLoading: isLoadingScadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: allPrevisioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: allPrevisioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);

  useEffect(() => {
    setIsClient(true);
    if (user?.role === 'company' || user.role === 'company-editor') {
        if (user.company) setSelectedCompany(user.company);
    }
  }, [user]);

  const isLoading = isUserLoading || isLoadingMovements || isLoadingScadenze || isLoadingIncome || isLoadingExpenses || isLoadingCompanies;

  const {
    kpiData,
    upcomingDeadlines,
    overviewChartData,
    monthlySummaryData,
    cashflowChartData
  } = useMemo(() => {
    const today = new Date();
    const filterByCompany = (item: any) => selectedCompany === 'Tutte' || item.societa === selectedCompany;

    const movements = (allMovements || []).filter(filterByCompany);
    const deadlines = (allScadenze || []).filter(filterByCompany);
    const incomeForecasts = (allPrevisioniEntrate || []).filter(filterByCompany);
    const expenseForecasts = (allPrevisioniUscite || []).filter(filterByCompany);

    const liquiditaAttuale = movements.reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
    
    let kpiStartDate, kpiEndDate;
    switch (selectedPeriod) {
        case 'quarterly': kpiStartDate = startOfQuarter(today); kpiEndDate = endOfQuarter(today); break;
        case 'semiannual': kpiStartDate = today.getMonth() < 6 ? startOfYear(today) : startOfMonth(addMonths(startOfYear(today), 6)); kpiEndDate = today.getMonth() < 6 ? endOfMonth(addMonths(startOfYear(today), 5)) : endOfYear(today); break;
        case 'annual': kpiStartDate = startOfYear(today); kpiEndDate = endOfYear(today); break;
        default: kpiStartDate = startOfMonth(today); kpiEndDate = endOfMonth(today); break;
    }
    
    const scadenzeNelPeriodo = deadlines.filter(s => isWithinInterval(parseDate(s.dataScadenza), { start: kpiStartDate, end: kpiEndDate }) && s.stato !== 'Pagato');
    const importoScadenze = scadenzeNelPeriodo.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0);

    const entratePreviste = incomeForecasts
      .filter(p => isWithinInterval(parseDate(p.dataPrevista), { start: kpiStartDate, end: kpiEndDate }))
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * p.probabilita), 0);
      
    const uscitePreviste = expenseForecasts
      .filter(p => isWithinInterval(parseDate(p.dataScadenza), { start: kpiStartDate, end: kpiEndDate }))
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * p.probabilita), 0);

    const cashFlowPrevisto = entratePreviste - (importoScadenze + uscitePreviste);

    const kpiResult: Kpi[] = [
        { title: 'Liquidità Attuale', value: formatCurrency(liquiditaAttuale), icon: 'Wallet', color: 'bg-green-100 dark:bg-green-900', textColor: 'text-green-800 dark:text-green-200' },
        { title: `Uscite Previste (${selectedPeriod})`, value: formatCurrency(importoScadenze + uscitePreviste), icon: 'AlertTriangle', color: 'bg-orange-100 dark:bg-orange-900', textColor: 'text-orange-800 dark:text-orange-200' },
        { title: `Entrate Previste (${selectedPeriod})`, value: formatCurrency(entratePreviste), icon: 'ArrowUp', color: 'bg-blue-100 dark:bg-blue-900', textColor: 'text-blue-800 dark:text-blue-200' },
        { title: `Cash Flow Previsto (${selectedPeriod})`, value: formatCurrency(cashFlowPrevisto), icon: 'TrendingUp', color: 'bg-indigo-100 dark:bg-indigo-900', textColor: 'text-indigo-800 dark:text-indigo-200' }
    ];

    const sevenDaysFromNow = addMonths(today, 3);
    const upcomingDeadlinesData = deadlines
        .filter(d => d.stato !== 'Pagato' && isWithinInterval(parseDate(d.dataScadenza), { start: startOfDay(today), end: sevenDaysFromNow }))
        .sort((a,b) => parseDate(a.dataScadenza).getTime() - parseDate(b.dataScadenza).getTime())
        .slice(0, 5);

    const overviewData = Array.from({ length: 12 }, (_, i) => {
        const monthStart = startOfMonth(new Date(today.getFullYear(), i));
        const monthEnd = endOfMonth(monthStart);
        const isPastMonth = monthStart < startOfMonth(today);
        
        let entrate = 0;
        let uscite = 0;

        if (isPastMonth) {
            movements.forEach(m => {
                if (m.anno === today.getFullYear() && parseDate(m.data).getMonth() === i) {
                    entrate += m.entrata || 0;
                    uscite += m.uscita || 0;
                }
            });
        } else {
            incomeForecasts.forEach(f => {
                if (f.anno === today.getFullYear() && parseDate(f.dataPrevista).getMonth() === i) entrate += (f.importoLordo || 0) * f.probabilita;
            });
            expenseForecasts.forEach(f => {
                if (f.anno === today.getFullYear() && parseDate(f.dataScadenza).getMonth() === i) uscite += (f.importoLordo || 0) * f.probabilita;
            });
            deadlines.forEach(d => {
                if (d.stato !== 'Pagato' && d.anno === today.getFullYear() && parseDate(d.dataScadenza).getMonth() === i) uscite += (d.importoPrevisto - d.importoPagato);
            });
        }
        return { month: new Date(today.getFullYear(), i).toLocaleString('it-IT', { month: 'short' }), entrate, uscite };
    });
    
    const yearForSummary = today.getFullYear();
    let openingBalance = movements
        .filter(m => m.anno < yearForSummary)
        .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);

    const summaryData = Array.from({ length: 12 }, (_, i) => {
        const monthStart = startOfMonth(new Date(yearForSummary, i));
        const isPastMonth = monthStart < startOfMonth(today);
        
        let monthInflows = 0;
        let monthOutflows = 0;

        if (isPastMonth) {
            movements.forEach(mov => {
                if (mov.anno === yearForSummary && parseDate(mov.data).getMonth() === i) {
                    monthInflows += mov.entrata || 0;
                    monthOutflows += mov.uscita || 0;
                }
            });
        } else {
            incomeForecasts.forEach(f => { if (f.anno === yearForSummary && parseDate(f.dataPrevista).getMonth() === i) monthInflows += (f.importoLordo || 0) * f.probabilita; });
            expenseForecasts.forEach(f => { if (f.anno === yearForSummary && parseDate(f.dataScadenza).getMonth() === i) monthOutflows += (f.importoLordo || 0) * f.probabilita; });
            deadlines.forEach(d => { if (d.stato !== 'Pagato' && d.anno === yearForSummary && parseDate(d.dataScadenza).getMonth() === i) monthOutflows += (d.importoPrevisto - d.importoPagato); });
        }
        
        const closingBalance = openingBalance + monthInflows - monthOutflows;
        const result = { month: new Date(yearForSummary, i).toLocaleString('it-IT', { month: 'long' }), starting: openingBalance, inflows: monthInflows, outflows: monthOutflows, closing: closingBalance };
        openingBalance = closingBalance;
        return result;
    });

    let cashflowBalance = liquiditaAttuale;
    const cashflowProjectionData = Array.from({ length: 12 }, (_, i) => {
        const monthDate = addMonths(today, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        let monthInflows = 0;
        let monthOutflows = 0;
        const isCurrentMonth = monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth();

        if (isCurrentMonth) {
             movements.forEach(m => { 
                if (isWithinInterval(parseDate(m.data), { start: today, end: monthEnd })) { 
                    monthInflows += m.entrata || 0; 
                    monthOutflows += m.uscita || 0; 
                } 
            });
        }
        
        incomeForecasts.forEach(f => { if (isWithinInterval(parseDate(f.dataPrevista), { start: isCurrentMonth ? today : monthStart, end: monthEnd })) monthInflows += f.importoLordo * f.probabilita; });
        expenseForecasts.forEach(f => { if (isWithinInterval(parseDate(f.dataScadenza), { start: isCurrentMonth ? today : monthStart, end: monthEnd })) monthOutflows += f.importoLordo * f.probabilita; });
        deadlines.forEach(d => { if (d.stato !== 'Pagato' && isWithinInterval(parseDate(d.dataScadenza), { start: isCurrentMonth ? today : monthStart, end: monthEnd })) monthOutflows += (d.importoPrevisto - d.importoPagato); });
        
        if (i > 0) { // For subsequent months, cashflowBalance is already the opening balance
            cashflowBalance += monthInflows - monthOutflows;
        } else { // For the first month, the change is from today's balance
             cashflowBalance = liquiditaAttuale + monthInflows - monthOutflows;
        }

        return { month: monthDate.toLocaleString('it-IT', { month: 'short' }), saldo: cashflowBalance };
    });
    
    // Recalculate cashflow balances sequentially
    let runningBalance = liquiditaAttuale;
    const finalCashflowProjection = Array.from({ length: 12 }, (_, i) => {
        const monthDate = addMonths(today, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const isCurrentMonth = monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth();

        let monthInflows = 0;
        let monthOutflows = 0;

        incomeForecasts.forEach(f => { if (isWithinInterval(parseDate(f.dataPrevista), { start: isCurrentMonth ? today : monthStart, end: monthEnd })) monthInflows += f.importoLordo * f.probabilita; });
        expenseForecasts.forEach(f => { if (isWithinInterval(parseDate(f.dataScadenza), { start: isCurrentMonth ? today : monthStart, end: monthEnd })) monthOutflows += f.importoLordo * f.probabilita; });
        deadlines.forEach(d => { if (d.stato !== 'Pagato' && isWithinInterval(parseDate(d.dataScadenza), { start: isCurrentMonth ? today : monthStart, end: monthEnd })) monthOutflows += (d.importoPrevisto - d.importoPagato); });
        
        runningBalance += monthInflows - monthOutflows;
        return { month: monthDate.toLocaleString('it-IT', { month: 'short' }), saldo: runningBalance };
    });


    return { 
        kpiData: kpiResult,
        upcomingDeadlines: upcomingDeadlinesData,
        overviewChartData: overviewData, 
        monthlySummaryData: summaryData,
        cashflowChartData: finalCashflowProjection
    };

  }, [selectedCompany, selectedPeriod, allMovements, allScadenze, allPrevisioniEntrate, allPrevisioniUscite]);


  if (isLoading) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
        <Card>
            <CardContent className="pt-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-4 w-full md:w-auto">
                    <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as Period)}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Mensile</SelectItem>
                            <SelectItem value="quarterly">Trimestrale</SelectItem>
                            <SelectItem value="semiannual">Semestrale</SelectItem>
                            <SelectItem value="annual">Annuale</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 {user && (user.role === 'admin' || user.role === 'editor') && (
                     <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Società" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Tutte">Tutte le società</SelectItem>
                            {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OverviewChart data={overviewChartData} />
        </div>
        <div className="lg:col-span-1">
          <UpcomingDeadlines deadlines={upcomingDeadlines} />
        </div>
      </div>
       <div className="grid grid-cols-1 gap-6">
         <MonthlySummaryTable data={monthlySummaryData} isLoading={isLoading} />
      </div>
       <div className="grid grid-cols-1 gap-6">
         <CashflowChart data={cashflowChartData} />
      </div>
    </div>
  );
}
