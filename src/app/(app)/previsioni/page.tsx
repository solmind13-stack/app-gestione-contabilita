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

  const forecastComparisonData = useMemo(() => {
    const getYearlyTotals = (year: number) => {
      let totalIncomeConsuntivo = 0;
      let totalExpenseConsuntivo = 0;
      let totalIncomePrevisto = 0;
      let totalExpensePrevisto = 0;

      const categoryIncome: { [key: string]: number } = {};
      const categoryExpense: { [key: string]: number } = {};

      const monthlyData = Array.from({ length: 12 }, () => ({
          entrateConsuntivo: 0,
          usciteConsuntivo: 0,
          entratePrevisto: 0,
          uscitePrevisto: 0,
      }));

      const today = new Date();
      const currentYear = today.getFullYear();
      
      const yearMovements = (movimenti || []).filter(mov => mov.anno === year);
      const yearIncomeForecasts = (previsioniEntrate || []).filter(f => f.anno === year);
      const yearExpenseForecasts = (previsioniUscite || []).filter(f => f.anno === year);
      const yearDeadlines = (scadenze || []).filter(d => d.anno === year);

      // CALCOLO CONSUNTIVO
      yearMovements.forEach(mov => {
          const income = mov.entrata || 0;
          const expense = mov.uscita || 0;
          totalIncomeConsuntivo += income;
          totalExpenseConsuntivo += expense;
          if (income > 0) categoryIncome[mov.categoria] = (categoryIncome[mov.categoria] || 0) + income;
          if (expense > 0) categoryExpense[mov.categoria] = (categoryExpense[mov.categoria] || 0) + expense;
          
          const movDate = parseDate(mov.data);
          if (movDate.getFullYear() === year) {
            const monthIndex = movDate.getMonth();
            monthlyData[monthIndex].entrateConsuntivo += income;
            monthlyData[monthIndex].usciteConsuntivo += expense;
          }
      });
      
      // CALCOLO PREVISTO
      const calculateForecast = (monthIndex: number) => {
          const monthStart = startOfMonth(new Date(year, monthIndex));
          const monthEnd = endOfMonth(monthStart);
          let monthIncome = 0;
          let monthExpense = 0;
          
          // Future and current months use forecasts
          if (year > currentYear || (year === currentYear && monthIndex >= today.getMonth())) {
              yearIncomeForecasts.forEach(f => {
                  if (parseDate(f.dataPrevista).getMonth() === monthIndex && f.stato !== 'Incassato') {
                      const weightedIncome = (f.importoLordo || 0) * f.probabilita;
                      monthIncome += weightedIncome;
                      if (!categoryIncome[f.categoria]) categoryIncome[f.categoria] = 0;
                      categoryIncome[f.categoria] += weightedIncome;
                  }
              });

              yearExpenseForecasts.forEach(f => {
                  if (parseDate(f.dataScadenza).getMonth() === monthIndex && f.stato !== 'Pagato') {
                      const weightedExpense = (f.importoLordo || 0) * f.probabilita;
                      monthExpense += weightedExpense;
                      if (!categoryExpense[f.categoria]) categoryExpense[f.categoria] = 0;
                      categoryExpense[f.categoria] += weightedExpense;
                  }
              });

              yearDeadlines.forEach(d => {
                  if (parseDate(d.dataScadenza).getMonth() === monthIndex && d.stato !== 'Pagato') {
                      const remainingAmount = d.importoPrevisto - d.importoPagato;
                      monthExpense += remainingAmount;
                      if (!categoryExpense[d.categoria]) categoryExpense[d.categoria] = 0;
                      categoryExpense[d.categoria] += remainingAmount;
                  }
              });
          }
          return { monthIncome, monthExpense };
      };
      
      for (let i = 0; i < 12; i++) {
        const { monthIncome, monthExpense } = calculateForecast(i);
        monthlyData[i].entratePrevisto = monthIncome;
        monthlyData[i].uscitePrevisto = monthExpense;
        totalIncomePrevisto += monthIncome;
        totalExpensePrevisto += monthExpense;
      }
      
      return {
          totalIncomeConsuntivo,
          totalExpenseConsuntivo,
          totalIncomePrevisto,
          totalExpensePrevisto,
          monthlyData,
          categoryIncome,
          categoryExpense,
      };
    };

    const mainYearData = getYearlyTotals(mainYear);
    const comparisonYearData = comparisonYear ? getYearlyTotals(comparisonYear) : null;

    const totals: { [key: string]: number } = {
        [`entrateConsuntivo${mainYear}`]: mainYearData.totalIncomeConsuntivo,
        [`usciteConsuntivo${mainYear}`]: mainYearData.totalExpenseConsuntivo,
        [`entratePrevisto${mainYear}`]: mainYearData.totalIncomePrevisto,
        [`uscitePrevisto${mainYear}`]: mainYearData.totalExpensePrevisto,
    };
    if (comparisonYear && comparisonYearData) {
        totals[`entrateConsuntivo${comparisonYear}`] = comparisonYearData.totalIncomeConsuntivo;
        totals[`usciteConsuntivo${comparisonYear}`] = comparisonYearData.totalExpenseConsuntivo;
    }

    const chartData = mainYearData.monthlyData.map((month, i) => ({
      month: new Date(mainYear, i).toLocaleString('it-IT', { month: 'short' }),
      ...month
    }));
    
    const comparisonChartData = mainYearData.monthlyData.map((month, i) => {
      const compMonthData = comparisonYearData ? comparisonYearData.monthlyData[i] : {entrateConsuntivo: 0, usciteConsuntivo: 0};
      return {
        month: new Date(mainYear, i).toLocaleString('it-IT', { month: 'short' }),
        [`entrate${mainYear}`]: month.entrateConsuntivo,
        [`uscite${mainYear}`]: month.usciteConsuntivo,
        [`entrate${comparisonYear}`]: compMonthData.entrateConsuntivo,
        [`uscite${comparisonYear}`]: compMonthData.usciteConsuntivo,
      }
    });

    const allIncomeCategories = new Set([...Object.keys(mainYearData.categoryIncome || {}), ...Object.keys(comparisonYearData?.categoryIncome || {})]);
    const allExpenseCategories = new Set([...Object.keys(mainYearData.categoryExpense || {}), ...Object.keys(comparisonYearData?.categoryExpense || {})]);

    const combinedIncomeTotals = Array.from(allIncomeCategories).map(cat => ({
        category: cat,
        totalMain: mainYearData.categoryIncome?.[cat] || 0,
        totalComparison: comparisonYearData?.categoryIncome?.[cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);

    const combinedExpenseTotals = Array.from(allExpenseCategories).map(cat => ({
        category: cat,
        totalMain: mainYearData.categoryExpense?.[cat] || 0,
        totalComparison: comparisonYearData?.categoryExpense?.[cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);

    return { 
        chartData, 
        totals,
        categoryTotals: { income: combinedIncomeTotals, expense: combinedExpenseTotals },
        comparisonChartData,
    };
  }, [mainYear, comparisonYear, movimenti, previsioniEntrate, previsioniUscite, scadenze]);

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
  
  const allData = useMemo(() => ({
    movements: movimenti || [],
    incomeForecasts: previsioniEntrate || [],
    expenseForecasts: previsioniUscite || [],
    deadlines: scadenze || [],
  }), [movimenti, previsioniEntrate, previsioniUscite, scadenze]);

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
             <Select value={comparisonYear ? String(comparisonYear) : ''} onValueChange={(v) => setComparisonYear(Number(v) || null)}>
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
            {...forecastComparisonData}
          />
        </TabsContent>
        <TabsContent value="cashflow">
            <CashflowDetail 
                year={mainYear}
                company={selectedCompany}
                allData={allData}
                isLoading={isLoading}
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
