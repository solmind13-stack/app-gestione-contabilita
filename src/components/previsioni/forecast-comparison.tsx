// src/components/previsioni/forecast-comparison.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface ForecastComparisonProps {
  mainYear: number;
  comparisonYear: number;
  company: 'LNC' | 'STG' | 'Tutte';
  movements: Movimento[];
  incomeForecasts: PrevisioneEntrata[];
  expenseForecasts: PrevisioneUscita[];
  isLoading: boolean;
}

export function ForecastComparison({
  mainYear,
  comparisonYear,
  company,
  movements,
  incomeForecasts,
  expenseForecasts,
  isLoading,
}: ForecastComparisonProps) {

  const { chartData, totals, categoryTotals } = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    const yearsToProcess = [mainYear, comparisonYear];
    
    const categoryIncomeTotals: { [year: number]: { [key: string]: number } } = {};
    const categoryExpenseTotals: { [year: number]: { [key: string]: number } } = {};
    yearsToProcess.forEach(y => {
        categoryIncomeTotals[y] = {};
        categoryExpenseTotals[y] = {};
    });

    const data = months.map(monthIndex => {
        const monthName = new Date(mainYear, monthIndex).toLocaleString('it-IT', { month: 'long' });
        const monthShort = monthName.charAt(0).toUpperCase() + monthName.slice(1, 3);
        const monthData: any = { month: monthShort };

        yearsToProcess.forEach(year => {
            monthData[`entrate${year}`] = 0;
            monthData[`uscite${year}`] = 0;

            // Data from movements (historical)
            movements.forEach(mov => {
                const movDate = new Date(mov.data);
                if (movDate.getFullYear() === year && movDate.getMonth() === monthIndex) {
                    if (company === 'Tutte' || mov.societa === company) {
                        const income = mov.entrata || 0;
                        const expense = mov.uscita || 0;
                        monthData[`entrate${year}`] += income;
                        monthData[`uscite${year}`] += expense;
                        if(income > 0) categoryIncomeTotals[year][mov.categoria] = (categoryIncomeTotals[year][mov.categoria] || 0) + income;
                        if(expense > 0) categoryExpenseTotals[year][mov.categoria] = (categoryExpenseTotals[year][mov.categoria] || 0) + expense;
                    }
                }
            });

            // Data from forecasts (future for mainYear)
            const today = new Date();
            if (year === mainYear && (year > today.getFullYear() || (year === today.getFullYear() && monthIndex >= today.getMonth()))) {
                incomeForecasts.forEach(forecast => {
                    const forecastDate = new Date(forecast.dataPrevista);
                    if (forecastDate.getFullYear() === year && forecastDate.getMonth() === monthIndex) {
                        if (company === 'Tutte' || forecast.societa === company) {
                            const weightedIncome = (forecast.importoLordo || 0) * forecast.probabilita;
                            monthData[`entrate${year}`] += weightedIncome;
                            if(weightedIncome > 0) categoryIncomeTotals[year][forecast.categoria] = (categoryIncomeTotals[year][forecast.categoria] || 0) + weightedIncome;
                        }
                    }
                });

                expenseForecasts.forEach(forecast => {
                    const forecastDate = new Date(forecast.dataScadenza);
                    if (forecastDate.getFullYear() === year && forecastDate.getMonth() === monthIndex) {
                        if (company === 'Tutte' || forecast.societa === company) {
                            const weightedExpense = (forecast.importoLordo || 0) * forecast.probabilita;
                            monthData[`uscite${year}`] += weightedExpense;
                            if(weightedExpense > 0) categoryExpenseTotals[year][forecast.categoria] = (categoryExpenseTotals[year][forecast.categoria] || 0) + weightedExpense;
                        }
                    }
                });
            }
        });
        return monthData;
    });
    
    const calculatedTotals = yearsToProcess.reduce((acc, year) => {
        acc[`entrate${year}`] = data.reduce((sum, month) => sum + (month[`entrate${year}`] || 0), 0);
        acc[`uscite${year}`] = data.reduce((sum, month) => sum + (month[`uscite${year}`] || 0), 0);
        return acc;
    }, {} as { [key: string]: number });


    const allIncomeCategories = new Set([...Object.keys(categoryIncomeTotals[mainYear]), ...Object.keys(categoryIncomeTotals[comparisonYear])]);
    const allExpenseCategories = new Set([...Object.keys(categoryExpenseTotals[mainYear]), ...Object.keys(categoryExpenseTotals[comparisonYear])]);
    
    const combinedIncomeTotals = Array.from(allIncomeCategories).map(cat => ({
        category: cat,
        totalMain: categoryIncomeTotals[mainYear][cat] || 0,
        totalComparison: categoryIncomeTotals[comparisonYear][cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);

    const combinedExpenseTotals = Array.from(allExpenseCategories).map(cat => ({
        category: cat,
        totalMain: categoryExpenseTotals[mainYear][cat] || 0,
        totalComparison: categoryExpenseTotals[comparisonYear][cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);


    return { 
        chartData: data, 
        totals: calculatedTotals,
        categoryTotals: {
            income: combinedIncomeTotals,
            expense: combinedExpenseTotals,
        }
    };

  }, [mainYear, comparisonYear, company, movements, incomeForecasts, expenseForecasts]);
  

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Entrate {mainYear}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(totals[`entrate${mainYear}`] || 0)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Uscite {mainYear}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(totals[`uscite${mainYear}`] || 0)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Entrate {comparisonYear}</CardTitle></CardHeader>
            <CardContent>
               {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-muted-foreground">{formatCurrency(totals[`entrate${comparisonYear}`] || 0)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">Totale Uscite {comparisonYear}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-muted-foreground">{formatCurrency(totals[`uscite${comparisonYear}`] || 0)}</p>}
            </CardContent>
          </Card>
      </div>

      <div className="h-[250px]">
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
                <Bar dataKey={`entrate${mainYear}`} name={`Entrate ${mainYear}`} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey={`uscite${mainYear}`} name={`Uscite ${mainYear}`} fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
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
                    <TableHead className="text-right">{`Totale ${mainYear}`}</TableHead>
                    <TableHead className="text-right">{`Totale ${comparisonYear}`}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                           <TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                        </TableRow>
                      ))
                  ) : categoryTotals.income.length > 0 ? (
                    categoryTotals.income.map(({category, totalMain, totalComparison}) => (
                      <TableRow key={category}>
                        <TableCell className="font-medium">{category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalMain)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(totalComparison)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                     <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
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
                    <TableHead className="text-right">{`Totale ${mainYear}`}</TableHead>
                    <TableHead className="text-right">{`Totale ${comparisonYear}`}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                           <TableCell><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                        </TableRow>
                      ))
                  ) : categoryTotals.expense.length > 0 ? (
                    categoryTotals.expense.map(({category, totalMain, totalComparison}) => (
                      <TableRow key={category}>
                        <TableCell className="font-medium">{category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalMain)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(totalComparison)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                     <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
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
