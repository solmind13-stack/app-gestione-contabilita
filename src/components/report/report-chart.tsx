// src/components/report/report-chart.tsx
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { overviewChartData } from "@/lib/data"

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

export function ReportChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={overviewChartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <YAxis
            tickFormatter={(value) => `€${Number(value) / 1000}k`}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          contentStyle={{ 
            background: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
          }}
        />
        <Legend />
        <Bar dataKey="entrate" fill={chartConfig.entrate.color} name="Entrate" radius={[4, 4, 0, 0]} />
        <Bar dataKey="uscite" fill={chartConfig.uscite.color} name="Uscite" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
