'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { 
  History, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  Star, 
  MessageSquare,
  AlertCircle,
  BrainCircuit,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { monthlyReplay } from '@/ai/flows/monthly-replay';
import { formatCurrency, cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, getMonth, getYear } from 'date-fns';
import { it } from 'date-fns/locale';
import type { MonthlyReplay } from '@/lib/types';

interface MonthlyReplayCardProps {
  societa: string;
  userId: string;
}

export function MonthlyReplayCard({ societa, userId }: MonthlyReplayCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), 'M'));
  const [selectedYear, setSelectedYear] = useState(format(subMonths(new Date(), 1), 'yyyy'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [rating, setRating] = useState(0);

  // 1. Fetch Replay Data
  const replayQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'monthlyReplays'),
      where('societa', '==', societa),
      where('month', '==', Number(selectedMonth)),
      where('year', '==', Number(selectedYear)),
      limit(1)
    );
  }, [firestore, societa, selectedMonth, selectedYear]);

  const { data: replays, isLoading: isLoadingReplay } = useCollection<MonthlyReplay>(replayQuery);
  const currentReplay = replays?.[0];

  // 2. Fetch Calibrations
  const calibrationsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'modelCalibrations'),
      where('societa', '==', societa),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [firestore, societa]);

  const { data: calibrations } = useCollection<any>(calibrationsQuery);

  const handleGenerateReplay = async () => {
    if (!userId) return;
    setIsGenerating(true);
    toast({ title: 'Analisi Replay...', description: 'Sto confrontando le proiezioni passate con i dati reali del mese.' });
    
    try {
      await monthlyReplay({
        societa: societa === 'Tutte' ? 'LNC' : societa,
        userId,
        month: Number(selectedMonth),
        year: Number(selectedYear)
      });
      toast({ title: 'Replay Generato', className: 'bg-green-100 dark:bg-green-900' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!firestore || !userId) return;
    setIsSubmittingFeedback(true);
    try {
      await addDoc(collection(firestore, 'userDecisionLog'), {
        type: 'model_feedback',
        societa,
        userId,
        month: Number(selectedMonth),
        year: Number(selectedYear),
        note: userNote,
        rating,
        createdAt: serverTimestamp()
      });
      toast({ title: 'Grazie!', description: 'Il tuo feedback aiuterà l\'AI a essere più precisa.' });
      setUserNote('');
      setRating(0);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Errore nell\'invio feedback' });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: format(new Date(2024, i, 1), 'MMMM', { locale: it })
    }));
  }, []);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1].map(y => String(y));
  }, []);

  return (
    <Card className="lg:col-span-4 shadow-xl border-primary/10 overflow-hidden bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="bg-primary/5 border-b pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Monthly Replay & Learning
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Confronto tra quanto previsto dal Digital Twin e quanto accaduto realmente
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 bg-background p-1.5 rounded-2xl border shadow-sm">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-32 border-none font-bold uppercase text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-20 border-none font-bold text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateReplay} disabled={isGenerating} size="sm" className="h-8 px-4 font-black uppercase text-[10px] gap-2 rounded-xl">
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Analizza
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoadingReplay ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          </div>
        ) : currentReplay ? (
          <div className="divide-y">
            {/* Accuracy Score & Narrative Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
              <div className="lg:col-span-4 p-8 flex flex-col items-center justify-center border-r bg-background/50">
                <div className="relative h-32 w-32 mb-6">
                  <svg className="h-full w-full -rotate-90">
                    <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                    <circle 
                      cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8" 
                      strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * currentReplay.accuracyScore) / 100}
                      className={cn(
                        "transition-all duration-1000",
                        currentReplay.accuracyScore >= 85 ? "text-green-500" : currentReplay.accuracyScore >= 70 ? "text-amber-500" : "text-red-500"
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black font-mono tracking-tighter">{currentReplay.accuracyScore}%</span>
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Accuracy</span>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-tighter">Precisione Modello</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Affidabilità delle previsioni passate</p>
                </div>
              </div>

              <div className="lg:col-span-8 p-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Narrativa del Replay
                  </div>
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 text-sm leading-relaxed text-foreground/80 font-medium italic">
                    "{currentReplay.narrative}"
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-background flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Gap Entrate</span>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black font-mono tracking-tighter">
                        {formatCurrency(currentReplay.actualInflows - currentReplay.predictedInflows)}
                      </p>
                      {currentReplay.actualInflows >= currentReplay.predictedInflows ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border bg-background flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Gap Uscite</span>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black font-mono tracking-tighter">
                        {formatCurrency(currentReplay.actualOutflows - currentReplay.predictedOutflows)}
                      </p>
                      {currentReplay.actualOutflows <= currentReplay.predictedOutflows ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Calibrations Section */}
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Intelligence & Calibrazioni Apprese</h4>
                <Badge variant="outline" className="text-[9px] font-black bg-primary/5 text-primary border-primary/20">MACHINE LEARNING ATTIVO</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {calibrations && calibrations.length > 0 ? (
                  calibrations.map((cal: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl border bg-background flex gap-4 items-start shadow-sm group hover:border-primary/20 transition-all">
                      <div className="p-2 rounded-lg bg-primary/5 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight text-foreground/80">{cal.target}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground font-medium mt-1">"{cal.reason}"</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-black uppercase text-primary tracking-widest">Aggiustamento:</span>
                          <Badge variant="secondary" className="text-[9px] font-mono">{cal.adjustment > 0 ? '+' : ''}{(cal.adjustment * 100).toFixed(1)}%</Badge>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-10 text-center border-2 border-dashed rounded-3xl opacity-40">
                    <BrainCircuit className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase">Il modello non ha ancora rilevato bias significativi</p>
                  </div>
                )}
              </div>
            </div>

            {/* Human Feedback Section (Feedback Loop) */}
            <div className="p-8 bg-muted/30">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="space-y-4 md:w-1/3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-lg">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-tighter">Aiuta l'AI a migliorare</h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    Ci sono eventi straordinari che i dati non mostrano? Nuovi contratti, clienti persi o investimenti in arrivo? Condividili qui per istruire il tuo Digital Twin.
                  </p>
                </div>

                <div className="flex-1 w-full space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Cosa dovrebbe sapere il modello per il futuro?</Label>
                    <Textarea 
                      placeholder="Esempio: Abbiamo risolto il problema col fornitore X, da ora in poi i costi torneranno regolari..." 
                      className="min-h-[100px] rounded-2xl bg-background border-muted shadow-inner focus-visible:ring-primary"
                      value={userNote}
                      onChange={(e) => setUserNote(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-3 w-full sm:w-auto text-center sm:text-left">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Quanto era accurata la proiezione originale?</Label>
                      <div className="flex gap-2 justify-center sm:justify-start pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button 
                            key={s} 
                            onClick={() => setRating(s)}
                            className={cn(
                              "p-1.5 rounded-full transition-all hover:scale-110",
                              rating >= s ? "text-amber-400 bg-amber-50" : "text-muted/40 hover:text-muted"
                            )}
                          >
                            <Star className={cn("h-6 w-6", rating >= s && "fill-current")} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleSubmitFeedback} 
                      disabled={isSubmittingFeedback || (!userNote && !rating)}
                      className="w-full sm:w-auto h-12 px-10 rounded-2xl gap-2 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                    >
                      {isSubmittingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Invia Feedback
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center text-center p-12 space-y-6 bg-background/50">
            <div className="p-6 rounded-full bg-primary/5">
              <History className="h-16 w-16 text-primary/20" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold">Nessun Replay Generato</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Avvia l'analisi del mese di <strong>{months.find(m => m.value === selectedMonth)?.label} {selectedYear}</strong> per confrontare le performance reali con gli obiettivi pianificati.
              </p>
            </div>
            <Button onClick={handleGenerateReplay} disabled={isGenerating} className="gap-2 shadow-lg h-11 px-8 rounded-2xl">
              <Sparkles className="h-4 w-4" />
              Genera Replay Mensile
            </Button>
          </div>
        )}
      </CardContent>
      
      {currentReplay && (
        <CardFooter className="bg-muted/20 border-t py-4">
          <div className="flex justify-between items-center w-full">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <History className="h-3 w-3" />
              Ultimo Replay: {format(new Date(currentReplay.generatedAt), 'dd MMM HH:mm')}
            </p>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] italic">
              Digital Twin Learning Engine v2.0
            </p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
