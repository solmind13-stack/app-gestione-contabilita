// src/app/(app)/assistente-ai/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { provideAiChatAssistant, type ProvideAiChatAssistantInput } from '@/ai/flows/provide-ai-chat-assistant';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Import data sources
import { movimentiData } from '@/lib/movimenti-data';
import { scadenzeData } from '@/lib/scadenze-data';
import { previsioniEntrateData } from '@/lib/previsioni-entrate-data';
import { previsioniUsciteData } from '@/lib/previsioni-uscite-data';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AssistenteAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const realFinancialData = {
        movimenti: movimentiData,
        scadenze: scadenzeData,
        previsioniEntrate: previsioniEntrateData,
        previsioniUscite: previsioniUsciteData
      };
      
      const financialDataSummary = JSON.stringify(realFinancialData, null, 2);

      const chatHistory = messages.map(m => ({ role: m.role, content: m.content.substring(0, 500) }));

      const aiInput: ProvideAiChatAssistantInput = {
        query: input,
        company: 'Tutte',
        financialData: financialDataSummary,
        chatHistory: chatHistory,
      };

      const result = await provideAiChatAssistant(aiInput);

      const assistantMessage: Message = { role: 'assistant', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
       console.error("Error calling AI assistant:", error);
       const errorMessage: Message = { role: 'assistant', content: "Mi dispiace, si è verificato un errore e non sono in grado di rispondere in questo momento. Ciò potrebbe essere dovuto ai limiti di richieste API. Riprova più tardi." };
       setMessages(prev => [...prev, errorMessage]);
       toast({
         variant: "destructive",
         title: "Errore Assistente AI",
         description: "Impossibile ottenere una risposta. Potresti aver superato la quota API.",
       });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
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
            Poni domande sui tuoi dati, chiedi previsioni di liquidità o consigli su come gestire i pagamenti.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
            <div className="space-y-6">
              {messages.length === 0 ? (
                 <div className="text-center text-muted-foreground p-8">
                    <p>Inizia a chattare!</p>
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
                    {message.role === 'assistant' && (
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
                         {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'}/>}
                         <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
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
                            <Loader2 className="h-5 w-5 animate-spin"/>
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
