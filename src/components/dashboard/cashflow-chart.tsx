// src/components/dashboard/cashflow-chart.tsx
"use client";

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, Scadenza } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

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
    const { movements, incomeForecasts, expenseForecasts } = data;
    const year = new Date().getFullYear();

    // Calculate starting balance from all movements before the current year
    let saldo = movements
      .filter(m => new Date(m.data).getFullYear() < year)
      .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
    
    const monthsData = Array.from({ length: 12 }, (_, i) => {
        const monthName = new Date(year, i).toLocaleString('it-IT', { month: 'short' });
        let inflows = 0;
        let outflows = 0;
        const today = new Date();
        const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && i < today.getMonth());

        if (isPastMonth) {
            // Use historical data from movements
             movements.forEach(mov => {
                const movDate = new Date(mov.data);
                if (movDate.getFullYear() === year && movDate.getMonth() === i) {
                    inflows += mov.entrata || 0;
                    outflows += mov.uscita || 0;
                }
            });
        } else {
             // Use forecast data
            incomeForecasts.forEach(f => {
                const forecastDate = new Date(f.dataPrevista);
                if (forecastDate.getFullYear() === year && forecastDate.getMonth() === i) {
                    inflows += f.importoLordo * f.probabilita;
                }
            });
            expenseForecasts.forEach(f => {
                const forecastDate = new Date(f.dataScadenza);
                if (forecastDate.getFullYear() === year && forecastDate.getMonth() === i) {
                    outflows += f.importoLordo * f.probabilita;
                }
            });
        }

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
        <CardTitle>Andamento del Flusso di Cassa</CardTitle>
        <CardDescription>
          Proiezione del saldo di cassa per l'anno in corso basata su dati storici e previsionali.
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
