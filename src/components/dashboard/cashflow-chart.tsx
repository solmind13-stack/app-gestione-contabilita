// src/components/dashboard/cashflow-chart.tsx
"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';

const chartConfig = {
  saldo: {
    label: 'Saldo Cassa',
    color: 'hsl(var(--chart-1))',
  },
};

interface CashflowChartProps {
  data: {
    month: string;
    saldo: number;
  }[];
}

export function CashflowChart({ data: chartData }: CashflowChartProps) {
  
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
