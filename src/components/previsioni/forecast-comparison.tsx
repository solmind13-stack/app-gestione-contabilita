// src/components/previsioni/forecast-comparison.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CashflowChart } from '../dashboard/cashflow-chart';

interface ForecastComparisonProps {
  mainYear: number;
  comparisonYear: number;
  company: 'LNC' | 'STG' | 'Tutte';
  movements: Movimento[];
  incomeForecasts: PrevisioneEntrata[];
  expenseForecasts: PrevisioneUscita[];
  isLoading: boolean;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-1">
          <div className="flex flex-col space-y-1">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              {data.name}
            </span>
            <span className="font-bold text-foreground">
              {formatCurrency(data.value)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({(payload[0].percent * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

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
    const yearsToProcess = [mainYear, comparisonYear].filter(Boolean) as number[];
    
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
            monthData[`entrateConsuntivo${year}`] = 0;
            monthData[`usciteConsuntivo${year}`] = 0;
            monthData[`entratePrevisto${year}`] = 0;
            monthData[`uscitePrevisto${year}`] = 0;

            // Data from movements (historical)
            movements.forEach(mov => {
                const movDate = new Date(mov.data);
                if (movDate.getFullYear() === year && movDate.getMonth() === monthIndex) {
                    if (company === 'Tutte' || mov.societa === company) {
                        const income = mov.entrata || 0;
                        const expense = mov.uscita || 0;
                        monthData[`entrateConsuntivo${year}`] += income;
                        monthData[`usciteConsuntivo${year}`] += expense;
                        if(income > 0) categoryIncomeTotals[year][mov.categoria] = (categoryIncomeTotals[year][mov.categoria] || 0) + income;
                        if(expense > 0) categoryExpenseTotals[year][mov.categoria] = (categoryExpenseTotals[year][mov.categoria] || 0) + expense;
                    }
                }
            });

            // Data from forecasts
            incomeForecasts.forEach(forecast => {
                const forecastDate = new Date(forecast.dataPrevista);
                if (forecastDate.getFullYear() === year && forecastDate.getMonth() === monthIndex) {
                    if (company === 'Tutte' || forecast.societa === company) {
                        const weightedIncome = (forecast.importoLordo || 0) * forecast.probabilita;
                        monthData[`entratePrevisto${year}`] += weightedIncome;
                         if(weightedIncome > 0 && !(new Date(forecast.dataPrevista) < new Date() && forecast.stato === 'Incassato')) {
                            // Also add to category totals for forecasts
                             categoryIncomeTotals[year][forecast.categoria] = (categoryIncomeTotals[year][forecast.categoria] || 0) + weightedIncome;
                         }
                    }
                }
            });

            expenseForecasts.forEach(forecast => {
                const forecastDate = new Date(forecast.dataScadenza);
                if (forecastDate.getFullYear() === year && forecastDate.getMonth() === monthIndex) {
                    if (company === 'Tutte' || forecast.societa === company) {
                        const weightedExpense = (forecast.importoLordo || 0) * forecast.probabilita;
                        monthData[`uscitePrevisto${year}`] += weightedExpense;
                        if(weightedExpense > 0 && !(new Date(forecast.dataScadenza) < new Date() && forecast.stato === 'Pagato')){
                           // Also add to category totals for forecasts
                           categoryExpenseTotals[year][forecast.categoria] = (categoryExpenseTotals[year][forecast.categoria] || 0) + weightedExpense;
                        }
                    }
                }
            });
        });
        return monthData;
    });
    
    const calculatedTotals = yearsToProcess.reduce((acc, year) => {
        acc[`entrateConsuntivo${year}`] = data.reduce((sum, month) => sum + (month[`entrateConsuntivo${year}`] || 0), 0);
        acc[`usciteConsuntivo${year}`] = data.reduce((sum, month) => sum + (month[`usciteConsuntivo${year}`] || 0), 0);
        acc[`entratePrevisto${year}`] = data.reduce((sum, month) => sum + (month[`entratePrevisto${year}`] || 0), 0);
        acc[`uscitePrevisto${year}`] = data.reduce((sum, month) => sum + (month[`uscitePrevisto${year}`] || 0), 0);
        return acc;
    }, {} as { [key: string]: number });


    const allIncomeCategories = new Set([...Object.keys(categoryIncomeTotals[mainYear] || {}), ...Object.keys(categoryIncomeTotals[comparisonYear] || {})]);
    const allExpenseCategories = new Set([...Object.keys(categoryExpenseTotals[mainYear] || {}), ...Object.keys(categoryExpenseTotals[comparisonYear] || {})]);
    
