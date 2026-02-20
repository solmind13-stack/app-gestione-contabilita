'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, parseDate } from '@/lib/utils';
import { differenceInDays, startOfToday } from 'date-fns';
import { liquidityEarlyWarning } from '@/ai/flows/liquidity-early-warning';
import { useToast } from '@/hooks/use-toast';
import type { LiquidityAlert } from '@/lib/types/pianificazione';

interface LiquidityTrafficLightProps {
  societa: string;
  userId: string;
}

export function LiquidityTrafficLight({ societa, userId }: LiquidityTrafficLightProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const alertQuery = useMemo(() => {
    if (!firestore) return null;
    // Base query: latest alert
    let q = query(
      collection(firestore, 'liquidityAlerts'),
      orderBy('triggeredAt', 'desc'),
      limit(1)
    );
    // Filter by company if not "Tutte"
    if (societa !== 'Tutte') {
      q = query(
        collection(firestore, 'liquidityAlerts'),
        where('societa', '==', societa),
        orderBy('triggeredAt', 'desc'),
        limit(1)
      );
    }
    return q;
  }, [firestore, societa]);

  const { data: alerts, isLoading } = useCollection<LiquidityAlert>(alertQuery);
  const latestAlert = alerts?.[0];

  const handleRunAnalysis = async () => {
    if (!userId) return;
    
    setIsAnalyzing(true);
    toast({ title: "Analisi in corso", description: "L'AI sta monitorando le proiezioni di cassa..." });
    
    try {
      // Note: liquidityEarlyWarning expects a realistic projection to exist.
      // If it doesn't, it will throw an error handled in the catch block.
      await liquidityEarlyWarning({ 
        societa: societa === 'Tutte' ? 'LNC' : societa, // Default to main company if Tutte
        userId 
      });
      toast({ title: "Analisi completata", description: "Lo stato di liquidità è stato aggiornato correttamente." });
    } catch (error: any) {
      console.error("Liquidity analysis failed:", error);
      toast({ 
        variant: "destructive", 
        title: "Analisi Fallita", 
        description: error.message || "Assicurati di aver generato almeno una proiezione di cassa recente." 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="lg:col-span-4 border-2 border-primary/5">
        <CardContent className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Caricamento stato liquidità...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = startOfToday();
  const daysToCritical = latestAlert ? differenceInDays(parseDate(latestAlert.projectedDate), today) : 0;

  const statusConfig = {
    green: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/50',
      icon: CheckCircle,
      label: "Liquidità OK per i prossimi 90 giorni",
      pulse: "animate-pulse"
    },
    yellow: {
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/50',
      icon: AlertTriangle,
      label: daysToCritical > 0 
        ? `Attenzione: possibile criticità tra ${daysToCritical} giorni`
        : "Attenzione: criticità imminente",
      pulse: ""
    },
    red: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/50',
      icon: XCircle,
      label: daysToCritical > 0
        ? `URGENTE: rischio liquidità entro ${daysToCritical} giorni`
        : "URGENTE: liquidità sotto la soglia di sicurezza",
      pulse: "animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]"
    },
    none: {
      color: 'text-muted-foreground',
      bg: 'bg-muted/50',
      border: 'border-dashed border-muted-foreground/30',
      icon: Info,
      label: "In attesa di prima analisi...",
      pulse: ""
    }
  };

  const status = latestAlert?.status || 'none';
  const config = statusConfig[status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <Card className="lg:col-span-4 border-2 border-primary/5 shadow-lg overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 bg-muted/30 pb-6">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Semaforo Liquidità
            <Badge variant="outline" className="ml-2 font-mono text-[10px] uppercase tracking-wider">Real-time AI</Badge>
          </CardTitle>
          <CardDescription>Analisi predittiva dei flussi di cassa basata sugli scenari realistici</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRunAnalysis} 
          disabled={isAnalyzing}
          className="gap-2 bg-background shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"
        >
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Aggiorna Analisi
        </Button>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8 py-8">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className={cn(
            "h-56 w-56 rounded-full border-8 flex items-center justify-center transition-all duration-700 ease-in-out",
            config.bg, config.border, config.pulse
          )}>
            <div className="flex flex-col items-center">
              <Icon className={cn("h-24 w-24 mb-2", config.color)} />
              <div className={cn("h-1.5 w-12 rounded-full", config.color, "bg-current opacity-20")} />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className={cn("text-xl font-black tracking-tight uppercase", config.color)}>
              {latestAlert?.status === 'green' ? 'Situazione Ottimale' : latestAlert?.status === 'yellow' ? 'Attenzione' : latestAlert?.status === 'red' ? 'Criticità Rilevata' : 'Analisi Richiesta'}
            </p>
            <p className="text-sm font-medium text-muted-foreground italic">
              {config.label}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-6">
          {latestAlert ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Diagnosi Assistente AI</h4>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="p-5 rounded-xl bg-background border shadow-inner text-sm leading-relaxed relative">
                  <span className="absolute -top-3 left-4 bg-background px-2 text-[10px] font-bold text-primary italic">BRIEFING</span>
                  {latestAlert.message}
                </div>
              </div>

              {latestAlert.status !== 'green' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-background/50 flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data Prevista</p>
                    <p className="text-lg font-bold font-mono tracking-tighter">
                      {formatDate(latestAlert.projectedDate, 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border bg-background/50 flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saldo Stimato</p>
                    <p className={cn("text-lg font-bold font-mono tracking-tighter", latestAlert.status === 'red' ? "text-red-600" : "text-amber-600")}>
                      {formatCurrency(latestAlert.projectedBalance)}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex items-center justify-between border-t border-dashed">
                <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                  <div className={cn("h-2 w-2 rounded-full", latestAlert.status === 'green' ? "bg-green-500" : latestAlert.status === 'yellow' ? "bg-amber-500" : "bg-red-500")} />
                  Aggiornato: {formatDate(latestAlert.triggeredAt, 'dd/MM/yy HH:mm')}
                </div>
                {latestAlert.status !== 'green' && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/20 bg-amber-500/5 text-amber-600">
                    Soglia Sicurezza: 5.000€
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-2xl space-y-6 bg-muted/10">
              <div className="p-4 rounded-full bg-background shadow-sm border">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-lg">Analisi Predittiva non avviata</p>
                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-normal">
                  Attiva il monitoraggio per identificare in anticipo possibili tensioni di cassa e ricevere suggerimenti strategici.
                </p>
              </div>
              <Button onClick={handleRunAnalysis} disabled={isAnalyzing} className="px-8 shadow-md">
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Avvia Prima Analisi
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
