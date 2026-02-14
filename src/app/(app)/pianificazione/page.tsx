'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { AppUser, CompanyProfile } from '@/lib/types';
import { Lightbulb, GanttChart, Users, Target, ShieldAlert } from 'lucide-react';
import { LiquidityTrafficLight } from '@/components/pianificazione/liquidity-traffic-light';
import { CashflowProjectionChart } from '@/components/pianificazione/cashflow-projection-chart';
import { FiscalDeadlinesCard } from '@/components/pianificazione/fiscal-deadlines-card';

export default function PianificazionePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');

  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  const { data: companies } = useCollection<CompanyProfile>(companiesQuery);

  useEffect(() => {
    if (user?.role === 'company' || user.role === 'company-editor') {
      if (user.company) setSelectedCompany(user.company);
    }
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Pianificazione Avanzata</h1>
          <p className="text-muted-foreground">
            Un Digital Twin finanziario per simulare, prevedere e decidere.
          </p>
        </div>
        {user && (user.role === 'admin' || user.role === 'editor') && (
          <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Seleziona società" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tutte">Tutte le società</SelectItem>
              {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <LiquidityTrafficLight societa={selectedCompany} />

        <CashflowProjectionChart societa={selectedCompany} />

        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Scenari Probabilistici</CardTitle>
                <Lightbulb className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">In fase di implementazione...</p>
            </CardContent>
        </Card>
        
        <Card className="lg:col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Timeline Decisioni</CardTitle>
                <GanttChart className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">In fase di implementazione...</p>
            </CardContent>
        </Card>

        <FiscalDeadlinesCard societa={selectedCompany} />

        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Score Clienti/Fornitori</CardTitle>
                <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">In fase di implementazione...</p>
            </CardContent>
        </Card>

        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Budget per Categoria</CardTitle>
                <Target className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">In fase di implementazione...</p>
            </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Anomalie Rilevate</CardTitle>
                <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">In fase di implementazione...</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
