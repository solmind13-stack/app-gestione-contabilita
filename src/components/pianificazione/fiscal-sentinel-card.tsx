'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShieldAlert, 
  Gift, 
  Scale, 
  CalendarClock, 
  Coins, 
  TrendingUp, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  ArrowRight,
  Info,
  CheckCircle2,
  FileText,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fiscalSentinel } from '@/ai/flows/fiscal-sentinel';
import { formatDate, parseDate, cn, formatCurrency } from '@/lib/utils';
import { differenceInDays, startOfToday } from 'date-fns';

interface FiscalSentinelCardProps {
  societa: string;
  userId: string;
}

export function FiscalSentinelCard({ societa, userId }: FiscalSentinelCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  // Recupero l'ultimo aggiornamento fiscale salvato
  const sentinelQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(
      collection(firestore, 'externalInsights'),
      where('type', '==', 'fiscal_updates'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, societa]);

  const { data: results, isLoading } = useCollection<any>(sentinelQuery);
  const latestData = results?.[0];

  const handleUpdate = async () => {
    if (!userId) return;
    setIsUpdating(true);
    toast({ 
      title: 'Monitoraggio Fiscale', 
      description: 'L\'AI sta analizzando le ultime circolari AdE e decreti legge per il tuo profilo...' 
    });

    try {
      await fiscalSentinel({ 
        societa: societa === 'Tutte' ? 'LNC' : societa, 
        userId 
      });
      toast({ 
        title: 'Radar Fiscale Aggiornato', 
        description: 'Le ultime novità normative sono pronte.',
        className: 'bg-green-100 dark:bg-green-900'
      });
    } catch (error: any) {
      console.error("Fiscal sentinel update failed:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore', 
        description: error.message || 'Impossibile recuperare le novità fiscali.' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const sortedUpdates = useMemo(() => {
    if (!latestData?.updates) return [];
    const urgencyMap: Record<string, number> = { alta: 3, media: 2, bassa: 1 };
    return [...latestData.updates].sort((a, b) => urgencyMap[b.urgency] - urgencyMap[a.urgency]);
  }, [latestData]);

  const stats = useMemo(() => {
    if (!sortedUpdates) return { total: 0, urgent: 0 };
    return {
      total: sortedUpdates.length,
      urgent: sortedUpdates.filter((u: any) => u.urgency === 'alta').length
    };
  }, [sortedUpdates]);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'bonus': return { icon: Gift, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'BONUS' };
      case 'obbligo': return { icon: Scale, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'OBBLIGO' };
      case 'scadenza': return { icon: CalendarClock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'SCADENZA' };
      case 'agevolazione': return { icon: Coins, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'AGEVOLAZIONE' };
      case 'modifica_aliquota': return { icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', label: 'ALIQUOTA' };
      default: return { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-border', label: 'INFO' };
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'alta': return <Badge variant="destructive" className="font-black animate-pulse">ALTA</Badge>;
      case 'media': return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 font-black">MEDIA</Badge>;
      default: return <Badge variant="secondary" className="font-black opacity-60">BASSA</Badge>;
    }
  };

  return (
    <Card className="lg:col-span-2 shadow-xl border-primary/5 overflow-hidden flex flex-col h-full bg-background/50 backdrop-blur-sm">
      <CardHeader className="bg-muted/30 border-b pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" />
              Fiscal Sentinel
            </CardTitle>
            {latestData && (
              <Badge variant="outline" className="bg-background font-mono text-[10px] uppercase tracking-widest px-2">
                {stats.total} novità ({stats.urgent} urgenti)
              </Badge>
            )}
          </div>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monitoraggio legislativo e radar agevolazioni</CardDescription>
        </div>
        <Button onClick={handleUpdate} disabled={isUpdating} size="sm" variant="outline" className="gap-2 font-bold uppercase tracking-tighter text-[10px] h-9 bg-background shadow-sm">
          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Radar
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : latestData ? (
          <ScrollArea className="h-[500px]">
            <div className="p-6 space-y-8">
              {/* Opportunities Highlights */}
              {sortedUpdates.some((u: any) => u.type === 'bonus' || u.type === 'agevolazione') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-green-600">Opportunità di Risparmio</h4>
                    <div className="h-px flex-1 bg-green-100" />
                  </div>
                  <div className="grid gap-4">
                    {sortedUpdates.filter((u: any) => u.type === 'bonus' || u.type === 'agevolazione').map((opp: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-2xl bg-green-50/50 border border-green-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute -top-4 -right-4 opacity-5 group-hover:scale-110 transition-transform">
                          <Gift className="h-24 w-24 text-green-600" />
                        </div>
                        <div className="flex justify-between items-start mb-2">
                          <Badge className="bg-green-600 text-white font-black text-[9px] px-1.5 h-5">{opp.type.toUpperCase()}</Badge>
                          <span className="text-[9px] font-black text-green-700/60 uppercase tracking-tighter">New Opportunity</span>
                        </div>
                        <h5 className="text-sm font-black mb-1">{opp.title}</h5>
                        <p className="text-xs text-green-800/70 leading-relaxed mb-3 font-medium italic">"{opp.impact}"</p>
                        <div className="bg-white/60 p-2.5 rounded-xl border border-green-200 flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          <p className="text-[11px] font-bold text-green-900">{opp.actionRequired}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Updates */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Feed Aggiornamenti</h4>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                <div className="grid gap-6">
                  {sortedUpdates.map((update: any, idx: number) => {
                    const style = getTypeStyle(update.type);
                    const Icon = style.icon;
                    const today = startOfToday();
                    const daysLeft = update.deadline ? differenceInDays(parseDate(update.deadline), today) : null;

                    return (
                      <div key={idx} className="flex gap-4 group">
                        <div className={cn("mt-1 p-2 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 border transition-all duration-300 group-hover:scale-110", style.bg, style.border, style.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-sm font-black leading-none group-hover:text-primary transition-colors truncate">{update.title}</h5>
                            <div className="shrink-0 flex items-center gap-2 scale-75 origin-right">
                                {getUrgencyBadge(update.urgency)}
                            </div>
                          </div>
                          
                          <p className="text-xs leading-relaxed text-muted-foreground font-medium line-clamp-2">
                            {update.description}
                          </p>

                          <div className="flex items-start gap-2 text-[10px] font-bold text-foreground/80 bg-muted/30 p-2 rounded-lg border border-transparent group-hover:border-border transition-colors">
                            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5 opacity-50" />
                            <p className="leading-normal">{update.impact}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 text-primary rounded-md border border-primary/10">
                              <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Azione:</span>
                              <span className="text-[10px] font-bold">{update.actionRequired}</span>
                            </div>
                            {update.deadline && (
                              <div className="flex items-center gap-1 text-[9px] font-black uppercase text-muted-foreground/60 tracking-tighter">
                                <CalendarClock className="h-3 w-3" />
                                Scadenza: {formatDate(update.deadline)} {daysLeft !== null && `(tra ${daysLeft}gg)`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="p-6 rounded-full bg-primary/5">
              <ShieldAlert className="h-16 w-16 text-primary/30" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold">Radar Fiscale Inattivo</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Avvia il monitoraggio per scansionare le ultime novità normative e identificare bonus rilevanti per la tua società.
              </p>
            </div>
            <Button onClick={handleUpdate} disabled={isUpdating} className="gap-2 shadow-lg h-11 px-8 rounded-2xl">
              <Sparkles className="h-4 w-4" />
              Attiva Sentinel
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/20 border-t py-4">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wide">
            <AlertCircle className="h-3 w-3" />
            {latestData?.disclaimer || "Informazioni basate sulla conoscenza dell'IA. Non costituiscono consulenza professionale."}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 italic">
                <ArrowRight className="h-3 w-3" /> 
                Verifica sempre con il tuo commercialista
            </p>
            {latestData && (
                <p className="text-[8px] font-bold text-muted-foreground uppercase">
                    Sync: {formatDate(latestData.createdAt, 'dd/MM/yy HH:mm')}
                </p>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
