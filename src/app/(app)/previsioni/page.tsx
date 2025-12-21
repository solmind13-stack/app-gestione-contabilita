'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ForecastComparison } from '@/components/previsioni/forecast-comparison';
import { AiCashflowAgent } from '@/components/previsioni/ai-cashflow-agent';
import { YEARS, COMPANIES } from '@/lib/constants';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';


export default function PrevisioniPage() {
  const { user } = useUser();
  const [isClient, setIsClient] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
  const [selectedYear, setSelectedYear] = useState<string>(YEARS[1].toString());

  // Mock data - will be replaced with Firestore data
  const movimenti: Movimento[] = [];
  const previsioniEntrate: PrevisioneEntrata[] = [];
  const previsioniUscite: PrevisioneUscita[] = [];


  useEffect(() => {
    setIsClient(true);
    if (user?.role === 'company' && user.company) {
      setSelectedCompany(user.company);
    }
  }, [user]);

  if (!isClient) {
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
           <Select value={selectedYear} onValueChange={setSelectedYear}>
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
