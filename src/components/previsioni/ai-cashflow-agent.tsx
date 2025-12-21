'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Sparkles, Loader2, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { provideAiChatAssistant } from '@/ai/flows/provide-ai-chat-assistant';
import type { Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { analyzeCashFlow, type AnalyzeCashFlowOutput } from '@/ai/flows/analyze-cash-flow';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatCurrency } from '@/lib/utils';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

export function AiCashflowAgent({ company, allData }: AiCashflowAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCashFlowOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [period, setPeriod] = useState('90');


  const financialDataJSON = useMemo(() => {
    return JSON.stringify({
        movements: allData.movements,
        incomeForecasts: allData.incomeForecasts,
        expenseForecasts: allData.expenseForecasts,
    }, null, 2);
  }, [allData]);


  const handleGenerateAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    toast({
        title: 'Analisi Cash Flow in corso...',
        description: 'L\'AI sta elaborando i dati. Potrebbero volerci alcuni istanti.',
    });
    try {
        const result = await analyzeCashFlow({
            financialData: financialDataJSON,
            analysisPeriodDays: parseInt(period),
            company: company,
        });
        setAnalysisResult(result);
        toast({
            title: 'Analisi Pronta!',
            description: 'La proiezione del cash flow è stata generata.',
        });
    } catch (error) {
        console.error("Error during cash flow analysis:", error);
        toast({ variant: 'destructive', title: 'Errore Analisi', description: 'Impossibile generare la proiezione.' });
    } finally {
        setIsAnalyzing(false);
    }
  }

  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    try {
      const result = await provideAiChatAssistant({
        query: currentInput,
        financialData: financialDataJSON,
        company: company,
        chatHistory: messages,
      });
      
      const assistantMessage: Message = { role: 'model', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
       console.error("Error calling AI assistant:", error);
       const errorMessage: Message = { 
         role: 'model', 
         content: "Mi dispiace, ma al momento non riesco a rispondere. Riprova tra qualche istante."
       };
       setMessages(prev => [...prev, errorMessage]);
       toast({
        variant: "destructive",
        title: "Errore Assistente AI",
        description: "Impossibile ottenere una risposta dall'AI.",
      });
    } finally {
      setIsLoading(false);
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
                    Genera un&apos;analisi di cash flow per un periodo specifico per stimare la capacità di investimento.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Seleziona il periodo di analisi e genera una proiezione per visualizzare l'andamento della liquidità e la capacità di investimento stimata.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">Prossimi 30 giorni</SelectItem>
                                <SelectItem value="90">Prossimo trimestre</SelectItem>
                                <SelectItem value="180">Prossimo semestre</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateAnalysis} disabled={isAnalyzing} className="w-full sm:w-auto">
                            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                            Genera
                        </Button>
                    </div>
                </div>

                {isAnalyzing && <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}

                {analysisResult && (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <h3 className="font-semibold text-lg text-green-800 dark:text-green-300">Capacità di Investimento Totale</h3>
                            <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(analysisResult.totalInvestmentCapacity)}</p>
                        </div>
                         <div className="prose prose-sm dark:prose-invert max-w-full">
                            <p>{analysisResult.overallSummary}</p>
                        </div>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analysisResult.monthlyAnalysis}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                                    <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}/>
                                    <Tooltip
                                        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                                        formatter={(value: number) => formatCurrency(value)}
                                    />
                                    <Legend />
                                    <Bar dataKey="inflows" name="Entrate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="outflows" name="Uscite" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card className="flex flex-col h-[70vh]">
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
                {isLoading && (
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
                disabled={isLoading}
                />
                <Button
                size="icon"
                className="absolute top-1/2 right-3 -translate-y-1/2"
                onClick={handleSendMessage}
                disabled={isLoading || input.trim() === ''}
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
