'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Sparkles, Loader2, LineChart, PieChart, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { analyzeCashFlow, type AnalyzeCashFlowOutput } from '@/ai/flows/analyze-cash-flow';
import { provideAiChatAssistant } from '@/ai/flows/provide-ai-chat-assistant';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatCurrency } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '../ui/skeleton';

type Message = {
  role: 'user' | 'model';
  content: string;
};

interface AiCashflowAgentProps {
    company: 'LNC' | 'STG' | 'Tutte';
    allData: {
        movements: Movimento[];
        incomeForecasts: PrevisioneEntrata[];
        expenseForecasts: PrevisioneUscita[];
    }
}

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


export function AiCashflowAgent({ company, allData }: AiCashflowAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisPeriod, setAnalysisPeriod] = useState('90');
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCashFlowOutput | null>(null);
  const { toast } = useToast();

  const handleGenerateAnalysis = async () => {
    setIsAnalysisLoading(true);
    setAnalysisResult(null);
    toast({ title: 'Analisi in corso...', description: 'L\'AI sta proiettando la liquidità. Potrebbe volerci un momento.' });
    try {
        const result = await analyzeCashFlow({
            financialData: JSON.stringify(allData),
            analysisPeriodDays: Number(analysisPeriod),
            company: company,
        });
        setAnalysisResult(result);
        toast({ title: 'Analisi Completata!', description: 'La proiezione di liquidità è pronta.', className: 'bg-green-100 dark:bg-green-900'});
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Errore Analisi', description: 'Impossibile completare l\'analisi AI.'});
    } finally {
        setIsAnalysisLoading(false);
    }
  }

  const handleSendMessage = async () => {
    if (input.trim() === '' || isChatLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsChatLoading(true);
    
    try {
      const result = await provideAiChatAssistant({
        query: currentInput,
        financialData: JSON.stringify(allData),
        company: company, 
        chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
      });
      
      const assistantMessage: Message = { role: 'model', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
       console.error("Error calling AI assistant:", error);
       const errorMessage: Message = { 
         role: 'model', 
         content: "Mi dispiace, ma al momento non riesco a rispondere. Potresti aver superato il limite di richieste del piano gratuito. Riprova tra qualche istante."
       };
       setMessages(prev => [...prev, errorMessage]);
       toast({
        variant: "destructive",
        title: "Errore Assistente AI",
        description: "Impossibile ottenere una risposta dall'AI. Controlla la console per maggiori dettagli.",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [messages]);


  return (
    <div className="grid lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LineChart className="text-primary" />
                    Proiezione di Liquidità
                </CardTitle>
                <CardDescription>
                    Genera un'analisi di cash flow per un periodo specifico per stimare la capacità di investimento.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Seleziona il periodo di analisi e genera una proiezione per visualizzare l'andamento della liquidità e la capacità di investimento stimata.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Select value={analysisPeriod} onValueChange={setAnalysisPeriod}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">Prossimi 30 giorni</SelectItem>
                                <SelectItem value="90">Prossimo trimestre</SelectItem>
                                <SelectItem value="180">Prossimo semestre</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateAnalysis} disabled={isAnalysisLoading} className="w-full sm:w-auto">
                            {isAnalysisLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Genera
                        </Button>
                    </div>
                </div>
                <ScrollArea className="h-[450px] w-full">
                {isAnalysisLoading ? (
                  <div className='p-4 space-y-4'>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="h-[250px] w-full">
                       <Skeleton className="h-full w-full" />
                    </div>
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : analysisResult ? (
                    <div className="p-1 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Riepilogo e Capacità di Investimento</CardTitle>
                            </CardHeader>
                             <CardContent className="space-y-4">
                                <p className="text-sm">{analysisResult.overallSummary}</p>
                                <div className="p-4 bg-primary/10 rounded-lg text-center">
                                    <p className="text-sm text-primary font-semibold">Capacità di Investimento Totale Stimata</p>
                                    <p className="text-3xl font-bold text-primary">{formatCurrency(analysisResult.totalInvestmentCapacity)}</p>
                                </div>
                             </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Andamento Mensile Previsto</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analysisResult.monthlyAnalysis}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false}/>
                                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${Number(value) / 1000}k`}/>
                                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                            <Legend />
                                            <Bar dataKey="inflows" name="Entrate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]}/>
                                            <Bar dataKey="outflows" name="Uscite" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]}/>
                                            <Bar dataKey="endBalance" name="Saldo Finale" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                ) : (
                    <div className="flex-1 flex h-full items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Info className="mx-auto h-8 w-8 mb-2" />
                          <p>L'analisi AI sarà visualizzata qui.</p>
                          <p className="text-sm">Premi "Genera" per iniziare.</p>
                        </div>
                    </div>
                )}
                </ScrollArea>
            </CardContent>
        </Card>

        <Card className="flex flex-col h-[calc(50vh+250px)]">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-primary" />
                Agente Finanziario AI
            </CardTitle>
            <CardDescription>
                Poni domande sui dati per ottenere analisi e suggerimenti strategici.
            </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
                <div className="space-y-6">
                {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground p-8">
                        <p>Inizia a chattare con il tuo assistente!</p>
                        <p className="text-sm">Chiedi: "Ho una spesa di 5000€ per un nuovo macchinario, qual è il momento migliore per pagarla?"</p>
                    </div>
                ) : (
                    messages.map((message, index) => (
                    <div
                        key={index}
                        className={cn(
                        "flex items-start gap-4",
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {message.role === 'model' && (
                        <Avatar className="h-9 w-9 border">
                            <AvatarFallback><Sparkles /></AvatarFallback>
                        </Avatar>
                        )}
                        <div
                        className={cn(
                            "max-w-xl rounded-lg px-4 py-3",
                            message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                        >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.role === 'user' && (
                        <Avatar className="h-9 w-9 border">
                            <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                        )}
                    </div>
                    ))
                )}
                {isChatLoading && (
                        <div className="flex items-start gap-4 justify-start">
                            <Avatar className="h-9 w-9 border">
                                <AvatarFallback><Sparkles /></AvatarFallback>
                            </Avatar>
                            <div className="max-w-xl rounded-lg px-4 py-3 bg-muted flex items-center">
                                <Loader2 className="h-5 w-5 animate-spin mr-2"/>
                                <span>Analizzo...</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            </CardContent>
            <CardFooter className="pt-6">
            <div className="relative w-full">
                <Textarea
                placeholder="Scrivi la tua domanda qui..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                }}
                className="pr-20"
                disabled={isChatLoading}
                />
                <Button
                size="icon"
                className="absolute top-1/2 right-3 -translate-y-1/2"
                onClick={handleSendMessage}
                disabled={isChatLoading || input.trim() === ''}
                aria-label="Invia messaggio"
                >
                <Send className="h-5 w-5" />
                </Button>
            </div>
            </CardFooter>
        </Card>
    </div>
  );
}
