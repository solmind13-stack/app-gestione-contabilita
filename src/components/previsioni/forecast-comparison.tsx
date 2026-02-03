// src/components/previsioni/forecast-comparison.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Info } from 'lucide-react';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

interface ForecastComparisonProps {
  mainYear: number;
  comparisonYear: number | null;
  isLoading: boolean;
  monthlyComparisonData: any[];
  categoryComparisonData: { income: any[]; expense: any[] };
  pieIncomeData: any[];
  pieExpenseData: any[];
  isAllYearsSelected: boolean;
}

const chartConfig = {
  entrateConsuntivo: {
    label: "Entrate Cons.",
    color: "hsl(var(--chart-2))",
  },
  usciteConsuntivo: {
    label: "Uscite Cons.",
    color: "hsl(var(--chart-4))",
  },
  entratePrevisto: {
    label: "Entrate Prev.",
    color: "hsl(var(--chart-5))", // Blue
  },
  uscitePrevisto: {
    label: "Uscite Prev.",
    color: "hsl(var(--chart-3))", // Orange
  },
};

export function ForecastComparison({
  mainYear,
  comparisonYear,
  isLoading,
  monthlyComparisonData,
  categoryComparisonData,
  pieIncomeData,
  pieExpenseData,
  isAllYearsSelected,
}: ForecastComparisonProps) {

  const comparisonChartConfig = useMemo(() => {
    if (!comparisonYear) return {};
    return {
      [`entrate${mainYear}`]: { label: `Entrate ${mainYear}`, color: "hsl(var(--chart-1))" },
      [`uscite${mainYear}`]: { label: `Uscite ${mainYear}`, color: "hsl(var(--chart-3))" },
      [`entrate${comparisonYear}`]: { label: `Entrate ${comparisonYear}`, color: "hsla(var(--chart-1), 0.5)" },
      [`uscite${comparisonYear}`]: { label: `Uscite ${comparisonYear}`, color: "hsla(var(--chart-3), 0.5)" },
    }
  }, [mainYear, comparisonYear]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Andamento Mensile</CardTitle>
          <CardDescription>
            {isAllYearsSelected 
                ? `Andamento per l'anno in corso (${mainYear}) come riferimento.`
                : `Confronto entrate e uscite (consuntivo e previsto) per l'anno ${mainYear}`}
            </CardDescription>
        </CardHeader>
        <CardContent className="h-[250px]">
        {isLoading ? (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip
                          content={<ChartTooltipContent formatter={(value: number) => formatCurrency(value)} />}
                      />
                      <Legend wrapperStyle={{fontSize: "12px"}} />
                      <Bar dataKey={`entrateConsuntivo`} name={`Entrate Cons.`} fill="var(--color-entrateConsuntivo)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={`usciteConsuntivo`} name={`Uscite Cons.`} fill="var(--color-usciteConsuntivo)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={`entratePrevisto`} name={`Entrate Prev.`} fill="var(--color-entratePrevisto)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={`uscitePrevisto`} name={`Uscite Prev.`} fill="var(--color-uscitePrevisto)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
        )}
        </CardContent>
      </Card>
      
      {comparisonYear && !isAllYearsSelected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Confronto Consuntivo Anni</CardTitle>
              <CardDescription>{`Confronto dei movimenti reali tra ${mainYear} e ${comparisonYear}`}</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                </div>
            ) : (
                <ChartContainer config={comparisonChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tickLine={false} axisLine={false} fontSize={12} />
                        <Tooltip
                            content={<ChartTooltipContent formatter={(value: number) => formatCurrency(value)} />}
                        />
                        <Legend wrapperStyle={{fontSize: "12px"}} />
                        <Bar dataKey={`entrate${mainYear}`} fill={`var(--color-entrate${mainYear})`} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={`uscite${mainYear}`} fill={`var(--color-uscite${mainYear})`} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={`entrate${comparisonYear}`} fill={`var(--color-entrate${comparisonYear})`} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={`uscite${comparisonYear}`} fill={`var(--color-uscite${comparisonYear})`} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
            )}
            </CardContent>
          </Card>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Composizione Entrate {isAllYearsSelected ? ' (Tutti gli anni)' : mainYear}</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
                ) : pieIncomeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={pieIncomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} labelLine={false} label={renderCustomizedLabel}>
                                {pieIncomeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                            <Legend iconSize={8} wrapperStyle={{fontSize: "11px", paddingTop: "10px"}}/>
                        </PieChart>
                    </ResponsiveContainer>
                ): (
                    <div className="flex items-center justify-center h-full text-muted-foreground"><Info className="h-4 w-4 mr-2"/>Nessun dato per il grafico.</div>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Composizione Uscite {isAllYearsSelected ? ' (Tutti gli anni)' : mainYear}</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
                ) : pieExpenseData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={pieExpenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} labelLine={false} label={renderCustomizedLabel}>
                                {pieExpenseData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                            <Legend iconSize={8} wrapperStyle={{fontSize: "11px", paddingTop: "10px"}}/>
                        </PieChart>
                    </ResponsiveContainer>
                ): (
                     <div className="flex items-center justify-center h-full text-muted-foreground"><Info className="h-4 w-4 mr-2"/>Nessun dato per il grafico.</div>
                )}
            </CardContent>
        </Card>
      </div>

      {comparisonYear && (
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
            <CardHeader>
                <CardTitle className="text-lg">Riepilogo Categorie Entrate</CardTitle>
                <CardDescription>Confronto tra {mainYear} e {comparisonYear}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">{`Totale ${mainYear}`}</TableHead><TableHead className="text-right">{`Totale ${comparisonYear}`}</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {isLoading ? ([...Array(3)].map((_, i) => (<TableRow key={i}><TableCell><Skeleton className="h-5 w-24"/></TableCell><TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell><TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell></TableRow>))) 
                    : categoryComparisonData.income.length > 0 ? (categoryComparisonData.income.map(({category, totalMain, totalComparison}) => (<TableRow key={category}><TableCell className="font-medium text-sm">{category}</TableCell><TableCell className="text-right text-sm">{formatCurrency(totalMain)}</TableCell><TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(totalComparison)}</TableCell></TableRow>))) 
                    : (<TableRow><TableCell colSpan={3} className="h-24 text-center">Nessuna entrata per il periodo selezionato.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
            </Card>
            <Card>
            <CardHeader>
                <CardTitle className="text-lg">Riepilogo Categorie Uscite</CardTitle>
                <CardDescription>Confronto tra {mainYear} e {comparisonYear}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">{`Totale ${mainYear}`}</TableHead><TableHead className="text-right">{`Totale ${comparisonYear}`}</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {isLoading ? ([...Array(3)].map((_, i) => (<TableRow key={i}><TableCell><Skeleton className="h-5 w-24"/></TableCell><TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell><TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell></TableRow>))) 
                    : categoryComparisonData.expense.length > 0 ? (categoryComparisonData.expense.map(({category, totalMain, totalComparison}) => (<TableRow key={category}><TableCell className="font-medium text-sm">{category}</TableCell><TableCell className="text-right text-sm">{formatCurrency(totalMain)}</TableCell><TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(totalComparison)}</TableCell></TableRow>))) 
                    : (<TableRow><TableCell colSpan={3} className="h-24 text-center">Nessuna uscita per il periodo selezionato.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
