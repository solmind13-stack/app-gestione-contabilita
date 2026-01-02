// src/components/dashboard/cashflow-chart.tsx
"use client";

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, Scadenza } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const chartConfig = {
  saldo: {
    label: 'Saldo Cassa',
    color: 'hsl(var(--chart-1))',
  },
};

interface CashflowChartProps {
  data: {
    movements: Movimento[];
    incomeForecasts: PrevisioneEntrata[];
    expenseForecasts: PrevisioneUscita[];
    deadlines: Scadenza[];
  };
}

export function CashflowChart({ data }: CashflowChartProps) {
  const chartData = useMemo(() => {
    const { movements, incomeForecasts, expenseForecasts, deadlines } = data;
    const today = new Date();
    
    // Calculate starting balance from all historical data before this month
    const startOfCurrentMonth = startOfMonth(today);
    let saldo = movements
      .filter(m => new Date(m.data) < startOfCurrentMonth)
      .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
      
    // Subtract paid deadlines from before this month
    saldo -= deadlines
        .filter(s => s.stato === 'Pagato' && s.dataPagamento && new Date(s.dataPagamento) < startOfCurrentMonth)
        .reduce((acc, s) => acc + s.importoPagato, 0);

    const monthsData = Array.from({ length: 12 }, (_, i) => {
        const targetMonthDate = addMonths(startOfCurrentMonth, i);
        const monthStart = startOfMonth(targetMonthDate);
        const monthEnd = endOfMonth(targetMonthDate);
        const monthName = new Date(monthStart).toLocaleString('it-IT', { month: 'short' });

        let inflows = 0;
        let outflows = 0;
        
        // Use historical data for the current month up to today
        if (i === 0) {
            movements.forEach(mov => {
                const movDate = new Date(mov.data);
                if (isWithinInterval(movDate, { start: monthStart, end: today })) {
                    inflows += mov.entrata || 0;
                    outflows += mov.uscita || 0;
                }
            });
            deadlines.forEach(s => {
                if(s.stato === 'Pagato' && s.dataPagamento && isWithinInterval(new Date(s.dataPagamento), { start: monthStart, end: today })) {
                    outflows += s.importoPagato;
                }
            });
        }
        
        // Add forecasts for the future part of the current month and all future months
        incomeForecasts.forEach(f => {
            const forecastDate = new Date(f.dataPrevista);
             if (isWithinInterval(forecastDate, { start: (i === 0 ? today : monthStart), end: monthEnd })) {
                inflows += f.importoLordo * f.probabilita;
            }
        });
        
        expenseForecasts.forEach(f => {
            const forecastDate = new Date(f.dataScadenza);
             if (isWithinInterval(forecastDate, { start: (i === 0 ? today : monthStart), end: monthEnd })) {
                outflows += f.importoLordo * f.probabilita;
            }
        });
        
        deadlines.forEach(s => {
            const deadlineDate = new Date(s.dataScadenza);
            if (s.stato !== 'Pagato' && isWithinInterval(deadlineDate, { start: (i === 0 ? today : monthStart), end: monthEnd })) {
                outflows += (s.importoPrevisto - s.importoPagato);
            }
        })


        saldo = saldo + inflows - outflows;
        return {
            month: monthName,
            saldo: saldo
        }
    });

    return monthsData;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Andamento del Flusso di Cassa (12 Mesi)</CardTitle>
        <CardDescription>
          Proiezione del saldo di cassa per i prossimi 12 mesi basata su dati storici e previsionali.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickFormatter={(value) => `€${Number(value) / 1000}k`}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={['dataMin - 10000', 'dataMax + 10000']}
              />
              <Tooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" formatter={(value: number) => formatCurrency(value)} />}
              />
              <defs>
                <linearGradient id="fillSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-saldo)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-saldo)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area
                dataKey="saldo"
                type="natural"
                fill="url(#fillSaldo)"
                stroke="var(--color-saldo)"
                stackId="a"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
