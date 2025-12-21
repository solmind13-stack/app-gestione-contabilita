// src/components/previsioni/forecast-comparison.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { CATEGORIE, CATEGORIE_ENTRATE, CATEGORIE_USCITE } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface ForecastComparisonProps {
  year: number;
  company: 'LNC' | 'STG' | 'Tutte';
  movements: Movimento[];
  incomeForecasts: PrevisioneEntrata[];
  expenseForecasts: PrevisioneUscita[];
  isLoading: boolean;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'
];

const allCategories = [...Object.keys(CATEGORIE_ENTRATE), ...Object.keys(CATEGORIE_USCITE)];
const uniqueCategories = [...new Set(allCategories)];

export function ForecastComparison({
  year,
  company,
  movements,
  incomeForecasts,
  expenseForecasts,
  isLoading,
}: ForecastComparisonProps) {

  const { chartData, totals, categoryTotals } = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i);

    const categoryIncomeTotals: { [key: string]: number } = {};
    const categoryExpenseTotals: { [key: string]: number } = {};

    const data = months.map(monthIndex => {
        const monthName = new Date(year, monthIndex).toLocaleString('it-IT', { month: 'long' });
        const monthShort = monthName.charAt(0).toUpperCase() + monthName.slice(1, 3);

        const monthData: any = {
            month: monthShort,
            entrateAnnoCorrente: 0,
            usciteAnnoCorrente: 0,
            entrateAnnoPrecedente: 0,
            usciteAnnoPrecedente: 0,
        };

        // Initialize categories for the month
        uniqueCategories.forEach(cat => {
          monthData[`entrate-${cat}`] = 0;
          monthData[`uscite-${cat}`] = 0;
        });

        // Previous year from movements
        movements.forEach(mov => {
            const movDate = new Date(mov.data);
            if (movDate.getFullYear() === year - 1 && movDate.getMonth() === monthIndex) {
                if (!company || company === 'Tutte' || mov.societa === company) {
                    monthData.entrateAnnoPrecedente += mov.entrata || 0;
                    monthData.usciteAnnoPrecedente += mov.uscita || 0;
                }
            }
        });
        
        // Current year from movements (historical)
        movements.forEach(mov => {
            const movDate = new Date(mov.data);
             if (movDate.getFullYear() === year && movDate.getMonth() === monthIndex) {
                 if (!company || company === 'Tutte' || mov.societa === company) {
                    const income = mov.entrata || 0;
                    const expense = mov.uscita || 0;
                    monthData.entrateAnnoCorrente += income;
                    monthData.usciteAnnoCorrente += expense;
                    monthData[`entrate-${mov.categoria}`] += income;
                    monthData[`uscite-${mov.categoria}`] += expense;

                    if (income > 0) categoryIncomeTotals[mov.categoria] = (categoryIncomeTotals[mov.categoria] || 0) + income;
                    if (expense > 0) categoryExpenseTotals[mov.categoria] = (categoryExpenseTotals[mov.categoria] || 0) + expense;
                }
            }
        });

        // Current year from forecasts (future)
        const today = new Date();
        if (year > today.getFullYear() || (year === today.getFullYear() && monthIndex >= today.getMonth())) {
            incomeForecasts.forEach(forecast => {
                const forecastDate = new Date(forecast.dataPrevista);
                if (forecastDate.getFullYear() === year && forecastDate.getMonth() === monthIndex) {
                    if (!company || company === 'Tutte' || forecast.societa === company) {
                        const weightedIncome = (forecast.importoLordo || 0) * forecast.probabilita;
                        monthData.entrateAnnoCorrente += weightedIncome;
                        monthData[`entrate-${forecast.categoria}`] += weightedIncome;
                        categoryIncomeTotals[forecast.categoria] = (categoryIncomeTotals[forecast.categoria] || 0) + weightedIncome;
                    }
                }
            });

            expenseForecasts.forEach(forecast => {
                const forecastDate = new Date(forecast.dataScadenza);
                if (forecastDate.getFullYear() === year && forecastDate.getMonth() === monthIndex) {
                    if (!company || company === 'Tutte' || forecast.societa === company) {
                        const weightedExpense = (forecast.importoLordo || 0) * forecast.probabilita;
                        monthData.usciteAnnoCorrente += weightedExpense;
                        monthData[`uscite-${forecast.categoria}`] += weightedExpense;
                        categoryExpenseTotals[forecast.categoria] = (categoryExpenseTotals[forecast.categoria] || 0) + weightedExpense;
                    }
                }
            });
        }

        return monthData;
    });
    
    const total = data.reduce((acc, month) => {
        acc.entrateAnnoCorrente += month.entrateAnnoCorrente || 0;
        acc.usciteAnnoCorrente += month.usciteAnnoCorrente || 0;
        acc.entrateAnnoPrecedente += month.entrateAnnoPrecedente || 0;
        acc.usciteAnnoPrecedente += month.usciteAnnoPrecedente || 0;
        return acc;
    }, {
        entrateAnnoCorrente: 0,
        usciteAnnoCorrente: 0,
        entrateAnnoPrecedente: 0,
        usciteAnnoPrecedente: 0,
    });

    const sortedCategoryIncome = Object.entries(categoryIncomeTotals).sort(([, a], [, b]) => b - a);
    const sortedCategoryExpense = Object.entries(categoryExpenseTotals).sort(([, a], [, b]) => b - a);

    return { 
        chartData: data, 
        totals: total,
        categoryTotals: {
            income: sortedCategoryIncome,
            expense: sortedCategoryExpense,
        }
    };

  }, [year, company, movements, incomeForecasts, expenseForecasts]);
  

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Entrate {year}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(totals.entrateAnnoCorrente)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Uscite {year}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(totals.usciteAnnoCorrente)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Entrate {year - 1}</CardTitle></CardHeader>
            <CardContent>
               {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-muted-foreground">{formatCurrency(totals.entrateAnnoPrecedente)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Uscite {year - 1}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-muted-foreground">{formatCurrency(totals.usciteAnnoPrecedente)}</p>}
            </CardContent>
          </Card>
      </div>

      <div className="h-[300px]">
       {isLoading ? (
          <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
          </div>
       ) : (
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                  contentStyle={{
                      background: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{fontSize: "12px"}} />
              {uniqueCategories.map((cat, index) => (
                <Bar key={cat} dataKey={`entrate-${cat}`} stackId="entrate" name={cat} fill={COLORS[index % COLORS.length]} />
              ))}
               {uniqueCategories.map((cat, index) => (
                <Bar key={`uscita-${cat}`} dataKey={`uscite-${cat}`} stackId="uscite" name={cat} fill={COLORS[index % COLORS.length]} hide />
              ))}
          </BarChart>
          </ResponsiveContainer>
       )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Riepilogo Categorie Entrate</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                        </TableRow>
                      ))
                  ) : categoryTotals.income.length > 0 ? (
                    categoryTotals.income.map(([category, total]) => (
                      <TableRow key={category}>
                        <TableCell className="font-medium">{category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                     <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center">
                          Nessuna entrata per il periodo selezionato.
                        </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Riepilogo Categorie Uscite</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                        </TableRow>
                      ))
                  ) : categoryTotals.expense.length > 0 ? (
                    categoryTotals.expense.map(([category, total]) => (
                      <TableRow key={category}>
                        <TableCell className="font-medium">{category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                     <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center">
                           Nessuna uscita per il periodo selezionato.
                        </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
