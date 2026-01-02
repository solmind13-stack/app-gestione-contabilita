"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, Scadenza } from '@/lib/types';
import { formatCurrency } from "@/lib/utils";

const chartConfig = {
  entrate: {
    label: "Entrate",
    color: "hsl(var(--chart-2))",
  },
  uscite: {
    label: "Uscite",
    color: "hsl(var(--chart-4))",
  },
}

interface OverviewChartProps {
  data: {
    movements: Movimento[];
    incomeForecasts: PrevisioneEntrata[];
    expenseForecasts: PrevisioneUscita[];
    deadlines: Scadenza[];
  }
}

export function OverviewChart({ data }: OverviewChartProps) {
  const chartData = useMemo(() => {
    const { movements, incomeForecasts, expenseForecasts } = data;
    const year = new Date().getFullYear();
    const monthsData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleString('it-IT', { month: 'short' }),
      entrate: 0,
      uscite: 0,
    }));

    const processData = (item: Movimento | PrevisioneEntrata | PrevisioneUscita, isForecast: boolean) => {
      let date, income, expense, probability = 1;
      if ('data' in item) { // Movimento
        date = new Date(item.data);
        income = item.entrata;
        expense = item.uscita;
      } else if ('dataPrevista' in item) { // PrevisioneEntrata
        date = new Date(item.dataPrevista);
        income = item.importoLordo;
        expense = 0;
        if(isForecast) probability = item.probabilita;
      } else { // PrevisioneUscita
        date = new Date(item.dataScadenza);
        income = 0;
        expense = item.importoLordo;
        if(isForecast) probability = item.probabilita;
      }

      if (date.getFullYear() === year) {
        const monthIndex = date.getMonth();
        monthsData[monthIndex].entrate += (income || 0) * probability;
        monthsData[monthIndex].uscite += (expense || 0) * probability;
      }
    };
    
    const today = new Date();
    movements.forEach(m => processData(m, false));
    incomeForecasts.forEach(f => {
      if (new Date(f.dataPrevista) >= today) processData(f, true);
    });
    expenseForecasts.forEach(f => {
      if (new Date(f.dataScadenza) >= today) processData(f, true);
    });
    
    return monthsData;
  }, [data]);

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle>Andamento Entrate/Uscite</CardTitle>
        <CardDescription>Dati per l'anno in corso (storici e previsionali ponderati)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
           <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                 <YAxis
                  tickFormatter={(value) => `€${Number(value) / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <Tooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" formatter={(value: number) => formatCurrency(value)} />}
                />
                <defs>
                    <linearGradient id="fillEntrate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-entrate)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-entrate)" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="fillUscite" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-uscite)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-uscite)" stopOpacity={0.1}/>
                    </linearGradient>
                </defs>
                <Area
                  dataKey="entrate"
                  type="natural"
                  fill="url(#fillEntrate)"
                  stroke="var(--color-entrate)"
                  stackId="a"
                />
                <Area
                  dataKey="uscite"
                  type="natural"
                  fill="url(#fillUscite)"
                  stroke="var(--color-uscite)"
                  stackId="b"
                />
              </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
