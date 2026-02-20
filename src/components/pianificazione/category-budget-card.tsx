'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, parseDate } from '@/lib/utils';
import { 
  startOfMonth, 
  subMonths, 
  isWithinInterval, 
  endOfMonth,
  format
} from 'date-fns';
import { it } from 'date-fns/locale';
import type { Movimento } from '@/lib/types';

interface CategoryBudgetCardProps {
  societa: string;
}

interface BudgetData {
  category: string;
  currentSpent: number;
  suggestedBudget: number;
  deviation: number;
  historyCount: number;
  trend: 'up' | 'down' | 'stable';
}

export function CategoryBudgetCard({ societa }: CategoryBudgetCardProps) {
  const firestore = useFirestore();
  
  const today = startOfToday();
  const currentMonthStart = startOfMonth(today);
  const sixMonthsAgoStart = startOfMonth(subMonths(today, 6));

  const movementsQuery = useMemo(() => {
    if (!firestore) return null;
    let q = query(
      collection(firestore, 'movements'),
      where('data', '>=', sixMonthsAgoStart.toISOString().split('T')[0])
    );
    if (societa !== 'Tutte') {
      q = query(q, where('societa', '==', societa));
    }
    return q;
  }, [firestore, societa, sixMonthsAgoStart]);

  const { data: movements, isLoading } = useCollection<Movimento>(movementsQuery);

  const budgetStats = useMemo(() => {
    if (!movements) return [];

    const categoriesMap: Record<string, { current: number; historical: number[]; months: Set<string> }> = {};

    movements.forEach(m => {
      if (m.uscita <= 0) return; // Solo uscite
      
      const cat = m.categoria || 'Altro';
      const mDate = parseDate(m.data);
      const monthKey = format(mDate, 'yyyy-MM');

      if (!categoriesMap[cat]) {
        categoriesMap[cat] = { current: 0, historical: Array(6).fill(0), months: new Set() };
      }

      if (isWithinInterval(mDate, { start: currentMonthStart, end: endOfMonth(today) })) {
        categoriesMap[cat].current += m.uscita;
      } else {
        // Calcola l'indice del mese passato (0 = mese scorso, 5 = 6 mesi fa)
        for (let i = 1; i <= 6; i++) {
          const start = startOfMonth(subMonths(currentMonthStart, i));
          const end = endOfMonth(start);
          if (isWithinInterval(mDate, { start, end })) {
            categoriesMap[cat].historical[i-1] += m.uscita;
            categoriesMap[cat].months.add(monthKey);
            break;
          }
        }
      }
    });

    const results: BudgetData[] = Object.entries(categoriesMap).map(([cat, data]) => {
      // Calcolo media ponderata: peso 6 per mese scorso, peso 1 per 6 mesi fa
      let weightedSum = 0;
      let totalWeight = 0;
      const weights = [6, 5, 4, 3, 2, 1];

      data.historical.forEach((val, i) => {
        if (val > 0 || i < 2) { // Consideriamo anche mesi a zero se recenti
          weightedSum += val * weights[i];
          totalWeight += weights[i];
        }
      });

      const suggestedBudget = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const deviation = suggestedBudget > 0 ? ((data.current / suggestedBudget) - 1) * 100 : 0;
      
      // Calcolo trend (confronto mese scorso vs media precedente)
      const lastMonth = data.historical[0];
      const prevMonthsAvg = data.historical.slice(1).reduce((a, b) => a + b, 0) / 5;
      let trend: BudgetData['trend'] = 'stable';
      if (lastMonth > prevMonthsAvg * 1.1) trend = 'up';
      else if (lastMonth < prevMonthsAvg * 0.9) trend = 'down';

      return {
        category: cat,
        currentSpent: data.current,
        suggestedBudget,
        deviation,
        historyCount: data.months.size,
        trend
      };
    });

    // Ordiniamo per deviazione decrescente (sforamenti in alto)
    return results.sort((a, b) => b.deviation - a.deviation);
  }, [movements, currentMonthStart, today]);

  const totals = useMemo(() => {
    return budgetStats.reduce((acc, curr) => ({
      spent: acc.spent + curr.currentSpent,
      budget: acc.budget + curr.suggestedBudget
    }), { spent: 0, budget: 0 });
  }, [budgetStats]);

  const totalPercent = totals.budget > 0 ? (totals.spent / totals.budget) * 100 : 0;

  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader><Skeleton className="h-8 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Budget per Categoria
          </CardTitle>
          <CardDescription className="text-xs">
            Spesa corrente vs Media ponderata (ultimi 6 mesi)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {budgetStats.length > 0 ? (
          <div className="space-y-5">
            {budgetStats.map((stat) => {
              const percent = stat.suggestedBudget > 0 ? (stat.currentSpent / stat.suggestedBudget) * 100 : 0;
              const isOver = percent > 100;
              const isWarning = percent > 80 && percent <= 100;
              const hasInsufficientData = stat.historyCount < 3;

              return (
                <div key={stat.category} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{stat.category}</span>
                        {stat.trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
                        {stat.trend === 'down' && <TrendingDown className="h-3 w-3 text-green-500" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {formatCurrency(stat.currentSpent)} / {formatCurrency(stat.suggestedBudget)}
                      </p>
                    </div>
                    <div className="text-right">
                      {hasInsufficientData ? (
                        <span className="text-[10px] text-muted-foreground italic">Dati insufficienti</span>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] font-bold h-5",
                            isOver ? "border-red-500 text-red-600 bg-red-50" : "text-muted-foreground"
                          )}
                        >
                          {isOver ? `+${stat.deviation.toFixed(0)}%` : `${stat.deviation.toFixed(0)}%`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress 
                    value={Math.min(percent, 100)} 
                    className="h-2"
                    indicatorClassName={cn(
                      isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-green-500"
                    )}
                  />
                </div>
              );
            })}

            <div className="pt-4 border-t border-dashed">
              <div className="flex justify-between items-center px-1">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Totale Uscite Mese</p>
                  <p className="text-sm font-black">{formatCurrency(totals.spent)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Utilizzo Budget</p>
                  <p className={cn(
                    "text-sm font-black",
                    totalPercent > 100 ? "text-red-600" : "text-primary"
                  )}>
                    {totalPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-xl bg-muted/30">
            <Info className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Nessun movimento di spesa rilevato negli ultimi 6 mesi</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper locale non esportato se non necessario altrove
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
