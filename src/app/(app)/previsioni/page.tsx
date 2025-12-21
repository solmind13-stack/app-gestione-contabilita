'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, CollectionReference } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ForecastComparison } from '@/components/previsioni/forecast-comparison';
import { AiCashflowAgent } from '@/components/previsioni/ai-cashflow-agent';
import { YEARS, COMPANIES } from '@/lib/constants';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';


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
  const [isClient, setIsClient] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    if (!selectedYear) {
      setSelectedYear(String(new Date().getFullYear()));
    }
    if (user?.role === 'company' && user.company) {
      setSelectedCompany(user.company);
    } else if (user?.role === 'company-editor' && user.company) {
      setSelectedCompany(user.company);
    }
  }, [user]);

  // Firestore Queries
  const movimentiQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'movements'), [firestore, user, selectedCompany]);
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'incomeForecasts'), [firestore, user, selectedCompany]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, selectedCompany, 'expenseForecasts'), [firestore, user, selectedCompany]);

  // Data fetching hooks
  const { data: movimenti } = useCollection<Movimento>(movimentiQuery);
  const { data: previsioniEntrate } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUscite } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  

  if (!isClient) {
    // Render a skeleton or null during SSR to avoid hydration mismatches
    return null; 
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Previsioni e Analisi</h1>
          <p className="text-muted-foreground">
            Analizza i trend, proietta la liquidità e dialoga con l'AI per ottimizzare le tue strategie.
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
           <Select value={selectedYear || ''} onValueChange={(value) => setSelectedYear(value)}>
              <SelectTrigger className="w-full md:w-[120px]">
                <SelectValue placeholder="Anno" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(year => <SelectItem key={year} value={String(year)}>{String(year)}</SelectItem>)}
              </SelectContent>
            </Select>
        </div>
      </div>

      <ForecastComparison 
        year={Number(selectedYear)} 
        company={selectedCompany}
        movements={movimenti || []}
        incomeForecasts={previsioniEntrate || []}
        expenseForecasts={previsioniUscite || []}
      />
      
      <AiCashflowAgent 
         company={selectedCompany}
         allData={{
            movements: movimenti || [],
            incomeForecasts: previsioniEntrate || [],
            expenseForecasts: previsioniUscite || [],
         }}
      />
    </div>
  );
}
