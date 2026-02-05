// src/app/(app)/previsioni/page.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData, addDoc, updateDoc, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ForecastComparison } from '@/components/previsioni/forecast-comparison';
import { AiCashflowAgent } from '@/components/previsioni/ai-cashflow-agent';
import { YEARS } from '@/lib/constants';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser, Scadenza, CompanyProfile, IncomeForecastSuggestion, ExpenseForecastSuggestion, RecurringExpensePattern } from '@/lib/types';
import { IncomeForecasts } from '@/components/previsioni/income-forecasts';
import { ExpenseForecasts } from '@/components/previsioni/expense-forecasts';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashflowDetail } from '@/components/previsioni/cashflow-detail';
import { formatCurrency, parseDate } from '@/lib/utils';
import { startOfMonth, getYear, subYears } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Sparkles, Loader2 } from 'lucide-react';
import { suggestIncomeForecasts } from '@/ai/flows/suggest-income-forecasts';
import { suggestExpenseForecasts } from '@/ai/flows/suggest-expense-forecasts';


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
  const router = useRouter();

  const availableYears = useMemo(() => YEARS.filter(y => typeof y === 'number') as number[], []);
  const currentYear = new Date().getFullYear();

  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
  const [selectedYear, setSelectedYear] = useState<string>('Tutti');
  const [comparisonYear, setComparisonYear] = useState<string | null>(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);

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

  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user?.uid]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user?.uid]);
  const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user?.uid]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user?.uid]);
  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  const incomeSuggestionsQuery = useMemo(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'incomeForecastSuggestions'), where('status', '==', 'pending')) : null, [firestore, user?.uid]);
    const expenseSuggestionsQuery = useMemo(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'expenseForecastSuggestions'), where('status', '==', 'pending')) : null, [firestore, user?.uid]);
  
  const { data: allPrevisioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: allPrevisioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  const { data: allMovements, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: allScadenze, isLoading: isLoadingScadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);
  const { data: incomeSuggestions, isLoading: isLoadingIncomeSuggestions } = useCollection<IncomeForecastSuggestion>(incomeSuggestionsQuery);
  const { data: expenseSuggestions, isLoading: isLoadingExpenseSuggestions } = useCollection<ExpenseForecastSuggestion>(expenseSuggestionsQuery);
  
  const isLoading = isLoadingMovements || isLoadingIncome || isLoadingExpenses || isLoadingScadenze || isLoadingCompanies || isLoadingIncomeSuggestions || isLoadingExpenseSuggestions;

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
    const fromDeadlines = (allScadenze || []).filter(filterByCompany).filter(s => s.stato !== 'Pagato').map(s => ({ id: s.id, type: 'scadenza' as const, societa: s.societa, anno: s.anno, descrizione: s.descrizione, dataScadenza: s.dataScadenza, importoLordo: s.importoPrevisto - (s.importoPagato || 0), probabilita: 1.0, stato: s.stato, categoria: s.categoria }));
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

  // Generic suggestion logic
    const handleSuggest = useCallback(async (type: 'income' | 'expense') => {
        if (!firestore || !user) return;
        setIsSuggestionLoading(true);

        const companiesToAnalyze = selectedCompany === 'Tutte' && companies
            ? companies.map(c => c.sigla)
            : [selectedCompany];

        if (companiesToAnalyze.length === 0 || !allMovements) {
            toast({ variant: 'destructive', title: 'Nessun Dato', description: 'Non ci sono società o movimenti da analizzare.' });
            setIsSuggestionLoading(false);
            return;
        }

        let totalSuggestionsCreated = 0;

        for (const company of companiesToAnalyze) {
            if (!company) continue;

            const twoYearsAgo = getYear(subYears(new Date(), 2));
            const movementsToAnalyze = (allMovements || [])
                .filter(m => m.societa === company && m.anno >= twoYearsAgo && (type === 'income' ? m.entrata > 0 : m.uscita > 0));

            if (movementsToAnalyze.length < 3) continue;

            const createGroupingKey = (desc: string): string => {
                 const lowerDesc = desc.toLowerCase().trim();
                const primaryEntities = ['f24', 'imu', 'ires', 'irap', 'iva', 'inps', 'telecom', 'tim', 'enel', 'bapr', 'gse', 'eris', 'reggiani', 'h&s', 'spazio pedagogia'];
                
                for (const entity of primaryEntities) {
                    if (lowerDesc.includes(entity)) {
                         if (entity === 'f24') {
                            if (lowerDesc.includes('imu')) return 'f24 imu';
                            if (lowerDesc.includes('ires')) return 'f24 ires';
                            return 'f24';
                        }
                        return entity;
                    }
                }
            
                const noiseWords = ['pagamento', 'accredito', 'addebito', 'sdd', 'rata', 'canone', 'fattura', 'fatt', 'ft', 'rif', 'riferimento', 'n\.', 'num\.', 'del', 'al', 'su', 'e', 'di', 'a', 'vs', 'commissioni', 'bancarie', 'spese', 'recupero', 'imposta', 'bollo', 'su', 'estratto', 'conto', 'ren', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre', 'gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
                const noiseRegex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
                let cleanedDesc = lowerDesc.replace(noiseRegex, '');
                cleanedDesc = cleanedDesc.replace(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\b\d{2,}\b)/g, '');
                cleanedDesc = cleanedDesc.replace(/[.,\-_/()]/g, ' ').trim();
                const significantWords = cleanedDesc.split(/\s+/).filter(w => w.length > 2);
                return significantWords.slice(0, 3).join(' ');
            };

            const groupedByDescription = movementsToAnalyze.reduce((acc, mov) => {
                const key = createGroupingKey(mov.descrizione);
                if (!key) return acc;
                if (!acc[key]) acc[key] = [];
                acc[key].push(mov);
                return acc;
            }, {} as Record<string, Movimento[]>);

            const finalCandidateGroups: Movimento[][] = [];
            
            Object.values(groupedByDescription).forEach(group => {
                if (group.length < 3) return;
                
                group.sort((a,b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());
                
                const amountKey = type === 'income' ? 'entrata' : 'uscita';
                const sortedByAmount = [...group].sort((a, b) => a[amountKey] - b[amountKey]);
                let currentCluster: Movimento[] = [sortedByAmount[0]];
            
                for (let i = 1; i < sortedByAmount.length; i++) {
                    const currentMov = sortedByAmount[i];
                    const clusterAvg = currentCluster.reduce((sum, m) => sum + m[amountKey], 0) / currentCluster.length;
                    
                    if (clusterAvg > 0 && Math.abs(currentMov[amountKey] - clusterAvg) / clusterAvg <= 0.15) {
                        currentCluster.push(currentMov);
                    } else {
                        if (currentCluster.length >= 3) finalCandidateGroups.push(currentCluster);
                        currentCluster = [currentMov];
                    }
                }
                if (currentCluster.length >= 3) finalCandidateGroups.push(currentCluster);
            });

            const existingForecasts = type === 'income' ? allPrevisioniEntrate : [...allPrevisioniUscite, ...allScadenze];
            const filteredCandidates = finalCandidateGroups.filter(group => {
                if (group.length === 0) return false;
                const amountKey = type === 'income' ? 'entrata' : 'uscita';
                const avgAmount = group.reduce((sum, m) => sum + m[amountKey], 0) / group.length;

                const hasExistingFuture = (existingForecasts || []).some(existing => {
                    if (existing.societa !== company) return false;
                    const existingDate = parseDate(type === 'income' ? (existing as PrevisioneEntrata).dataPrevista : (existing as PrevisioneUscita).dataScadenza);
                    if (existingDate < new Date()) return false;
                    
                    const existingAmount = 'importoLordo' in existing ? existing.importoLordo : (existing as Scadenza).importoPrevisto;
                    const amountDifference = Math.abs(existingAmount - avgAmount);
                    const isAmountSimilar = (avgAmount > 0) ? (amountDifference / avgAmount) < 0.10 : false;
                    
                    const groupDescKey = createGroupingKey(group[0].descrizione);
                    const existingDescKey = createGroupingKey(existing.descrizione);
                    
                    return isAmountSimilar && groupDescKey === existingDescKey;
                });
                
                return !hasExistingFuture;
            });
    
            if (filteredCandidates.length === 0) continue;
            
            const analysisPayload = filteredCandidates.map((group, index) => {
                const amountKey = type === 'income' ? 'entrata' : 'uscita';
                const amounts = group.map(m => m[amountKey]);
                const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const stdDev = Math.sqrt(amounts.map(x => Math.pow(x - avgAmount, 2)).reduce((a, b) => a + b, 0) / amounts.length);
                const coefficientOfVariation = avgAmount === 0 ? 0 : stdDev / avgAmount;
                const amountType = coefficientOfVariation < 0.05 ? 'fixed' : 'variable';
    
                let ricorrenza: RecurringExpensePattern['ricorrenza'] = 'Altro';
                if (group.length > 1) {
                    let totalDays = 0;
                    for (let i = 1; i < group.length; i++) {
                        totalDays += (parseDate(group[i].data).getTime() - parseDate(group[i-1].data).getTime()) / (1000 * 3600 * 60 * 24);
                    }
                    const avgDays = totalDays / (group.length - 1);
    
                    if (avgDays > 25 && avgDays < 35) ricorrenza = 'Mensile';
                    else if (avgDays > 55 && avgDays < 65) ricorrenza = 'Bimestrale';
                    else if (avgDays > 85 && avgDays < 95) ricorrenza = 'Trimestrale';
                    else if (avgDays > 115 && avgDays < 125) ricorrenza = 'Quadrimestrale';
                    else if (avgDays > 175 && avgDays < 185) ricorrenza = 'Semestrale';
                    else if (avgDays > 360 && avgDays < 370) ricorrenza = 'Annuale';
                }
    
                const daysOfMonth = group.map(m => parseDate(m.data).getDate());
                const giornoStimato = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);
                const firstMonth = group.length > 0 ? parseDate(group[0].data).getMonth() + 1 : undefined;
    
                const categoryCounts = group.reduce((acc, mov) => {
                    const key = `${mov.categoria || 'Da categorizzare'}|||${mov.sottocategoria || 'Da categorizzare'}`;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
            
                const mostCommonCatSub = Object.keys(categoryCounts).length > 0 
                    ? Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b)
                    : 'Da categorizzare|||Da categorizzare';
            
                const [sourceCategory, sourceSubcategory] = mostCommonCatSub.split('|||');
    
                return { id: index, description: group[0].descrizione, count: group.length, avgAmount, amountType, ricorrenza, giornoStimato, primoMese: firstMonth, sourceCategory, sourceSubcategory };
            });
    
            try {
                const suggestionFlow = type === 'income' ? suggestIncomeForecasts : suggestExpenseForecasts;
                const result = await suggestionFlow({
                    company: company,
                    analysisCandidates: JSON.stringify(analysisPayload),
                });
                
                if (result?.suggestions && result.suggestions.length > 0) {
                    const batch = writeBatch(firestore);
                    const collectionName = type === 'income' ? 'incomeForecastSuggestions' : 'expenseForecastSuggestions';
                    for (const suggestion of result.suggestions) {
                        const originalGroup = filteredCandidates[suggestion.sourceCandidateId];
                        if (!originalGroup) continue;
    
                        const newSuggestionRef = doc(collection(firestore, 'users', user.uid, collectionName));
                        const payload = {
                            ...(suggestion as any),
                            sourceMovementIds: originalGroup.map(m => m.id),
                            status: 'pending',
                            userId: user.uid,
                            createdAt: new Date().toISOString()
                        };
                        batch.set(newSuggestionRef, payload);
                    }
                    await batch.commit();
                    totalSuggestionsCreated += result.suggestions.length;
                }
            } catch (error: any) {
                console.error(`Error suggesting for ${company}:`, error);
                toast({ variant: 'destructive', title: `Errore Analisi per ${company}`, description: 'Impossibile completare l\'analisi.' });
            }
        }
        
        setIsSuggestionLoading(false);
        if (totalSuggestionsCreated > 0) {
            toast({ title: 'Analisi Completata', description: `${totalSuggestionsCreated} nuovi suggerimenti sono disponibili per la revisione.` });
            router.push(`/previsioni/revisione-${type === 'income' ? 'entrate' : 'uscite'}`);
        } else {
            toast({ title: 'Nessun Nuovo Suggerimento', description: 'Nessun nuovo pattern ricorrente è stato trovato.' });
        }
    }, [firestore, user, allMovements, allPrevisioniEntrate, allPrevisioniUscite, allScadenze, selectedCompany, companies, toast, router]);


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
        <TabsContent value="entrate" className="space-y-4">
           <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.push('/previsioni/revisione-entrate')}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Revisiona Suggerimenti ({incomeSuggestions?.length || 0})
                </Button>
                <Button onClick={() => handleSuggest('income')} disabled={isSuggestionLoading}>
                    {isSuggestionLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Sparkles className="mr-2 h-4 w-4" />}
                    Suggerisci Entrate
                </Button>
            </div>
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
        <TabsContent value="uscite" className="space-y-4">
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.push('/previsioni/revisione-uscite')}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Revisiona Suggerimenti ({expenseSuggestions?.length || 0})
                </Button>
                <Button onClick={() => handleSuggest('expense')} disabled={isSuggestionLoading}>
                    {isSuggestionLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Sparkles className="mr-2 h-4 w-4" />}
                    Suggerisci Uscite
                </Button>
            </div>
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

    
