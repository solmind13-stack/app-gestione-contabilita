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
import { formatCurrency, parseDate } from "@/lib/utils";

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
    const { movements, incomeForecasts, expenseForecasts, deadlines } = data;
    const year = new Date().getFullYear();
    const monthsData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleString('it-IT', { month: 'short' }),
      entrate: 0,
      uscite: 0,
    }));

    const today = new Date();
    
    // Process historical data from movements
    movements.forEach(m => {
        const movDate = parseDate(m.data);
        if (movDate < today && movDate.getFullYear() === year) {
            const monthIndex = movDate.getMonth();
            monthsData[monthIndex].entrate += m.entrata || 0;
            monthsData[monthIndex].uscite += m.uscita || 0;
        }
    });
    
    // Process future data from forecasts and deadlines
    incomeForecasts.forEach(f => {
        const forecastDate = parseDate(f.dataPrevista);
        if (forecastDate >= today && forecastDate.getFullYear() === year) {
            const monthIndex = forecastDate.getMonth();
            monthsData[monthIndex].entrate += (f.importoLordo || 0) * f.probabilita;
        }
    });

    expenseForecasts.forEach(f => {
        const forecastDate = parseDate(f.dataScadenza);
        if (forecastDate >= today && forecastDate.getFullYear() === year) {
            const monthIndex = forecastDate.getMonth();
            monthsData[monthIndex].uscite += (f.importoLordo || 0) * f.probabilita;
        }
    });

    deadlines.forEach(d => {
        const deadlineDate = parseDate(d.dataScadenza);
        if (deadlineDate >= today && deadlineDate.getFullYear() === year && d.stato !== 'Pagato') {
            const monthIndex = deadlineDate.getMonth();
            monthsData[monthIndex].uscite += (d.importoPrevisto - d.importoPagato);
        }
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
