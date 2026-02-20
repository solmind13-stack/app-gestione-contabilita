
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, FlaskConical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LiveSandbox } from '@/components/pianificazione/live-sandbox';
import type { CompanyProfile } from '@/lib/types';

export default function SandboxPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');

  const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
  const { data: companies } = useCollection<CompanyProfile>(companiesQuery);

  useEffect(() => {
    if (user?.role === 'company' || user.role === 'company-editor') {
      if (user.company) setSelectedCompany(user.company);
    }
  }, [user]);

  const currentSocieta = selectedCompany === 'Tutte' ? (user?.company || 'LNC') : selectedCompany;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FlaskConical className="h-8 w-8 text-primary" />
              Live Sandbox
            </h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Simulazione Scenari What-If</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background">
                <SelectValue placeholder="Seleziona società" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tutte">Tutte le società</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <LiveSandbox societa={currentSocieta} />
    </div>
  );
}
