// src/app/(app)/assistente-ai/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { provideAiChatAssistant } from '@/ai/flows/provide-ai-chat-assistant';
import type { Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';

type Message = {
  role: 'user' | 'model';
  content: string;
};

export default function AssistenteAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [financialData, setFinancialData] = useState<string>('');
  const { user } = useUser();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadDataFromStorage = useCallback(() => {
    try {
      const movimenti = localStorage.getItem('movimenti');
      const scadenze = localStorage.getItem('scadenze');
      const previsioniEntrate = localStorage.getItem('previsioniEntrate');
      const previsioniUscite = localStorage.getItem('previsioniUscite');
      
      const allData = {
        movimenti: movimenti ? JSON.parse(movimenti) : [],
        scadenze: scadenze ? JSON.parse(scadenze) : [],
        previsioniEntrate: previsioniEntrate ? JSON.parse(previsioniEntrate) : [],
        previsioniUscite: previsioniUscite ? JSON.parse(previsioniUscite) : [],
      };

      setFinancialData(JSON.stringify(allData, null, 2));

    } catch (error) {
      console.error("Failed to load data from localStorage for AI Assistant:", error);
      toast({
        variant: "destructive",
        title: "Errore nel Caricamento Dati",
        description: "Impossibile caricare i dati finanziari per l'assistente. Le risposte potrebbero non essere accurate.",
      });
    }
  }, [toast]);

  useEffect(() => {
    loadDataFromStorage();
  }, [loadDataFromStorage]);


  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    
    // Reload data just before making the call to ensure it's fresh
    loadDataFromStorage();

    try {
      const result = await provideAiChatAssistant({
        query: currentInput,
        financialData: financialData,
        company: 'Tutte', // Or make this dynamic
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
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <Card className="flex flex-col flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" />
            Assistente Finanziario AI
          </CardTitle>
          <CardDescription>
            Poni domande sui tuoi dati finanziari. L'assistente è collegato ai dati in tempo reale.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.length === 0 ? (
                 <div className="text-center text-muted-foreground p-8">
                    <p>Inizia a chattare con il tuo assistente finanziario!</p>
                    <p className="text-sm">Puoi chiedere: "Qual è la mia liquidità prevista per la fine del mese?" o "Come posso scaglionare i pagamenti di dicembre?".</p>
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
                     {message.role === 'user' && user && (
                       <Avatar className="h-9 w-9 border">
                         {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'}/>}
                         <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
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
