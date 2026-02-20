'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  addDays, 
  format, 
  isSameDay, 
  startOfToday, 
  eachDayOfInterval, 
  endOfMonth, 
  startOfMonth, 
  isSameMonth,
  isWeekend
} from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  CalendarDays, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Info, 
  CircleDollarSign, 
  Landmark,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDate } from '@/lib/utils';
import { getUpcomingFiscalDeadlines } from '@/lib/fiscal-calendar-it';
import type { 
  Movimento, 
  Scadenza, 
  PrevisioneEntrata, 
  PrevisioneUscita, 
  CashFlowProjection 
} from '@/lib/types';

const SAFETY_THRESHOLD = 5000;
const OPPORTUNITY_THRESHOLD = SAFETY_THRESHOLD * 1.2;

interface VisualTimelineProps {
  societa: string;
}

type TimelineDay = {
  date: Date;
  balance: number;
  inflows: any[];
  outflows: any[];
  isOpportunity: boolean;
  intensity: number; // -1 to 1 based on net flow
};

export function VisualTimeline({ societa }: VisualTimelineProps) {
  const firestore = useFirestore();
  const today = startOfToday();
  const endDate = addDays(today, 89); // 90 giorni

  // Data fetching
  const projQuery = useMemo(() => firestore ? query(
    collection(firestore, 'cashFlowProjections'),
    where('societa', '==', societa),
    where('scenarioType', '==', 'realistic'),
    orderBy('generatedAt', 'desc'),
    limit(1)
  ) : null, [firestore, societa]);

  const deadlinesQuery = useMemo(() => firestore ? query(
    collection(firestore, 'deadlines'),
    where('societa', '==', societa),
    where('stato', '!=', 'Pagato')
  ) : null, [firestore, societa]);

  const expForecastsQuery = useMemo(() => firestore ? query(
    collection(firestore, 'expenseForecasts'),
    where('societa', '==', societa),
    where('stato', '!=', 'Pagato')
  ) : null, [firestore, societa]);

  const incForecastsQuery = useMemo(() => firestore ? query(
    collection(firestore, 'incomeForecasts'),
    where('societa', '==', societa),
    where('stato', '!=', 'Incassato')
  ) : null, [firestore, societa]);

  const { data: projections } = useCollection<CashFlowProjection>(projQuery);
  const { data: dbDeadlines } = useCollection<Scadenza>(deadlinesQuery);
  const { data: expenseForecasts } = useCollection<PrevisioneUscita>(expForecastsQuery);
  const { data: incomeForecasts } = useCollection<PrevisioneEntrata>(incForecastsQuery);

  const fiscalDeadlines = useMemo(() => getUpcomingFiscalDeadlines(4), []);

  const timelineData = useMemo(() => {
    const days = eachDayOfInterval({ start: today, end: endDate });
    const result: TimelineDay[] = [];

    // Recuperiamo il balance base e le proiezioni settimanali
    const latestProj = projections?.[0];
    const weeklyProjections = latestProj?.weeklyProjections || [];

    days.forEach((day, index) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      
      // Filtra eventi per il giorno
      const dayInflows = [
        ...(incomeForecasts || []).filter(f => isSameDay(parseDate(f.dataPrevista), day)),
      ].map(i => ({ ...i, type: 'income' }));

      const dayOutflows = [
        ...(dbDeadlines || []).filter(d => isSameDay(parseDate(d.dataScadenza), day)),
        ...(expenseForecasts || []).filter(f => isSameDay(parseDate(f.dataScadenza), day)),
        ...(fiscalDeadlines || []).filter(f => isSameDay(parseDate(f.dueDate), day))
      ].map(o => ({ ...o, type: 'expense' }));

      // Calcolo balance approssimativo (usando la settimana corrispondente)
      const weekIndex = Math.floor(index / 7);
      const projectedBalance = weeklyProjections[weekIndex]?.cumulativeBalance || latestProj?.baseBalance || 0;

      // Net flow del giorno per intensità heatmap
      const net = dayInflows.reduce((acc, i) => acc + (i.importoLordo || 0), 0) - 
                  dayOutflows.reduce((acc, o) => acc + (o.importoLordo || o.importoPrevisto || 0), 0);
      
      const intensity = net === 0 ? 0 : net > 0 ? Math.min(1, net / 5000) : Math.max(-1, net / 5000);

      // Logica finestra ottimale
      const hasMajorOutflowSoon = days.slice(index + 1, index + 8).some(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        return dbDeadlines?.some(dl => isSameDay(parseDate(dl.dataScadenza), d) && dl.importoPrevisto > 2000) ||
               expenseForecasts?.some(ef => isSameDay(parseDate(ef.dataScadenza), d) && ef.importoLordo > 2000);
      });

      const isOpportunity = projectedBalance > OPPORTUNITY_THRESHOLD && !hasMajorOutflowSoon && dayOutflows.length === 0;

      result.push({
        date: day,
        balance: projectedBalance,
        inflows: dayInflows,
        outflows: dayOutflows,
        isOpportunity,
        intensity
      });
    });

    return result;
  }, [projections, dbDeadlines, expenseForecasts, incomeForecasts, fiscalDeadlines]);

  const months = useMemo(() => {
    const list = [];
    let currentMonth = startOfMonth(today);
    for (let i = 0; i < 3; i++) {
      list.push(currentMonth);
      currentMonth = addDays(endOfMonth(currentMonth), 1);
    }
    return list;
  }, [today]);

  const renderHeatmap = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {months.map(month => (
        <div key={month.toISOString()} className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground text-center">
            {format(month, 'MMMM yyyy', { locale: it })}
          </h4>
          <div className="grid grid-cols-7 gap-1">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} className="text-[10px] font-bold text-center text-muted-foreground/50">{d}</div>
            ))}
            {/* Padding per inizio mese */}
            {Array.from({ length: (month.getDay() + 6) % 7 }).map((_, i) => <div key={i} />)}
            
            {timelineData.filter(d => isSameMonth(d.date, month)).map(day => (
              <TooltipProvider key={day.date.toISOString()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "aspect-square rounded-sm border border-border/20 transition-all cursor-pointer hover:ring-2 hover:ring-primary",
                        day.intensity > 0 ? "bg-green-500" : day.intensity < 0 ? "bg-red-500" : "bg-muted/30",
                        isWeekend(day.date) && "opacity-40"
                      )}
                      style={{ opacity: day.intensity === 0 ? undefined : Math.max(0.2, Math.abs(day.intensity)) }}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="p-3 w-64 space-y-2">
                    <p className="font-bold border-b pb-1">{format(day.date, 'EEEE d MMMM', { locale: it })}</p>
                    <div className="space-y-1">
                      {day.inflows.map((i, idx) => (
                        <div key={idx} className="text-xs flex justify-between text-green-600 font-medium">
                          <span>{i.descrizione}</span>
                          <span>+{formatCurrency(i.importoLordo)}</span>
                        </div>
                      ))}
                      {day.outflows.map((o, idx) => (
                        <div key={idx} className="text-xs flex justify-between text-red-600 font-medium">
                          <span>{o.descrizione || o.name}</span>
                          <span>-{formatCurrency(o.importoLordo || o.importoPrevisto || o.estimatedAmount)}</span>
                        </div>
                      ))}
                      {day.inflows.length === 0 && day.outflows.length === 0 && (
                        <p className="text-[10px] italic text-muted-foreground text-center py-1">Nessun evento previsto</p>
                      )}
                    </div>
                    <div className="pt-1 border-t flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Stimato</span>
                      <span className="font-mono text-sm font-bold">{formatCurrency(day.balance)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="lg:col-span-4 shadow-md border-primary/5">
      <CardHeader className="flex flex-row items-center justify-between pb-8">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Timeline Decisionale Strategica
          </CardTitle>
          <CardDescription>Mappa dei flussi e finestre di investimento per i prossimi 90 giorni</CardDescription>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 rounded-xl">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Entrata</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Uscita</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Opportunità</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-10">
        {renderHeatmap()}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              Dettaglio Eventi e Finestre
              <Badge variant="outline" className="font-mono py-0 text-[10px]">90 GIORNI</Badge>
            </h4>
          </div>
          
          <ScrollArea className="w-full whitespace-nowrap rounded-xl border bg-muted/5">
            <div className="flex p-6 gap-4">
              {timelineData.filter(d => d.inflows.length > 0 || d.outflows.length > 0 || d.isOpportunity).map((day, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "flex-shrink-0 w-48 rounded-xl p-4 border transition-all relative overflow-hidden",
                    day.isOpportunity ? "bg-amber-50/50 border-amber-200 ring-1 ring-amber-200" : "bg-background border-border shadow-sm"
                  )}
                >
                  {day.isOpportunity && (
                    <div className="absolute top-0 right-0 p-1.5 bg-amber-400 text-white rounded-bl-lg">
                      <CircleDollarSign className="h-3.5 w-3.5" />
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">
                        {format(day.date, 'EEEE', { locale: it })}
                      </p>
                      <p className="text-sm font-black tracking-tight">
                        {format(day.date, 'd MMMM', { locale: it })}
                      </p>
                    </div>

                    <div className="space-y-2 h-20 overflow-y-auto pr-1">
                      {day.inflows.map((i, k) => (
                        <div key={k} className="flex items-center gap-2">
                          <ArrowUpCircle className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="text-[10px] font-medium truncate">{i.descrizione}</span>
                        </div>
                      ))}
                      {day.outflows.map((o, k) => (
                        <div key={k} className="flex items-center gap-2">
                          <ArrowDownCircle className="h-3 w-3 text-red-500 shrink-0" />
                          <span className="text-[10px] font-medium truncate">{o.descrizione || o.name}</span>
                        </div>
                      ))}
                      {day.isOpportunity && (
                        <div className="flex items-center gap-2 text-amber-600">
                          <Sparkles className="h-3 w-3 shrink-0" />
                          <span className="text-[10px] font-bold italic">Finestra Investimento</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Balance Stimato</span>
                      <span className={cn(
                        "text-xs font-mono font-bold",
                        day.balance < SAFETY_THRESHOLD ? "text-red-600" : "text-foreground"
                      )}>
                        {formatCurrency(day.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <div className="flex gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Come leggere la Timeline Decisionale</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Il sistema analizza le tue scadenze e proiezioni per identificare le <span className="text-amber-600 font-bold">Finestre di Opportunità</span>. 
              Questi periodi indicano che hai liquidità sufficiente (oltre 6.000€) e non sono previste uscite importanti nella settimana successiva. 
              È il momento ideale per acquisti discrezionali o investimenti in marketing/attrezzature.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
