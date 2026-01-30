// src/app/(app)/previsioni/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ForecastComparison } from '@/components/previsioni/forecast-comparison';
import { AiCashflowAgent } from '@/components/previsioni/ai-cashflow-agent';
import { YEARS } from '@/lib/constants';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, CompanyProfile } from '@/lib/types';
import { IncomeForecasts } from '@/components/previsioni/income-forecasts';
import { ExpenseForecasts } from '@/components/previsioni/expense-forecasts';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { CashflowDetail } from '@/components/previsioni/cashflow-detail';
import { parseDate } from '@/lib/utils';
import { startOfMonth, endOfMonth, addMonths, isWithinInterval } from 'date-fns';


const getQuery = (firestore: any, user: AppUser | null, company: string, collectionName: string) => {
    if (!firestore || !user) return null;

    let q = collection(firestore, collectionName) as CollectionReference<DocumentData>;

    const role = user.role;
    const userCompany = user.company;

    if (role === 'admin' || role === 'editor') {
        if (company !== 'Tutte') {
            return query(q, where('societa', '==', company));
        }
    } else if (role === 'company' || role === 'company-editor') {
        if (!userCompany) return null;
        return query(q, where('societa', '==', userCompany));
    }
    
    return query(q);
}

export default function PrevisioniPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const availableYears = useMemo(() => YEARS.filter(y => typeof y === 'number') as number[], []);
  const currentYear = new Date().getFullYear();

  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
  const [mainYear, setMainYear] = useState<number>(currentYear);
  const [comparisonYear, setComparisonYear] = useState<number | null>(availableYears.includes(currentYear - 1) ? currentYear - 1 : null);

  useEffect(() => {
    if (user?.role === 'company' && user.company) {
      setSelectedCompany(user.company);
    } else if (user?.role === 'company-editor' && user.company) {
        setSelectedCompany(user.company);
    }
  }, [user]);

  const handleMainYearChange = (yearValue: string) => {
    const year = Number(yearValue);
    setMainYear(year);
    if (comparisonYear !== null && year <= comparisonYear) {
      const newComparisonYear = year - 1;
      if (availableYears.includes(newComparisonYear)) {
        setComparisonYear(newComparisonYear);
      } else {
        setComparisonYear(null);
      }
    }
  };

  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'incomeForecasts'), [firestore, user, selectedCompany]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'expenseForecasts'), [firestore, user, selectedCompany]);
  const movimentiQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'movements'), [firestore, user, selectedCompany]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'deadlines'), [firestore, user, selectedCompany]);
  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  
  const { data: movimenti, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: previsioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  const { data: scadenze, isLoading: isLoadingScadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);
  
  const isLoading = isLoadingMovements || isLoadingIncome || isLoadingExpenses || isLoadingScadenze || isLoadingCompanies;

  const {
    totals,
    monthlyComparisonData,
    categoryComparisonData,
    cashflowDetailData,
    cashflowChartData
  } = useMemo(() => {
    
    const getYearData = (year: number | null) => {
        if (year === null) return null;

        const yearMovements = (movimenti || []).filter(mov => mov.anno === year);
        const yearIncomeForecasts = (previsioniEntrate || []).filter(f => f.anno === year);
        const yearExpenseForecasts = (previsioniUscite || []).filter(f => f.anno === year);
        const yearDeadlines = (scadenze || []).filter(d => d.anno === year);

        // --- CONSUNTIVO (ACTUALS) ---
        const incomeConsuntivo = yearMovements.reduce((acc, mov) => acc + (mov.entrata || 0), 0);
        const expenseConsuntivo = yearMovements.reduce((acc, mov) => acc + (mov.uscita || 0), 0);

        // --- PREVISTO (FORECASTS) ---
        const incomePrevisto = yearIncomeForecasts
            .filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato')
            .reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0);
        
        const expensePrevisto = 
            yearExpenseForecasts
                .filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato')
                .reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0)
            + 
            yearDeadlines
                .filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato')
                .reduce((acc, d) => acc + (d.importoPrevisto - (d.importoPagato || 0)), 0);

        // --- MONTHLY DATA ---
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const monthStart = startOfMonth(new Date(year, i));
            const monthEnd = endOfMonth(monthStart);
            
            const entrateConsuntivo = yearMovements
                .filter(m => parseDate(m.data).getMonth() === i)
                .reduce((acc, m) => acc + (m.entrata || 0), 0);

            const usciteConsuntivo = yearMovements
                .filter(m => parseDate(m.data).getMonth() === i)
                .reduce((acc, m) => acc + (m.uscita || 0), 0);

            const entratePrevisto = yearIncomeForecasts
                .filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato' && parseDate(f.dataPrevista).getMonth() === i)
                .reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0);
            
            const uscitePrevisto = 
                yearExpenseForecasts
                    .filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato' && parseDate(f.dataScadenza).getMonth() === i)
                    .reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0)
                + 
                yearDeadlines
                    .filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato' && parseDate(d.dataScadenza).getMonth() === i)
                    .reduce((acc, d) => acc + (d.importoPrevisto - (d.importoPagato || 0)), 0);

            return {
                month: new Date(year, i).toLocaleString('it-IT', { month: 'short' }),
                entrateConsuntivo,
                usciteConsuntivo,
                entratePrevisto,
                uscitePrevisto
            };
        });

        // --- CATEGORY DATA (Consuntivo + Previsto combined for charts) ---
        const categoryIncome: { [key: string]: number } = {};
        yearMovements.forEach(m => { if (m.entrata > 0) categoryIncome[m.categoria] = (categoryIncome[m.categoria] || 0) + m.entrata; });
        yearIncomeForecasts.filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato').forEach(f => {
            categoryIncome[f.categoria] = (categoryIncome[f.categoria] || 0) + ((f.importoLordo || 0) * f.probabilita);
        });

        const categoryExpense: { [key: string]: number } = {};
        yearMovements.forEach(m => { if (m.uscita > 0) categoryExpense[m.categoria] = (categoryExpense[m.categoria] || 0) + m.uscita; });
        yearExpenseForecasts.filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato').forEach(f => {
            categoryExpense[f.categoria] = (categoryExpense[f.categoria] || 0) + ((f.importoLordo || 0) * f.probabilita);
        });
        yearDeadlines.filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato').forEach(d => {
            categoryExpense[d.categoria] = (categoryExpense[d.categoria] || 0) + (d.importoPrevisto - (d.importoPagato || 0));
        });

        return { incomeConsuntivo, expenseConsuntivo, incomePrevisto, expensePrevisto, monthlyData, categoryIncome, categoryExpense };
    };

    const mainYearCalculatedData = getYearData(mainYear);
    const comparisonYearCalculatedData = getYearData(comparisonYear);

    // --- Data for KPI Cards ---
    const totals = {
        [`entrateConsuntivo${mainYear}`]: mainYearCalculatedData?.incomeConsuntivo || 0,
        [`usciteConsuntivo${mainYear}`]: mainYearCalculatedData?.expenseConsuntivo || 0,
        [`entratePrevisto${mainYear}`]: mainYearCalculatedData?.incomePrevisto || 0,
        [`uscitePrevisto${mainYear}`]: mainYearCalculatedData?.expensePrevisto || 0,
        [`entrateConsuntivo${comparisonYear}`]: comparisonYearCalculatedData?.incomeConsuntivo || 0,
        [`usciteConsuntivo${comparisonYear}`]: comparisonYearCalculatedData?.expenseConsuntivo || 0,
    };
    
    // --- Data for Monthly Bar Chart ---
    const monthlyComparisonData = mainYearCalculatedData?.monthlyData.map((mainMonth, i) => {
      const compMonth = comparisonYearCalculatedData?.monthlyData[i];
      return {
        month: mainMonth.month,
        [`entrate${mainYear}`]: mainMonth.entrateConsuntivo,
        [`uscite${mainYear}`]: mainMonth.usciteConsuntivo,
        [`entrate${comparisonYear}`]: compMonth?.entrateConsuntivo || 0,
        [`uscite${comparisonYear}`]: compMonth?.usciteConsuntivo || 0,
        ...mainMonth
      }
    }) || [];

    // --- Data for Category Tables and Pie Charts ---
    const allIncomeCategories = new Set([
        ...Object.keys(mainYearCalculatedData?.categoryIncome || {}), 
        ...Object.keys(comparisonYearCalculatedData?.categoryIncome || {})
    ]);
    const allExpenseCategories = new Set([
        ...Object.keys(mainYearCalculatedData?.categoryExpense || {}), 
        ...Object.keys(comparisonYearCalculatedData?.categoryExpense || {})
    ]);

    const categoryComparisonData = {
        income: Array.from(allIncomeCategories).map(cat => ({
            category: cat,
            totalMain: mainYearCalculatedData?.categoryIncome[cat] || 0,
            totalComparison: comparisonYearCalculatedData?.categoryIncome[cat] || 0,
        })).sort((a,b) => b.totalMain - a.totalMain),
        expense: Array.from(allExpenseCategories).map(cat => ({
            category: cat,
            totalMain: mainYearCalculatedData?.categoryExpense[cat] || 0,
            totalComparison: comparisonYearCalculatedData?.categoryExpense[cat] || 0,
        })).sort((a,b) => b.totalMain - a.totalMain),
    };
    
    // --- Data for Cashflow Detail Table ---
    const cashflowDetailData = (() => {
        let openingBalance = (movimenti || [])
            .filter(m => (m.anno < mainYear) && (selectedCompany === 'Tutte' || m.societa === selectedCompany))
            .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
        
        return (mainYearCalculatedData?.monthlyData || []).map(month => {
            const monthInflows = month.entrateConsuntivo + month.entratePrevisto;
            const monthOutflows = month.usciteConsuntivo + month.uscitePrevisto;
            const closingBalance = openingBalance + monthInflows - monthOutflows;
            const result = {
                month: new Date(mainYear, mainYearCalculatedData.monthlyData.indexOf(month)).toLocaleString('it-IT', { month: 'long' }),
                starting: openingBalance,
                inflows: monthInflows,
                outflows: monthOutflows,
                closing: closingBalance,
            };
            openingBalance = closingBalance;
            return result;
        });
    })();
    
    // --- Data for Cashflow Projection Chart ---
    const cashflowChartData = (() => {
      const today = new Date();
      const liquiditaAttuale = (movimenti || [])
        .filter(m => (selectedCompany === 'Tutte' || m.societa === selectedCompany))
        .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);

      let runningBalance = liquiditaAttuale;
      return Array.from({ length: 12 }, (_, i) => {
          const monthDate = addMonths(today, i);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const isCurrentMonth = monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth();

          const filterDateRange = { start: isCurrentMonth ? today : monthStart, end: monthEnd };

          const monthInflows = (previsioniEntrate || [])
              .filter(f => (selectedCompany === 'Tutte' || f.societa === selectedCompany) && f.stato !== 'Incassato' && f.stato !== 'Annullato' && isWithinInterval(parseDate(f.dataPrevista), filterDateRange))
              .reduce((acc, f) => acc + (f.importoLordo * f.probabilita), 0);
          
          const monthOutflows = 
              (previsioniUscite || [])
                  .filter(f => (selectedCompany === 'Tutte' || f.societa === selectedCompany) && f.stato !== 'Pagato' && f.stato !== 'Annullato' && isWithinInterval(parseDate(f.dataScadenza), filterDateRange))
                  .reduce((acc, f) => acc + (f.importoLordo * f.probabilita), 0)
              +
              (scadenze || [])
                  .filter(d => (selectedCompany === 'Tutte' || d.societa === selectedCompany) && d.stato !== 'Pagato' && d.stato !== 'Annullato' && isWithinInterval(parseDate(d.dataScadenza), filterDateRange))
                  .reduce((acc, d) => acc + (d.importoPrevisto - d.importoPagato), 0);
          
          runningBalance += monthInflows - monthOutflows;
          return { month: monthDate.toLocaleString('it-IT', { month: 'short' }), saldo: runningBalance };
      });
    })();

    return { totals, monthlyComparisonData, categoryComparisonData, cashflowDetailData, cashflowChartData };
  }, [mainYear, comparisonYear, selectedCompany, movimenti, previsioniEntrate, previsioniUscite, scadenze]);

  const allData = useMemo(() => ({
    movements: movimenti || [],
    incomeForecasts: previsioniEntrate || [],
    expenseForecasts: previsioniUscite || [],
    deadlines: scadenze || [],
  }), [movimenti, previsioniEntrate, previsioniUscite, scadenze]);
  
  // CRUD Handlers
  const handleAddIncomeForecast = async (forecast: Omit<PrevisioneEntrata, 'id'>) => {
    if (!firestore || !user) return;
    try {
        await addDoc(collection(firestore, 'incomeForecasts'), {
            ...forecast,
            createdBy: user.uid,
            createdAt: new Date().toISOString()
        });
        toast({ title: 'Previsione Aggiunta', description: 'La nuova previsione di entrata è stata salvata.' });
    } catch(e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare la previsione.' });
        console.error(e);
    }
  };

  const handleEditIncomeForecast = async (forecast: PrevisioneEntrata) => {
     if (!firestore || !user || !forecast.id) return;
     try {
        const docRef = doc(firestore, 'incomeForecasts', forecast.id);
        const { id, ...dataToUpdate } = forecast;
        await updateDoc(docRef, { ...dataToUpdate, updatedAt: new Date().toISOString() });
        toast({ title: 'Previsione Aggiornata', description: 'La previsione di entrata è stata modificata.' });
    } catch(e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare la previsione.' });
        console.error(e);
    }
  };
  
  const handleDeleteIncomeForecast = async (forecastId: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'incomeForecasts', forecastId));
        toast({ title: 'Previsione Eliminata', description: 'La previsione di entrata è stata eliminata.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare la previsione.' });
        console.error(e);
    }
  };

  const handleAddExpenseForecast = async (forecast: Omit<PrevisioneUscita, 'id'>) => {
    if (!firestore || !user) return;
    try {
        await addDoc(collection(firestore, 'expenseForecasts'), {
            ...forecast,
            createdBy: user.uid,
            createdAt: new Date().toISOString()
        });
        toast({ title: 'Previsione Aggiunta', description: 'La nuova previsione di uscita è stata salvata.' });
    } catch(e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare la previsione.' });
        console.error(e);
    }
  };

  const handleEditExpenseForecast = async (forecast: PrevisioneUscita) => {
     if (!firestore || !user || !forecast.id) return;
     try {
        const docRef = doc(firestore, 'expenseForecasts', forecast.id);
        const { id, ...dataToUpdate } = forecast;
        await updateDoc(docRef, { ...dataToUpdate, updatedAt: new Date().toISOString() });
        toast({ title: 'Previsione Aggiornata', description: 'La previsione di uscita è stata modificata.' });
    } catch(e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare la previsione.' });
        console.error(e);
    }
  };

   const handleDeleteExpenseForecast = async (forecastId: string, type: 'previsione' | 'scadenza') => {
    if (!firestore) return;
    const collectionName = type === 'previsione' ? 'expenseForecasts' : 'deadlines';
    const toastTitle = type === 'previsione' ? 'Previsione Eliminata' : 'Scadenza Eliminata';
    try {
        await deleteDoc(doc(firestore, collectionName, forecastId));
        toast({ title: toastTitle, description: `L'elemento è stato eliminato.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: "Impossibile eliminare l'elemento." });
        console.error(e);
    }
  };
  

  const combinedExpenseData = useMemo(() => {
    const fromForecasts = (previsioniUscite || []).map(f => ({ ...f, type: 'previsione' as const }));
    
    const fromDeadlines = (scadenze || [])
        .filter(s => s.stato !== 'Pagato')
        .map(s => ({
            id: s.id,
            type: 'scadenza' as const,
            societa: s.societa,
            anno: s.anno,
            descrizione: s.descrizione,
            dataScadenza: s.dataScadenza,
            importoLordo: s.importoPrevisto - s.importoPagato,
            probabilita: 1.0, 
            stato: s.stato,
            categoria: s.categoria
        }));

    return [...fromForecasts, ...fromDeadlines];
  }, [previsioniUscite, scadenze]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Previsioni e Analisi</h1>
          <p className="text-muted-foreground">
            Analizza i trend, proietta la liquidità e gestisci le previsioni di entrate e uscite.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
           {user && (user.role === 'admin' || user.role === 'editor') && (
            <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Società" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutte">Tutte le società</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
           )}
           <div className="flex items-center gap-2 w-full">
            <Select value={String(mainYear)} onValueChange={handleMainYearChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
              </SelectContent>
            </Select>
             <span className="text-muted-foreground font-medium">vs</span>
             <Select value={comparisonYear ? String(comparisonYear) : 'none'} onValueChange={(v) => setComparisonYear(v === 'none' ? null : Number(v))}>
                <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Confronto" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {availableYears.filter(y => y < mainYear).map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
                </SelectContent>
            </Select>
           </div>
        </div>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="entrate">Entrate</TabsTrigger>
          <TabsTrigger value="uscite">Uscite</TabsTrigger>
          <TabsTrigger value="agente-ai">Agente AI</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <ForecastComparison 
            mainYear={mainYear} 
            comparisonYear={comparisonYear}
            isLoading={isLoading}
            totals={totals}
            monthlyComparisonData={monthlyComparisonData}
            categoryComparisonData={categoryComparisonData}
            cashflowChartData={cashflowChartData}
          />
        </TabsContent>
        <TabsContent value="cashflow">
            <CashflowDetail 
                isLoading={isLoading}
                data={cashflowDetailData}
                year={mainYear}
            />
        </TabsContent>
        <TabsContent value="entrate">
           <IncomeForecasts
              data={previsioniEntrate || []}
              year={mainYear}
              isLoading={isLoadingIncome}
              onAdd={handleAddIncomeForecast}
              onEdit={handleEditIncomeForecast}
              onDelete={handleDeleteIncomeForecast}
              defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany as 'LNC' | 'STG' : user?.company as 'LNC' | 'STG'}
              currentUser={user!}
          />
        </TabsContent>
        <TabsContent value="uscite">
          <ExpenseForecasts
              data={combinedExpenseData}
              year={mainYear}
              isLoading={isLoadingExpenses || isLoadingScadenze}
              onAdd={handleAddExpenseForecast}
              onEdit={handleEditExpenseForecast}
              onDelete={handleDeleteExpenseForecast}
              defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany as 'LNC' | 'STG' : user?.company as 'LNC' | 'STG'}
              currentUser={user!}
          />
        </TabsContent>
        <TabsContent value="agente-ai">
            <AiCashflowAgent 
                company={selectedCompany}
                allData={allData}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
}
