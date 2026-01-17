// src/app/(app)/dashboard/page.tsx
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';
import { endOfMonth, startOfMonth, addDays, isWithinInterval, startOfDay, addMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

import { KpiCard } from "@/components/dashboard/kpi-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { CashflowChart } from '@/components/dashboard/cashflow-chart';
import DashboardLoading from './loading';
import { MonthlySummaryTable } from '@/components/dashboard/monthly-summary-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, Kpi, CompanyProfile } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

  // Firestore Queries
  const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user]);
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user]);
  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);

  // Data fetching hooks
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
    currentMonthKpi,
    currentMonthDeadlines,
    currentMonthIncomes
  } = useMemo(() => {
    const today = new Date();
    let startDate, endDate;

    switch (selectedPeriod) {
        case 'quarterly':
            startDate = startOfQuarter(today);
            endDate = endOfQuarter(today);
            break;
        case 'semiannual':
            const currentMonth = today.getMonth(); // 0-11
            if (currentMonth < 6) { // First half
                startDate = startOfYear(today);
                endDate = endOfMonth(addMonths(startOfYear(today), 5)); // End of June
            } else { // Second half
                startDate = startOfMonth(addMonths(startOfYear(today), 6)); // Start of July
                endDate = endOfYear(today);
            }
            break;
        case 'annual':
            startDate = startOfYear(today);
            endDate = endOfYear(today);
            break;
        case 'monthly':
        default:
            startDate = startOfMonth(today);
            endDate = endOfMonth(today);
            break;
    }
    
    const filterByCompany = (item: any) => selectedCompany === 'Tutte' || item.societa === selectedCompany;

    const movimenti = (allMovements || []).filter(filterByCompany);
    const scadenze = (allScadenze || []).filter(filterByCompany);
    const previsioniEntrate = (allPrevisioniEntrate || []).filter(filterByCompany);
    const previsioniUscite = (allPrevisioniUscite || []).filter(filterByCompany);
    
    // --- GENERAL KPI CALCULATION (for selected period) ---
    const liquidita = movimenti.reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
    
    const scadenzePeriodo = scadenze.filter(s => {
        const dataScadenza = startOfDay(new Date(s.dataScadenza));
        return isWithinInterval(dataScadenza, { start: startDate, end: endDate }) && s.stato !== 'Pagato';
    });
    const importoScadenzePeriodo = scadenzePeriodo.reduce((acc, s) => acc + (s.importoPrevisto || 0) - (s.importoPagato || 0), 0);

    const previsioniEntratePeriodo = previsioniEntrate
      .filter(p => isWithinInterval(new Date(p.dataPrevista), { start: startDate, end: endDate }))
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * (p.probabilita || 0)), 0);

    const previsioniUscitePeriodo = previsioniUscite
      .filter(p => isWithinInterval(new Date(p.dataScadenza), { start: startDate, end: endDate }))
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * (p.probabilita || 0)), 0);

    const cashFlowPrevisto = liquidita + previsioniEntratePeriodo - importoScadenzePeriodo - previsioniUscitePeriodo;

    const kpiResult: Kpi[] = [
        { title: 'Liquidità Attuale', value: formatCurrency(liquidita), icon: 'Wallet', color: 'bg-green-100 dark:bg-green-900', textColor: 'text-green-800 dark:text-green-200' },
        { title: `Scadenze (${selectedPeriod})`, value: formatCurrency(importoScadenzePeriodo), icon: 'AlertTriangle', color: 'bg-orange-100 dark:bg-orange-900', textColor: 'text-orange-800 dark:text-orange-200' },
        { title: `Entrate Previste (${selectedPeriod})`, value: formatCurrency(previsioniEntratePeriodo), icon: 'ArrowUp', color: 'bg-blue-100 dark:bg-blue-900', textColor: 'text-blue-800 dark:text-blue-200' },
        { title: `Cash Flow Previsto (${selectedPeriod})`, value: formatCurrency(cashFlowPrevisto), icon: 'TrendingUp', color: 'bg-indigo-100 dark:bg-indigo-900', textColor: 'text-indigo-800 dark:text-indigo-200' }
    ];
    
    // --- CURRENT MONTH CALCULATION ---
    const inizioMeseCorrente = startOfMonth(today);
    const fineMeseCorrente = endOfMonth(today);

    const entrateMese = previsioniEntrate
      .filter(p => isWithinInterval(new Date(p.dataPrevista), { start: inizioMeseCorrente, end: fineMeseCorrente }))
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * p.probabilita), 0);

    const scadenzeMese = scadenze
      .filter(s => isWithinInterval(startOfDay(new Date(s.dataScadenza)), { start: inizioMeseCorrente, end: fineMeseCorrente }) && s.stato !== 'Pagato')
      .reduce((acc, s) => acc + (s.importoPrevisto || 0) - (s.importoPagato || 0), 0);
      
    const previsioniUsciteMese = previsioniUscite
      .filter(p => isWithinInterval(new Date(p.dataScadenza), { start: inizioMeseCorrente, end: fineMeseCorrente }) && p.stato !== 'Pagato')
      .reduce((acc, p) => acc + ((p.importoLordo || 0) * p.probabilita), 0);

    const usciteMese = scadenzeMese + previsioniUsciteMese;

    const cmKpi = [
        { title: 'Entrate Previste (Mese)', value: formatCurrency(entrateMese) },
        { title: 'Uscite Previste (Mese)', value: formatCurrency(usciteMese) },
    ];
    
    const cmDeadlines = scadenze.filter(s => isWithinInterval(startOfDay(new Date(s.dataScadenza)), { start: inizioMeseCorrente, end: fineMeseCorrente }));
    const cmIncomes = previsioniEntrate.filter(p => isWithinInterval(new Date(p.dataPrevista), { start: inizioMeseCorrente, end: fineMeseCorrente }));


    return { kpiData: kpiResult, currentMonthKpi: cmKpi, currentMonthDeadlines: cmDeadlines, currentMonthIncomes: cmIncomes };
  }, [selectedCompany, selectedPeriod, allMovements, allScadenze, allPrevisioniEntrate, allPrevisioniUscite]);


  const allDataFiltered = useMemo(() => {
    const filterByCompany = (item: any) => selectedCompany === 'Tutte' || item.societa === selectedCompany;
    return {
        movements: (allMovements || []).filter(filterByCompany),
        incomeForecasts: (allPrevisioniEntrate || []).filter(filterByCompany),
        expenseForecasts: (allPrevisioniUscite || []).filter(filterByCompany),
        deadlines: (allScadenze || []).filter(filterByCompany),
    }
  }, [selectedCompany, allMovements, allPrevisioniEntrate, allPrevisioniUscite, allScadenze]);


  if (isLoading) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex flex-col gap-6">
        {/* --- FILTERS --- */}
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

      {/* --- PERIOD KPI CARDS --- */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} data={kpi} />
        ))}
      </div>

      {/* --- CURRENT MONTH FOCUS --- */}
      <Card>
        <CardHeader>
            <CardTitle>Focus Mese Corrente</CardTitle>
            <CardDescription>Riepilogo e dettagli per il mese in corso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {currentMonthKpi.map(kpi => (
                    <div key={kpi.title} className="p-4 border rounded-lg">
                        <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                        <p className="text-2xl font-bold">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div>
                    <h3 className="font-semibold mb-2">Scadenze del Mese</h3>
                    <div className="border rounded-lg max-h-60 overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead>Stato</TableHead><TableHead className="text-right">Importo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentMonthDeadlines.length > 0 ? currentMonthDeadlines.map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell>{formatDate(d.dataScadenza)}</TableCell>
                                        <TableCell>{d.descrizione}</TableCell>
                                        <TableCell><Badge variant={d.stato === 'Pagato' ? 'secondary' : 'default'}>{d.stato}</Badge></TableCell>
                                        <TableCell className="text-right">{formatCurrency(d.importoPrevisto - d.importoPagato)}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">Nessuna scadenza questo mese.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                 <div>
                    <h3 className="font-semibold mb-2">Incassi Previsti del Mese</h3>
                     <div className="border rounded-lg max-h-60 overflow-auto">
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead>Stato</TableHead><TableHead className="text-right">Importo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentMonthIncomes.length > 0 ? currentMonthIncomes.map(i => (
                                    <TableRow key={i.id}>
                                        <TableCell>{formatDate(i.dataPrevista)}</TableCell>
                                        <TableCell>{i.descrizione}</TableCell>
                                        <TableCell><Badge variant={i.stato === 'Incassato' ? 'secondary' : 'default'}>{i.stato}</Badge></TableCell>
                                        <TableCell className="text-right">{formatCurrency(i.importoLordo)}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">Nessun incasso previsto questo mese.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <OverviewChart data={allDataFiltered} />
        </div>
      </div>
       <div className="grid grid-cols-1 gap-6">
         <MonthlySummaryTable allData={allDataFiltered} isLoading={isLoading} />
      </div>
       <div className="grid grid-cols-1 gap-6">
         <CashflowChart data={allDataFiltered} />
      </div>
    </div>
  );
}