    const combinedIncomeTotals = Array.from(allIncomeCategories).map(cat => ({
        category: cat,
        totalMain: categoryIncomeTotals[mainYear]?.[cat] || 0,
        totalComparison: categoryIncomeTotals[comparisonYear]?.[cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);

    const combinedExpenseTotals = Array.from(allExpenseCategories).map(cat => ({
        category: cat,
        totalMain: categoryExpenseTotals[mainYear]?.[cat] || 0,
        totalComparison: categoryExpenseTotals[comparisonYear]?.[cat] || 0,
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
  
  const pieIncomeData = useMemo(() => categoryTotals.income.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain })), [categoryTotals.income]);
  const pieExpenseData = useMemo(() => categoryTotals.expense.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain })), [categoryTotals.expense]);

  const allData = useMemo(() => ({
    movements,
    incomeForecasts,
    expenseForecasts,
  }), [movements, incomeForecasts, expenseForecasts]);

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">{`Totale Entrate Cons. ${mainYear}`}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(totals[`entrateConsuntivo${mainYear}`] || 0)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">{`Totale Uscite Cons. ${mainYear}`}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-2xl font-bold">{formatCurrency(totals[`usciteConsuntivo${mainYear}`] || 0)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">{`Totale Entrate Prev. ${mainYear}`}</CardTitle></CardHeader>
            <CardContent>
               {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-blue-600">{formatCurrency(totals[`entratePrevisto${mainYear}`] || 0)}</p>}
            </CardContent>
          </Card>
           <Card>
            <CardHeader className='pb-2'><CardTitle className="text-sm text-muted-foreground font-medium">{`Totale Uscite Prev. ${mainYear}`}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto" /> : <p className="text-xl font-bold text-orange-600">{formatCurrency(totals[`uscitePrevisto${mainYear}`] || 0)}</p>}
            </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Andamento Mensile</CardTitle>
          <CardDescription>{`Confronto entrate e uscite (consuntivo e previsto) per l'anno ${mainYear}`}</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px]">
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
                  <Bar dataKey={`entrateConsuntivo${mainYear}`} name={`Entrate Cons. ${mainYear}`} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`usciteConsuntivo${mainYear}`} name={`Uscite Cons. ${mainYear}`} fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`entratePrevisto${mainYear}`} name={`Entrate Prev. ${mainYear}`} fill="hsla(var(--chart-2), 0.5)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`uscitePrevisto${mainYear}`} name={`Uscite Prev. ${mainYear}`} fill="hsla(var(--chart-4), 0.5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
        )}
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Composizione Entrate {mainYear} (Consuntivo + Previsto)</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                    </div>
                ) : pieIncomeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={pieIncomeData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                outerRadius={60} 
                                labelLine={false}
                                label={renderCustomizedLabel}
                            >
                                {pieIncomeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconSize={8} wrapperStyle={{fontSize: "11px", paddingTop: "10px"}}/>
                        </PieChart>
                    </ResponsiveContainer>
                ): (
                    <div className="flex items-center justify-center h-full text-muted-foreground">Nessun dato per il grafico.</div>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Composizione Uscite {mainYear} (Consuntivo + Previsto)</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                    </div>
                ) : pieExpenseData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={pieExpenseData} 
                                dataKey="value" 
                                nameKey="name" cx="50%" 
                                cy="50%" 
                                outerRadius={60}
                                labelLine={false}
                                label={renderCustomizedLabel}
                            >
                                {pieExpenseData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconSize={8} wrapperStyle={{fontSize: "11px", paddingTop: "10px"}}/>
                        </PieChart>
                    </ResponsiveContainer>
                ): (
                     <div className="flex items-center justify-center h-full text-muted-foreground">Nessun dato per il grafico.</div>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Riepilogo Categorie Entrate</CardTitle>
             <CardDescription>Confronto tra {mainYear} e {comparisonYear}</CardDescription>
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
                        <TableCell className="font-medium text-sm">{category}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totalMain)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(totalComparison)}</TableCell>
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
            <CardTitle className="text-lg">Riepilogo Categorie Uscite</CardTitle>
            <CardDescription>Confronto tra {mainYear} e {comparisonYear}</CardDescription>
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
                        <TableCell className="font-medium text-sm">{category}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(totalMain)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(totalComparison)}</TableCell>
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

       <div className="grid grid-cols-1 gap-6">
         <CashflowChart data={allData} />
      </div>
    </div>
  );
}
