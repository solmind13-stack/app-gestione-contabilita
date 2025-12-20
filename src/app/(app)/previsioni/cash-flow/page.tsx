// src/app/(app)/previsioni/cash-flow/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, LineChart, Wallet, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { analyzeCashFlow, type AnalyzeCashFlowOutput } from '@/ai/flows/analyze-cash-flow';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { formatCurrency } from '@/lib/utils';


export default function CashFlowPage() {
  const [analysis, setAnalysis] = useState<AnalyzeCashFlowOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState('90'); // Default to 3 months for a better slide presentation
  const [company, setCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
  const { toast } = useToast();
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
      description: 'L\'AI sta elaborando i dati per creare la tua presentazione. Potrebbero volerci alcuni istanti.',
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
        title: 'Presentazione Pronta!',
        description: 'La proiezione del cash flow è stata generata.',
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
            Presentazione Cash Flow con AI
          </CardTitle>
          <CardDescription>
            Ottieni una presentazione a slide della tua liquidità futura e scopri la capacità di investimento mese per mese.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex gap-2 items-center w-full sm:w-auto">
                <span className="text-sm font-medium">Società:</span>
                <Select value={company} onValueChange={(v) => setCompany(v as any)}>
                    <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="30">Prossimi 30 giorni</SelectItem>
                        <SelectItem value="90">Prossimo trimestre</SelectItem>
                        <SelectItem value="180">Prossimo semestre</SelectItem>
                        <SelectItem value="365">Prossimo anno</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisi in corso...</>
            ) : (
               <><Wand2 className="mr-2 h-4 w-4" />Genera Presentazione</>
            )}
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
            <CardContent className="pt-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/>
                <p className="mt-2 text-muted-foreground">L'AI sta preparando le slide...</p>
            </CardContent>
        </Card>
      )}

      {analysis && analysis.monthlyBreakdown.length > 0 && (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Riepilogo Generale</CardTitle>
                </CardHeader>
                <CardContent className='flex flex-col md:flex-row gap-6 items-start'>
                     <div className="prose prose-sm dark:prose-invert max-w-full flex-1">
                        <p>{analysis.overallSummary}</p>
                    </div>
                     <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 w-full md:w-auto">
                        <h3 className="font-semibold text-lg text-green-800 dark:text-green-300">Capacità di Investimento Finale</h3>
                        <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-2">{analysis.finalInvestmentCapacity}</p>
                        <p className="text-sm text-muted-foreground mt-1">Liquidità extra stimata alla fine del periodo.</p>
                    </div>
                </CardContent>
            </Card>

            <Carousel className="w-full" opts={{ align: "start", loop: false }}>
                <CarouselContent className="-ml-4">
                {analysis.monthlyBreakdown.map((slide, index) => (
                    <CarouselItem key={index} className="pl-4 md:basis-1/2 lg:basis-1/3">
                    <div className="p-1 h-full">
                        <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle>{slide.monthName}</CardTitle>
                            <CardDescription className='text-xs'>Slide {index + 1} di {analysis.monthlyBreakdown.length}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-grow flex flex-col justify-between">
                            <div className='space-y-4'>
                                <div className="text-sm text-muted-foreground">{slide.summary}</div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center"><span>Saldo Iniziale:</span> <span className="font-medium">{formatCurrency(slide.startingBalance)}</span></div>
                                    <div className="flex justify-between items-center text-green-600"><span><TrendingUp className="inline-block h-4 w-4 mr-1"/>Entrate Previste:</span> <span className="font-medium">{formatCurrency(slide.totalInflows)}</span></div>
                                    <div className="flex justify-between items-center text-red-600"><span><TrendingDown className="inline-block h-4 w-4 mr-1"/>Uscite Previste:</span> <span className="font-medium">{formatCurrency(slide.totalOutflows)}</span></div>
                                    <div className="flex justify-between items-center border-t pt-2 mt-2"><strong>Saldo Finale:</strong> <strong className="text-lg">{formatCurrency(slide.endingBalance)}</strong></div>
                                </div>
                            </div>
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2"><Wallet/>Capacità di Investimento</h4>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{formatCurrency(slide.investmentCapacity)}</p>
                            </div>
                        </CardContent>
                        </Card>
                    </div>
                    </CarouselItem>
                ))}
                </CarouselContent>
                <CarouselPrevious className="ml-14" />
                <CarouselNext className="mr-14" />
            </Carousel>
        </div>
      )}
       {analysis && analysis.monthlyBreakdown.length === 0 && (
         <Card>
            <CardHeader>
                <CardTitle>Risultato Analisi</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{analysis.overallSummary}</p>
            </CardContent>
        </Card>
       )}
    </div>
  );
}
