'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  Info,
  ArrowRight,
  ExternalLink,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchSectorBenchmarks } from '@/ai/flows/fetch-sector-benchmarks';
import { formatCurrency, cn } from '@/lib/utils';

interface SectorBenchmarkCardProps {
  societa: string;
  userId: string;
}

export function SectorBenchmarkCard({ societa, userId }: SectorBenchmarkCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // Recupero l'ultimo benchmark salvato
  const benchmarkQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(
      collection(firestore, 'externalInsights'),
      where('type', '==', 'benchmark'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, societa]);

  const { data: results, isLoading } = useCollection<any>(benchmarkQuery);
  const latestBenchmark = results?.[0];

  const handleUpdate = async () => {
    if (!userId) return;
    setIsUpdating(true);
    toast({ 
      title: 'Aggiornamento Benchmark', 
      description: 'L\'AI sta analizzando i KPI e confrontandoli con le medie di settore ISTAT/Cerved...' 
    });

    try {
      await fetchSectorBenchmarks({ 
        societa: societa === 'Tutte' ? 'LNC' : societa, 
        userId 
      });
      toast({ 
        title: 'Benchmark Aggiornati', 
        description: 'L\'analisi comparativa è pronta.',
        className: 'bg-green-100 dark:bg-green-900'
      });
    } catch (error: any) {
      console.error("Benchmark update failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore', 
        description: error.message || 'Impossibile recuperare i benchmark.' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getComparisonIcon = (comparison: string, kpiName: string) => {
    const lowerKpi = kpiName.toLowerCase();
    const isCostKpi = lowerKpi.includes('costi') || lowerKpi.includes('spesa') || lowerKpi.includes('incidenza');
    
    if (comparison === 'in_line') return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
    
    if (comparison === 'above') {
      // Se è un costo, stare sopra la media è negativo (rosso)
      return <TrendingUp className={cn("h-4 w-4", isCostKpi ? "text-red-500" : "text-green-500")} />;
    } else {
      // Se è un costo, stare sotto la media è positivo (verde)
      return <TrendingDown className={cn("h-4 w-4", isCostKpi ? "text-green-500" : "text-red-500")} />;
    }
  };

  return (
    <Card className="lg:col-span-4 shadow-xl border-primary/5 overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Benchmark di Settore
            </CardTitle>
            {latestBenchmark && (
              <Badge variant="outline" className="bg-background font-mono text-[10px] uppercase tracking-widest px-2">
                Settore: {latestBenchmark.sector}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Confronto KPI aziendali vs medie nazionali (ISTAT / CERVED)
          </CardDescription>
        </div>
        <Button onClick={handleUpdate} disabled={isUpdating} size="sm" className="gap-2 font-bold uppercase tracking-tighter text-[10px] h-9">
          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Aggiorna Benchmark
        </Button>
      </CardHeader>
      
      <CardContent className="py-8 space-y-10">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : latestBenchmark ? (
          <>
            {/* KPI Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {latestBenchmark.benchmarks.map((kpi: any, idx: number) => {
                const maxVal = Math.max(kpi.companyValue, kpi.sectorAverage) * 1.2;
                const companyPercent = (kpi.companyValue / maxVal) * 100;
                const sectorPercent = (kpi.sectorAverage / maxVal) * 100;
                
                return (
                  <div key={idx} className="space-y-3 group">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-tight text-foreground/80">{kpi.kpiName}</p>
                        <div className="flex items-center gap-2">
                          {getComparisonIcon(kpi.comparison, kpi.kpiName)}
                          <span className="text-xs font-medium text-muted-foreground">{kpi.insight}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-mono text-[10px]">{kpi.comparison.replace('_', ' ')}</Badge>
                    </div>

                    <div className="relative pt-4 pb-2">
                      {/* Comparison Bar */}
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex relative">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            kpi.comparison === 'in_line' ? "bg-muted-foreground/40" : 
                            ((kpi.comparison === 'above' && !kpi.kpiName.toLowerCase().includes('costi')) || (kpi.comparison === 'below' && kpi.kpiName.toLowerCase().includes('costi'))) ? "bg-green-500" : "bg-red-500"
                          )}
                          style={{ width: `${companyPercent}%` }}
                        />
                      </div>
                      {/* Sector Average Marker */}
                      <div 
                        className="absolute top-0 flex flex-col items-center gap-1 transition-all duration-1000"
                        style={{ left: `${sectorPercent}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="h-10 w-0.5 bg-primary/40 border-x border-background" />
                        <span className="text-[8px] font-black uppercase tracking-tighter bg-primary text-primary-foreground px-1 rounded">Media</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest pt-1">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">La tua Azienda</span>
                        <span className="text-sm font-black font-mono tracking-tighter">
                          {kpi.kpiName.toLowerCase().includes('%') ? `${kpi.companyValue.toFixed(1)}%` : formatCurrency(kpi.companyValue)}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-muted-foreground">Media Settore</span>
                        <span className="text-sm font-black font-mono tracking-tighter opacity-60">
                          {kpi.kpiName.toLowerCase().includes('%') ? `${kpi.sectorAverage.toFixed(1)}%` : formatCurrency(kpi.sectorAverage)}
                        </span>
                      </div>
                    </div>

                    {kpi.suggestion && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-dashed border-primary/20 flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed font-medium text-primary/80">{kpi.suggestion}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Narrative Briefing */}
            <div className="p-6 rounded-2xl bg-muted/30 border relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Target className="h-16 w-16" />
              </div>
              <div className="flex items-center gap-2 mb-4 text-xs font-black uppercase tracking-widest text-primary">
                <Sparkles className="h-4 w-4" />
                Sintesi Posizionamento di Mercato
              </div>
              <p className="text-sm leading-relaxed text-foreground/80 font-medium italic">
                "{latestBenchmark.narrative}"
              </p>
            </div>
          </>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
            <div className="p-4 rounded-full bg-primary/5">
              <Globe className="h-12 w-12 text-primary/30" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold">Nessun Benchmark Generato</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Avvia l'analisi per confrontare i tuoi KPI con le medie di settore e individuare opportunità di efficientamento.
              </p>
            </div>
            <Button onClick={handleUpdate} disabled={isUpdating} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Recupera Dati di Settore
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 border-t py-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/70 uppercase">
            <AlertCircle className="h-3.5 w-3.5" />
            {latestBenchmark?.disclaimer || "I benchmark sono stime basate su dati pubblici di settore."}
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1 hover:text-primary cursor-pointer transition-colors">
              <ExternalLink className="h-3 w-3" /> Report ISTAT
            </span>
            <span className="flex items-center gap-1 hover:text-primary cursor-pointer transition-colors">
              <ExternalLink className="h-3 w-3" /> Analisi Cerved
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
