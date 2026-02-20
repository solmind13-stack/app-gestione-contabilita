// src/app/(app)/assistente-ai/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { provideAiChatAssistant } from '@/ai/flows/provide-ai-chat-assistant';
import type { 
  Movimento, 
  Scadenza, 
  PrevisioneEntrata, 
  PrevisioneUscita,
  CashFlowProjection,
  LiquidityAlert,
  EntityScore,
  SeasonalAnalysis
} from '@/lib/types';

type Message = {
  role: 'user' | 'model';
  content: string;
};

export default function AssistenteAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const firestore = useFirestore();

  // Core Data Queries
  const movimentiQuery = useMemo(() => firestore ? collection(firestore, 'movements') : null, [firestore]);
  const scadenzeQuery = useMemo(() => firestore ? collection(firestore, 'deadlines') : null, [firestore]);
  const previsioniEntrateQuery = useMemo(() => firestore ? collection(firestore, 'incomeForecasts') : null, [firestore]);
  const previsioniUsciteQuery = useMemo(() => firestore ? collection(firestore, 'expenseForecasts') : null, [firestore]);

  // Planning Data Queries
  const projectionsQuery = useMemo(() => firestore ? query(collection(firestore, 'cashFlowProjections'), orderBy('generatedAt', 'desc'), limit(5)) : null, [firestore]);
  const alertsQuery = useMemo(() => firestore ? query(collection(firestore, 'liquidityAlerts'), orderBy('triggeredAt', 'desc'), limit(3)) : null, [firestore]);
  const scoresQuery = useMemo(() => firestore && user ? collection(firestore, 'users', user.uid, 'entityScores') : null, [firestore, user?.uid]);
  const seasonalQuery = useMemo(() => firestore && user ? collection(firestore, 'users', user.uid, 'seasonalPatterns') : null, [firestore, user?.uid]);

  const { data: movimenti } = useCollection<Movimento>(movimentiQuery);
  const { data: scadenze } = useCollection<Scadenza>(scadenzeQuery);
  const { data: previsioniEntrate } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUscite } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);
  
  const { data: projections } = useCollection<CashFlowProjection>(projectionsQuery);
  const { data: alerts } = useCollection<LiquidityAlert>(alertsQuery);
  const { data: scores } = useCollection<EntityScore>(scoresQuery);
  const { data: seasonal } = useCollection<SeasonalAnalysis>(seasonalQuery);

  const getFinancialData = useCallback(() => {
    return JSON.stringify({
      movimenti: (movimenti || []).slice(0, 100), // Limit for context window
      scadenze: scadenze || [],
      previsioniEntrate: previsioniEntrate || [],
      previsioniUscite: previsioniUscite || [],
      pianificazione: {
        proiezioni: (projections || []).filter(p => p.scenarioType === 'realistic').slice(0, 1),
        alerts: alerts || [],
        entityScores: scores || [],
        seasonalPatterns: seasonal || []
      }
    }, null, 2);
  }, [movimenti, scadenze, previsioniEntrate, previsioniUscite, projections, alerts, scores, seasonal]);


  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    const financialData = getFinancialData();

    try {
      const result = await provideAiChatAssistant({
        query: currentInput,
        financialData: financialData,
        company: user?.company || 'Tutte',
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      setTimeout(() => {
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <Card className="flex flex-col flex-1 shadow-xl border-primary/5 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg text-primary-foreground shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tighter">
                  Financial Twin Assistant
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Sincronizzato con dati reali e proiezioni AI
                </CardDescription>
              </div>
            </div>
            {user?.company && <Badge variant="outline" className="font-mono">{user.company}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0 bg-background/50">
          <ScrollArea className="h-full px-6 py-8" ref={scrollAreaRef}>
            <div className="space-y-8 max-w-4xl mx-auto">
              {messages.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-6">
                    <div className="p-6 rounded-full bg-muted/20 border-2 border-dashed">
                      <Sparkles className="h-12 w-12 text-primary opacity-20" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold">Chiedimi qualsiasi cosa sui tuoi conti</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                        {[
                          "Posso permettermi un nuovo computer da 2000€?",
                          "Qual è il miglior momento per assumere?",
                          "Come sta andando la liquidità per STG?",
                          "Chi sono i fornitori meno puntuali?"
                        ].map((q, i) => (
                          <button 
                            key={i} 
                            onClick={() => setInput(q)}
                            className="text-[11px] font-bold uppercase tracking-wider p-3 rounded-xl border bg-background hover:bg-primary hover:text-primary-foreground transition-all text-left shadow-sm"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
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
                      <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] sm:max-w-[70%] rounded-2xl px-5 py-4 shadow-sm",
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/80 border border-border/50 text-foreground'
                      )}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {message.content}
                      </p>
                    </div>
                     {message.role === 'user' && user && (
                       <Avatar className="h-9 w-9 border-2 border-primary shadow-sm shrink-0">
                         {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'}/>}
                         <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
                           {user.displayName?.charAt(0) || 'U'}
                         </AvatarFallback>
                       </Avatar>
                     )}
                  </div>
                ))
              )}
               {isLoading && (
                    <div className="flex items-start gap-4 justify-start animate-in fade-in slide-in-from-left-2">
                        <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground animate-pulse"><Sparkles className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="rounded-2xl px-5 py-4 bg-muted flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-primary"/>
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Analizzo i dati di pianificazione...</span>
                        </div>
                    </div>
                )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-6 bg-background border-t">
          <div className="relative w-full max-w-4xl mx-auto flex gap-3">
            <Textarea
              placeholder="Chiedi al tuo Twin: 'Posso fare questo investimento?'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="min-h-[60px] max-h-[200px] rounded-2xl resize-none py-4 px-6 border-muted bg-muted/30 focus-visible:ring-primary focus-visible:ring-offset-0"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-[60px] w-[60px] rounded-2xl shadow-lg shadow-primary/20 transition-transform active:scale-95 shrink-0"
              onClick={handleSendMessage}
              disabled={isLoading || input.trim() === ''}
            >
              <Send className="h-6 w-6" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}