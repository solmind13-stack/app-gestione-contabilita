// src/app/(app)/previsioni/page.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData, addDoc, updateDoc, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ForecastComparison } from '@/components/previsioni/forecast-comparison';
import { AiCashflowAgent } from '@/components/previsioni/ai-cashflow-agent';
import { YEARS } from '@/lib/constants';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, CompanyProfile } from '@/lib/types';
import { IncomeForecasts } from '@/components/previsioni/income-forecasts';
import { ExpenseForecasts } from '@/components/previsioni/expense-forecasts';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashflowDetail } from '@/components/previsioni/cashflow-detail';
import { formatCurrency, parseDate } from '@/lib/utils';
import { startOfMonth } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';


const getQuery = (firestore: any, user: AppUser | null, collectionName: string) => {
    if (!firestore || !user) return null;
    let q = collection(firestore, collectionName) as CollectionReference<DocumentData>;
    if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        return query(q, where('societa', '==', user.company));
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
  const [selectedYear, setSelectedYear] = useState<string>('Tutti');
  const [comparisonYear, setComparisonYear] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'company' || user?.role === 'company-editor') {
      setSelectedCompany(user.company!);
    }
  }, [user]);

  const handleMainYearChange = (yearValue: string) => {
    setSelectedYear(yearValue);
    if (comparisonYear !== null && yearValue !== 'Tutti' && Number(yearValue) <= Number(comparisonYear)) {
      setComparisonYear(null);
    }
  };

  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user]);
  const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user]);
  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  
  const { data: allPrevisioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: allPrevisioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  const { data: allMovements, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: allScadenze, isLoading: isLoadingScadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);
  
  const isLoading = isLoadingMovements || isLoadingIncome || isLoadingExpenses || isLoadingScadenze || isLoadingCompanies;

  const filterByCompany = useCallback((item: any) => selectedCompany === 'Tutte' || item.societa === selectedCompany, [selectedCompany]);

  const {
    summaryTotals,
    monthlyComparisonData,
    categoryComparisonData,
    cashflowDetailData,
    pieIncomeData,
    pieExpenseData,
    analysisYear,
    isAllYearsSelected,
  } = useMemo(() => {
    // --- 1. TOTALI CUMULATIVI "SINO AD OGGI" (per i riquadri di riepilogo) ---
    const today = new Date();
    const movementsSinoAdOggi = (allMovements || []).filter(filterByCompany).filter(m => parseDate(m.data) <= today);
    
    const summaryEntrateConsuntivo = movementsSinoAdOggi.reduce((acc, mov) => acc + (mov.entrata || 0), 0);
    const summaryUsciteConsuntivo = movementsSinoAdOggi.reduce((acc, mov) => acc + (mov.uscita || 0), 0);

    const summaryEntratePrevisto = (allPrevisioniEntrate || [])
        .filter(filterByCompany)
        .filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato')
        .reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0);
    
    const summaryUscitePrevisto = 
        ((allPrevisioniUscite || [])
            .filter(filterByCompany)
            .filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato')
            .reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0))
        + 
        ((allScadenze || [])
            .filter(filterByCompany)
            .filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato')
            .reduce((acc, d) => acc + (d.importoPrevisto - (d.importoPagato || 0)), 0));

    const summaryTotals = {
        entrateConsuntivo: summaryEntrateConsuntivo,
        usciteConsuntivo: summaryUsciteConsuntivo,
        entratePrevisto: summaryEntratePrevisto,
        uscitePrevisto: summaryUscitePrevisto,
    };
    
    // --- 2. DATI PER ANALISI SPECIFICA (per grafici e tabelle) ---
    const isAllYears = selectedYear === 'Tutti';
    const yearForCharts = isAllYears ? currentYear : Number(selectedYear);
    const comparisonYearForCharts = comparisonYear ? Number(comparisonYear) : null;

    const getYearData = (year: number | null, allTime = false) => {
        if (!allTime && year === null) return {
            incomeConsuntivo: 0, expenseConsuntivo: 0, incomePrevisto: 0, expensePrevisto: 0,
            monthlyData: Array(12).fill({}), categoryIncome: {}, categoryExpense: {}
        };
        
        const yearMovements = (allMovements || []).filter(filterByCompany).filter(mov => allTime || mov.anno === year);
        const yearIncomeForecasts = (allPrevisioniEntrate || []).filter(filterByCompany).filter(f => allTime || f.anno === year);
        const yearExpenseForecasts = (allPrevisioniUscite || []).filter(filterByCompany).filter(f => allTime || f.anno === year);
        const yearDeadlines = (allScadenze || []).filter(filterByCompany).filter(d => allTime || d.anno === year);
        
        const incomeConsuntivo = yearMovements.reduce((acc, mov) => acc + (mov.entrata || 0), 0);
        const expenseConsuntivo = yearMovements.reduce((acc, mov) => acc + (mov.uscita || 0), 0);

        const incomePrevisto = yearIncomeForecasts.filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato').reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0);
        const expensePrevisto = yearExpenseForecasts.filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato').reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0) + yearDeadlines.filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato').reduce((acc, d) => acc + (d.importoPrevisto - (d.importoPagato || 0)), 0);

        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const currentAnalyzingYear = allTime ? currentYear : year as number;
            const isPastMonth = new Date(currentAnalyzingYear, i, 1) < startOfMonth(new Date());
            
            let entrateConsuntivo = 0;
            let usciteConsuntivo = 0;
            
            if (isPastMonth || currentAnalyzingYear < new Date().getFullYear()) {
                 entrateConsuntivo = yearMovements.filter(m => m.anno === currentAnalyzingYear).filter(m => parseDate(m.data).getMonth() === i).reduce((acc, m) => acc + (m.entrata || 0), 0);
                 usciteConsuntivo = yearMovements.filter(m => m.anno === currentAnalyzingYear).filter(m => parseDate(m.data).getMonth() === i).reduce((acc, m) => acc + (m.uscita || 0), 0);
            }
            
            const entratePrevisto = yearIncomeForecasts.filter(f => f.anno === currentAnalyzingYear).filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato' && parseDate(f.dataPrevista).getMonth() === i).reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0);
            const uscitePrevisto = yearExpenseForecasts.filter(f => f.anno === currentAnalyzingYear).filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato' && parseDate(f.dataScadenza).getMonth() === i).reduce((acc, f) => acc + ((f.importoLordo || 0) * f.probabilita), 0) + yearDeadlines.filter(d => d.anno === currentAnalyzingYear).filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato' && parseDate(d.dataScadenza).getMonth() === i).reduce((acc, d) => acc + (d.importoPrevisto - (d.importoPagato || 0)), 0);

            return { month: new Date(currentAnalyzingYear, i).toLocaleString('it-IT', { month: 'short' }), entrateConsuntivo, usciteConsuntivo, entratePrevisto, uscitePrevisto };
        });

        const categoryIncome: { [key: string]: number } = {};
        yearMovements.forEach(m => { if (m.entrata > 0) categoryIncome[m.categoria] = (categoryIncome[m.categoria] || 0) + m.entrata; });
        yearIncomeForecasts.filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato').forEach(f => { categoryIncome[f.categoria] = (categoryIncome[f.categoria] || 0) + ((f.importoLordo || 0) * f.probabilita); });

        const categoryExpense: { [key: string]: number } = {};
        yearMovements.forEach(m => { if (m.uscita > 0) categoryExpense[m.categoria] = (categoryExpense[m.categoria] || 0) + m.uscita; });
        yearExpenseForecasts.filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato').forEach(f => { categoryExpense[f.categoria] = (categoryExpense[f.categoria] || 0) + ((f.importoLordo || 0) * f.probabilita); });
        yearDeadlines.filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato').forEach(d => { categoryExpense[d.categoria] = (categoryExpense[d.categoria] || 0) + (d.importoPrevisto - (d.importoPagato || 0)); });

        return { incomeConsuntivo, expenseConsuntivo, incomePrevisto, expensePrevisto, monthlyData, categoryIncome, categoryExpense };
    };

    const mainYearCalculatedData = getYearData(yearForCharts, isAllYears);
    const comparisonYearCalculatedData = getYearData(comparisonYearForCharts);

    const monthlyComparisonData = mainYearCalculatedData.monthlyData.map((mainMonth, i) => {
      const compMonth = comparisonYearCalculatedData.monthlyData[i];
      return { month: mainMonth.month, [`entrate${yearForCharts}`]: mainMonth.entrateConsuntivo, [`uscite${yearForCharts}`]: mainMonth.usciteConsuntivo, [`entrate${comparisonYearForCharts}`]: compMonth?.entrateConsuntivo || 0, [`uscite${comparisonYearForCharts}`]: compMonth?.usciteConsuntivo || 0, ...mainMonth }
    });

    const allIncomeCategories = new Set([...Object.keys(mainYearCalculatedData.categoryIncome || {}), ...Object.keys(comparisonYearCalculatedData.categoryIncome || {})]);
    const allExpenseCategories = new Set([...Object.keys(mainYearCalculatedData.categoryExpense || {}), ...Object.keys(comparisonYearCalculatedData.categoryExpense || {})]);

    const categoryComparisonData = {
        income: Array.from(allIncomeCategories).map(cat => ({ category: cat, totalMain: mainYearCalculatedData.categoryIncome[cat] || 0, totalComparison: comparisonYearCalculatedData.categoryIncome[cat] || 0 })).sort((a,b) => b.totalMain - a.totalMain),
        expense: Array.from(allExpenseCategories).map(cat => ({ category: cat, totalMain: mainYearCalculatedData.categoryExpense[cat] || 0, totalComparison: comparisonYearCalculatedData.categoryExpense[cat] || 0 })).sort((a,b) => b.totalMain - a.totalMain),
    };
    
    const cashflowDetailData = (() => {
        let openingBalance = (allMovements || []).filter(filterByCompany).filter(m => (m.anno < yearForCharts)).reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
        return (mainYearCalculatedData.monthlyData || []).map(month => {
            const monthInflows = month.entrateConsuntivo + month.entratePrevisto;
            const monthOutflows = month.usciteConsuntivo + month.uscitePrevisto;
            const closingBalance = openingBalance + monthInflows - monthOutflows;
            const result = { month: new Date(yearForCharts, (mainYearCalculatedData.monthlyData).indexOf(month)).toLocaleString('it-IT', { month: 'long' }), starting: openingBalance, inflows: monthInflows, outflows: monthOutflows, closing: closingBalance };
            openingBalance = closingBalance;
            return result;
        });
    })();
    
    const pieIncomeData = categoryComparisonData.income.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain }));
    const pieExpenseData = categoryComparisonData.expense.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain }));
    
    return { summaryTotals, monthlyComparisonData, categoryComparisonData, cashflowDetailData, pieIncomeData, pieExpenseData, analysisYear: yearForCharts, isAllYearsSelected: isAllYears };
  }, [selectedYear, comparisonYear, allMovements, allPrevisioniEntrate, allPrevisioniUscite, allScadenze, filterByCompany, currentYear]);

  const allDataForAgent = useMemo(() => {
    return { movements: (allMovements || []).filter(filterByCompany), incomeForecasts: (allPrevisioniEntrate || []).filter(filterByCompany), expenseForecasts: (allPrevisioniUscite || []).filter(filterByCompany), deadlines: (allScadenze || []).filter(filterByCompany), }
  }, [allMovements, allPrevisioniEntrate, allPrevisioniUscite, allScadenze, filterByCompany]);

  const combinedExpenseData = useMemo(() => {
    const fromForecasts = (allPrevisioniUscite || []).filter(filterByCompany).map(f => ({ ...f, type: 'previsione' as const }));
    const fromDeadlines = (allScadenze || []).filter(filterByCompany).filter(s => s.stato !== 'Pagato').map(s => ({ id: s.id, type: 'scadenza' as const, societa: s.societa, anno: s.anno, descrizione: s.descrizione, dataScadenza: s.dataScadenza, importoLordo: s.importoPrevisto - s.importoPagato, probabilita: 1.0, stato: s.stato, categoria: s.categoria }));
    return [...fromForecasts, ...fromDeadlines];
  }, [allPrevisioniUscite, allScadenze, filterByCompany]);
  
  const handleAddIncomeForecast = async (forecast: Omit<PrevisioneEntrata, 'id'>) => {
    if (!firestore || !user) return;
    try {
        await addDoc(collection(firestore, 'incomeForecasts'), { ...forecast, createdBy: user.uid, createdAt: new Date().toISOString() });
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
        const forecastRef = doc(firestore, 'incomeForecasts', forecastId);
        const movementsRef = collection(firestore, 'movements');
        const q = query(movementsRef, where('linkedTo', '==', `incomeForecasts/${forecastId}`));
        const linkedMovementsSnap = await getDocs(q);

        const batch = writeBatch(firestore);

        linkedMovementsSnap.forEach(movementDoc => {
            batch.update(movementDoc.ref, { linkedTo: null });
        });

        batch.delete(forecastRef);
        
        await batch.commit();

        toast({ title: 'Previsione Eliminata', description: 'La previsione di entrata e i collegamenti sono stati rimossi.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare la previsione.' });
        console.error(e);
    }
  };

  const handleAddExpenseForecast = async (forecast: Omit<PrevisioneUscita, 'id'>) => {
    if (!firestore || !user) return;
    try {
        await addDoc(collection(firestore, 'expenseForecasts'), { ...forecast, createdBy: user.uid, createdAt: new Date().toISOString() });
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

   const handleDeleteExpenseForecast = async (itemId: string, type: 'previsione' | 'scadenza') => {
    if (!firestore) return;
    const collectionName = type === 'previsione' ? 'expenseForecasts' : 'deadlines';
    const toastTitle = type === 'previsione' ? 'Previsione Eliminata' : 'Scadenza Eliminata';
    
    try {
        const itemRef = doc(firestore, collectionName, itemId);
        const movementsRef = collection(firestore, 'movements');
        const q = query(movementsRef, where('linkedTo', '==', `${collectionName}/${itemId}`));
        const linkedMovementsSnap = await getDocs(q);

        const batch = writeBatch(firestore);

        linkedMovementsSnap.forEach(movementDoc => {
            batch.update(movementDoc.ref, { linkedTo: null });
        });
        
        batch.delete(itemRef);

        await batch.commit();
        toast({ title: toastTitle, description: `L'elemento e i relativi collegamenti sono stati rimossi.` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: "Impossibile eliminare l'elemento." });
        console.error(e);
    }
  };

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
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Società" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutte">Tutte le società</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
           )}
           <div className="flex items-center gap-2 w-full">
            <Select value={selectedYear} onValueChange={handleMainYearChange}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Periodo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutti">Sempre (Sino ad oggi)</SelectItem>
                {availableYears.map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
              </SelectContent>
            </Select>
             <span className="text-muted-foreground font-medium">vs</span>
             <Select value={comparisonYear ?? 'none'} onValueChange={(v) => setComparisonYear(v === 'none' ? null : v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Confronto" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {availableYears.filter(y => selectedYear === 'Tutti' || y < Number(selectedYear)).map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
                </SelectContent>
            </Select>
           </div>
        </div>
      </div>

       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Entrate Consuntivo</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(summaryTotals.entrateConsuntivo || 0)}</p>}
              <p className='text-xs text-muted-foreground'>Sino ad oggi</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Uscite Consuntivo</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(summaryTotals.usciteConsuntivo || 0)}</p>}
               <p className='text-xs text-muted-foreground'>Sino ad oggi</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Entrate Previste</CardTitle></CardHeader>
            <CardContent>
               {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-blue-600">{formatCurrency(summaryTotals.entratePrevisto || 0)}</p>}
                <p className='text-xs text-muted-foreground'>Future</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Uscite Previste</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-orange-600">{formatCurrency(summaryTotals.uscitePrevisto || 0)}</p>}
               <p className='text-xs text-muted-foreground'>Future</p>
            </CardContent>
          </Card>
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
            mainYear={analysisYear} 
            comparisonYear={comparisonYear ? Number(comparisonYear) : null}
            isLoading={isLoading}
            monthlyComparisonData={monthlyComparisonData}
            categoryComparisonData={categoryComparisonData}
            pieIncomeData={pieIncomeData}
            pieExpenseData={pieExpenseData}
            isAllYearsSelected={isAllYearsSelected}
          />
        </TabsContent>
        <TabsContent value="cashflow">
            <CashflowDetail 
                isLoading={isLoading}
                data={cashflowDetailData}
                year={analysisYear}
                isAllYearsSelected={isAllYearsSelected}
            />
        </TabsContent>
        <TabsContent value="entrate">
           <IncomeForecasts
              data={(allPrevisioniEntrate || []).filter(filterByCompany)}
              year={analysisYear}
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
              year={analysisYear}
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
                company={selectedCompany as 'LNC' | 'STG' | 'Tutte'}
                allData={allDataForAgent}
            />
        </TabsContent>
      </Tabs>
    </div>
  );
}
