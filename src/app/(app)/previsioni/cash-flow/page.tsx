// src/app/(app)/previsioni/cash-flow/page.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, LineChart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';
import { analyzeCashFlow, type AnalyzeCashFlowOutput } from '@/ai/flows/analyze-cash-flow';
import { cn } from '@/lib/utils';


export default function CashFlowPage() {
  const [analysis, setAnalysis] = useState<AnalyzeCashFlowOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState('30');
  const [company, setCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetching all necessary data
  const movimentiQuery = useMemoFirebase(() => firestore ? collection(firestore, 'movements') : null, [firestore]);
  const previsioniEntrateQuery = useMemoFirebase(() => firestore ? collection(firestore, 'incomeForecasts') : null, [firestore]);
  const previsioniUsciteQuery = useMemoFirebase(() => firestore ? collection(firestore, 'expenseForecasts') : null, [firestore]);

  const { data: movimentiData } = useCollection<Movimento>(movimentiQuery);
  const { data: previsioniEntrateData } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUsciteData } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);

  const getFilteredData = useCallback(() => {
    const filterByCompany = (item: { societa: 'LNC' | 'STG' }) => company === 'Tutte' || item.societa === company;
    
    const movimenti = movimentiData?.filter(filterByCompany) || [];
    const entrate = previsioniEntrateData?.filter(filterByCompany) || [];
    const uscite = previsioniUsciteData?.filter(filterByCompany) || [];

    return { movimenti, entrate, uscite };
  }, [movimentiData, previsioniEntrateData, previsioniUsciteData, company]);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setAnalysis(null);
    toast({
      title: 'Analisi Cash Flow in corso...',
      description: 'L\'AI sta elaborando i dati. Potrebbero volerci alcuni istanti.',
    });

    try {
      const { movimenti, entrate, uscite } = getFilteredData();
      
      const financialDataSummary = JSON.stringify({
          movements: movimenti,
          incomeForecasts: entrate,
          expenseForecasts: uscite
      });

      const result = await analyzeCashFlow({
        financialData: financialDataSummary,
        analysisPeriodDays: parseInt(period, 10),
        company: company,
      });

      setAnalysis(result);
      toast({
        title: 'Analisi Completata!',
        description: 'La proiezione del cash flow è pronta.',
        className: 'bg-green-100 dark:bg-green-900',
      });
    } catch (error) {
      console.error("Error analyzing cash flow:", error);
      toast({
        variant: 'destructive',
        title: 'Errore durante l\'analisi',
        description: 'Impossibile generare la proiezione in questo momento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-6 w-6 text-primary" />
            Analisi Cash Flow con AI
          </CardTitle>
          <CardDescription>
            Ottieni una proiezione della liquidità futura e scopri la tua capacità di investimento. L'AI analizza i movimenti, le scadenze e le previsioni per darti una visione chiara.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex gap-2 items-center w-full sm:w-auto">
                <span className="text-sm font-medium">Società:</span>
                <Select value={company} onValueChange={(v) => setCompany(v as any)}>
                    <SelectTrigger className="w-full sm:w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutte">Tutte</SelectItem>
                        <SelectItem value="LNC">LNC</SelectItem>
                        <SelectItem value="STG">STG</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex gap-2 items-center w-full sm:w-auto">
                <span className="text-sm font-medium">Periodo:</span>
                 <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Prossimi 7 giorni</SelectItem>
                        <SelectItem value="30">Prossimi 30 giorni</SelectItem>
                        <SelectItem value="90">Prossimo trimestre</SelectItem>
                        <SelectItem value="180">Prossimo semestre</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisi in corso...
              </>
            ) : (
               <>
                <Wand2 className="mr-2 h-4 w-4" />
                Analizza Cash Flow
               </>
            )}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Risultati dell'Analisi</CardTitle>
            <CardDescription>Proiezione per i prossimi {period} giorni per la società {company}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="prose prose-sm dark:prose-invert max-w-full">
                <p>{analysis.narrativeSummary}</p>
            </div>
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-lg text-green-800 dark:text-green-300">Capacità di Investimento Stimata</h3>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-2">{analysis.investmentCapacity}</p>
                <p className="text-sm text-muted-foreground mt-1">Questa è la liquidità extra che l'AI stima avrai a disposizione alla fine del periodo, considerata una riserva di sicurezza.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
