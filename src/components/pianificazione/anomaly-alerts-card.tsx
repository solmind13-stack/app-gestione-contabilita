'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Sparkles, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { detectAnomalies } from '@/ai/flows/detect-anomalies';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AnomalyAlert } from '@/lib/types';

interface AnomalyAlertsCardProps {
  societa: string;
  userId: string;
}

export function AnomalyAlertsCard({ societa, userId }: AnomalyAlertsCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Recupero anomalie in attesa
  const alertsQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(
      collection(firestore, 'anomalyAlerts'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, societa]);

  const { data: alerts, isLoading } = useCollection<AnomalyAlert>(alertsQuery);

  const handleRunAnalysis = async () => {
    if (!userId) return;
    
    setIsAnalyzing(true);
    toast({ 
      title: 'Analisi Anomalie', 
      description: 'L\'AI sta confrontando i movimenti recenti con lo storico annuale...' 
    });

    try {
      await detectAnomalies({ societa: societa === 'Tutte' ? 'LNC' : societa, userId });
      toast({ 
        title: 'Analisi Completata', 
        description: 'Il controllo di conformità delle spese è terminato.',
        className: 'bg-green-100 dark:bg-green-900'
      });
    } catch (error: any) {
      console.error("Anomaly detection failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore', 
        description: 'Impossibile completare l\'analisi delle anomalie.' 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStatusUpdate = async (alertId: string, status: 'confirmed' | 'dismissed') => {
    if (!firestore) return;
    try {
      const alertRef = doc(firestore, 'anomalyAlerts', alertId);
      await updateDoc(alertRef, { status });
      toast({ 
        title: status === 'confirmed' ? 'Anomalia Confermata' : 'Segnalazione Ignorata',
        description: status === 'confirmed' ? 'Il movimento è stato validato.' : 'L\'avviso è stato rimosso.'
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare lo stato.' });
    }
  };

  return (
    <Card className="lg:col-span-2 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Anomalie Rilevate
            {alerts && alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 min-w-[20px] justify-center font-mono">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Analisi scostamenti rispetto ai pattern storici</CardDescription>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRunAnalysis} 
          disabled={isAnalyzing || isLoading}
          className="gap-2 h-8 text-xs font-bold"
        >
          {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Analizza
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const isHighSeverity = alert.amount > alert.expectedRange.max * 1.5;
              
              return (
                <div key={alert.id} className="p-4 rounded-xl border bg-muted/30 flex flex-col gap-3 relative overflow-hidden group">
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    isHighSeverity ? "bg-red-500" : "bg-amber-500"
                  )} />
                  
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isHighSeverity ? <ShieldAlert className="h-4 w-4 text-red-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        <span className="text-sm font-black">{alert.category}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                          {isHighSeverity ? 'Alta' : 'Media'}
                        </Badge>
                      </div>
                      <p className="text-lg font-mono font-bold text-foreground tracking-tighter">
                        {formatCurrency(alert.amount)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleStatusUpdate(alert.id, 'confirmed')}
                        title="Conferma correttezza"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleStatusUpdate(alert.id, 'dismissed')}
                        title="Ignora segnalazione"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3 py-1">
                      "{alert.description}"
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest bg-background/50 p-1.5 rounded-lg border border-border/50">
                      <History className="h-3 w-3" />
                      Range Atteso: {formatCurrency(alert.expectedRange.min)} - {formatCurrency(alert.expectedRange.max)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-2xl bg-muted/5 group">
            <div className="p-3 rounded-full bg-green-50 text-green-600 border border-green-100 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-bold">Nessuna anomalia rilevata</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
              Tutte le spese recenti rientrano nei parametri storici previsti.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
