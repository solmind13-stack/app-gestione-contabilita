"use client"

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
    month: string;
    entrate: number;
    uscite: number;
  }[];
}

export function OverviewChart({ data: chartData }: OverviewChartProps) {

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle>Andamento Entrate/Uscite</CardTitle>
        <CardDescription>Dati per l'anno in corso (reali per il passato, previsionali per il futuro)</CardDescription>
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
