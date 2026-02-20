'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Sparkles, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateEntityScores } from '@/ai/flows/calculate-entity-scores';
import { cn } from '@/lib/utils';
import type { EntityScore } from '@/lib/types/pianificazione';

interface EntityScoresCardProps {
  societa: string;
  userId: string;
}

export function EntityScoresCard({ societa, userId }: EntityScoresCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // Recupero gli score salvati per l'utente e la società
  const scoresQuery = useMemo(() => {
    if (!firestore || !userId) return null;
    let q = query(collection(firestore, 'users', userId, 'entityScores'));
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, userId, societa]);

  const { data: scores, isLoading: isLoadingScores } = useCollection<EntityScore>(scoresQuery);

  const handleUpdateScores = async () => {
    if (!userId) return;
    
    setIsUpdating(true);
    toast({ 
      title: 'Aggiornamento Score', 
      description: 'L\'AI sta analizzando lo storico dei movimenti per valutare l\'affidabilità...' 
    });

    try {
      await calculateEntityScores({ societa, userId });
      toast({ 
        title: 'Score Aggiornati', 
        description: 'L\'analisi dei pagamenti è stata completata con successo.',
        className: 'bg-green-100 dark:bg-green-900'
      });
    } catch (error: any) {
      console.error("Entity scores update failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore', 
        description: 'Impossibile aggiornare gli score in questo momento.' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const { clients, suppliers } = useMemo(() => {
    const list = scores || [];
    // Ordiniamo dal peggiore al migliore per mettere in risalto i problemi
    const sorted = [...list].sort((a, b) => a.reliabilityScore - b.reliabilityScore);
    
    return {
      clients: sorted.filter(s => s.entityType === 'client'),
      suppliers: sorted.filter(s => s.entityType === 'supplier')
    };
  }, [scores]);

  const renderTrendIcon = (score: EntityScore) => {
    if (!score.history || score.history.length < 2) return <Minus className="h-3 w-3 text-muted-foreground" />;
    
    const latest = score.history[score.history.length - 1].score;
    const previous = score.history[score.history.length - 2].score;
    
    if (latest > previous) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (latest < previous) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const renderScoreRow = (score: EntityScore) => {
    const isRed = score.reliabilityScore < 50;
    const isYellow = score.reliabilityScore >= 50 && score.reliabilityScore <= 75;
    const isGreen = score.reliabilityScore > 75;

    return (
      <div key={score.id} className="group relative flex flex-col gap-2 p-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <p className="text-sm font-bold truncate max-w-[180px]">{score.entityName}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                {score.totalTransactions} transazioni
              </span>
              <span className="text-[10px] text-muted-foreground">•</span>
              <span className={cn(
                "text-[10px] font-bold uppercase",
                score.averagePaymentDelay > 15 ? "text-red-500" : "text-muted-foreground"
              )}>
                ritardo: {score.averagePaymentDelay}gg
              </span>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              {renderTrendIcon(score)}
              <span className={cn(
                "text-sm font-black tabular-nums",
                isRed ? "text-red-600" : isYellow ? "text-amber-600" : "text-green-600"
              )}>
                {score.reliabilityScore}
              </span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Score</span>
          </div>
        </div>
        <Progress 
          value={score.reliabilityScore} 
          className="h-1.5" 
          indicatorClassName={cn(
            isRed ? "bg-red-500" : isYellow ? "bg-amber-500" : "bg-green-500"
          )}
        />
      </div>
    );
  };

  return (
    <Card className="lg:col-span-2 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Score Affidabilità
          </CardTitle>
          <CardDescription>Valutazione AI su puntualità pagamenti</CardDescription>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleUpdateScores} 
          disabled={isUpdating || isLoadingScores}
          className="h-8 gap-2 text-xs font-bold uppercase tracking-wider hover:bg-primary/5 hover:text-primary"
        >
          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Aggiorna
        </Button>
      </CardHeader>
      <CardContent>
        {isLoadingScores ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : scores && scores.length > 0 ? (
          <Tabs defaultValue="suppliers" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="suppliers" className="rounded-lg data-[state=active]:shadow-sm">
                Fornitori <Badge variant="secondary" className="ml-2 scale-75 px-1.5 opacity-70">{suppliers.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="clients" className="rounded-lg data-[state=active]:shadow-sm">
                Clienti <Badge variant="secondary" className="ml-2 scale-75 px-1.5 opacity-70">{clients.length}</Badge>
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[320px] pr-4 -mr-4">
              <TabsContent value="suppliers" className="space-y-1 mt-0">
                {suppliers.length > 0 ? (
                  suppliers.map(renderScoreRow)
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <p className="text-sm">Nessun fornitore analizzato</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="clients" className="space-y-1 mt-0">
                {clients.length > 0 ? (
                  clients.map(renderScoreRow)
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <p className="text-sm">Nessun cliente analizzato</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="h-[350px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-2xl bg-muted/5 group">
            <div className="p-4 rounded-full bg-background shadow-sm border group-hover:scale-110 transition-transform">
              <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="mt-4 font-bold text-muted-foreground">Nessun punteggio calcolato</p>
            <p className="mt-2 text-xs text-muted-foreground/70 max-w-[200px] leading-relaxed">
              Analizza lo storico dei pagamenti per valutare l'affidabilità delle tue controparti.
            </p>
            <Button onClick={handleUpdateScores} variant="outline" className="mt-6 gap-2 border-primary/20 hover:bg-primary/5">
              <Sparkles className="h-4 w-4" />
              Calcola Score Ora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
