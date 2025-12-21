// src/app/(app)/previsioni/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference, DocumentData } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ForecastComparison } from '@/components/previsioni/forecast-comparison';
import { AiCashflowAgent } from '@/components/previsioni/ai-cashflow-agent';
import { YEARS, COMPANIES } from '@/lib/constants';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';
import { IncomeForecasts } from '@/components/previsioni/income-forecasts';
import { ExpenseForecasts } from '@/components/previsioni/expense-forecasts';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';


const getQuery = (firestore: any, user: AppUser | null, company: 'LNC' | 'STG' | 'Tutte', collectionName: string) => {
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
  const [isClient, setIsClient] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
  const [mainYear, setMainYear] = useState<number | null>(null);
  const [comparisonYear, setComparisonYear] = useState<number | null>(null);

  const availableYears = useMemo(() => YEARS.filter(y => typeof y === 'number') as number[], []);

  useEffect(() => {
    setIsClient(true);
    if (!mainYear) {
      const currentYear = new Date().getFullYear();
      setMainYear(currentYear);
      setComparisonYear(currentYear - 1);
    }
    if (user?.role === 'company' && user.company) {
      setSelectedCompany(user.company);
    } else if (user?.role === 'company-editor' && user.company) {
        setSelectedCompany(user.company);
    }
  }, [user]);

  const handleMainYearChange = (yearValue: string) => {
    const year = Number(yearValue);
    setMainYear(year);
    // If the comparison year is now the same or greater, adjust it
    if (comparisonYear !== null && year <= comparisonYear) {
      setComparisonYear(year - 1);
    }
  };


  // Firestore Queries
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'incomeForecasts'), [firestore, user, selectedCompany]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'expenseForecasts'), [firestore, user, selectedCompany]);
  const movimentiQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'movements'), [firestore, user, selectedCompany]);
  
  // Data fetching hooks
  const { data: movimenti, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: previsioniEntrate, isLoading: isLoadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUscite, isLoading: isLoadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  
  const isLoading = isLoadingMovements || isLoadingIncome || isLoadingExpenses;
  
  // CRUD Handlers for Forecasts
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

   const handleDeleteExpenseForecast = async (forecastId: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'expenseForecasts', forecastId));
        toast({ title: 'Previsione Eliminata', description: 'La previsione di uscita è stata eliminata.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare la previsione.' });
        console.error(e);
    }
  };
  
  const allData = useMemo(() => ({
    movements: movimenti || [],
    incomeForecasts: previsioniEntrate || [],
    expenseForecasts: previsioniUscite || [],
  }), [movimenti, previsioniEntrate, previsioniUscite]);


  if (!isClient || !mainYear || !comparisonYear) {
    return null; 
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Previsioni e Analisi</h1>
          <p className="text-muted-foreground">
            Analizza i trend, proietta la liquidità e gestisci le previsioni di entrate e uscite.
          </p>
        </div>
        <div className="flex items-center gap-4">
           {user && (user.role === 'admin' || user.role === 'editor') && (
            <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v as any)}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Società" />
              </SelectTrigger>
              <SelectContent>
                {COMPANIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
           )}
           <div className="flex items-center gap-2">
            <Select value={String(mainYear)} onValueChange={handleMainYearChange}>
              <SelectTrigger className="w-full md:w-[120px]">
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
              </SelectContent>
            </Select>
             <span className="text-muted-foreground font-medium">vs</span>
            <Select value={String(comparisonYear)} onValueChange={(v) => setComparisonYear(Number(v))}>
                <SelectTrigger className="w-full md:w-[120px]">
                    <SelectValue placeholder="Anno" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.filter(y => y < mainYear).map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
                </SelectContent>
            </Select>
           </div>
        </div>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="entrate">Dettaglio Entrate</TabsTrigger>
          <TabsTrigger value="uscite">Dettaglio Uscite</TabsTrigger>
          <TabsTrigger value="agente-ai">Agente AI</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <ForecastComparison 
            mainYear={mainYear} 
            comparisonYear={comparisonYear}
            company={selectedCompany}
            movements={movimenti || []}
            incomeForecasts={previsioniEntrate || []}
            expenseForecasts={previsioniUscite || []}
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
              defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
              currentUser={user!}
          />
        </TabsContent>
        <TabsContent value="uscite">
          <ExpenseForecasts
              data={previsioniUscite || []}
              year={mainYear}
              isLoading={isLoadingExpenses}
              onAdd={handleAddExpenseForecast}
              onEdit={handleEditExpenseForecast}
              onDelete={handleDeleteExpenseForecast}
              defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
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
