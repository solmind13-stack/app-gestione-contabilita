// src/components/previsioni/forecast-comparison.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, parseDate } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, Scadenza } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CashflowChart } from '../dashboard/cashflow-chart';
import { addMonths, endOfMonth, isWithinInterval, startOfMonth } from 'date-fns';

interface ForecastComparisonProps {
  mainYear: number;
  comparisonYear: number;
  company: 'LNC' | 'STG' | 'Tutte';
  movements: Movimento[];
  incomeForecasts: PrevisioneEntrata[];
  expenseForecasts: PrevisioneUscita[];
  deadlines: Scadenza[];
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
  deadlines,
  isLoading,
}: ForecastComparisonProps) {

  const {
    chartData,
    totals,
    categoryTotals,
    comparisonChartData,
    cashflowChartData
  } = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const yearsToProcess = [mainYear, comparisonYear].filter(Boolean) as number[];

    const getYearlyTotals = (year: number) => {
        let totalIncomeConsuntivo = 0;
        let totalExpenseConsuntivo = 0;
        let totalIncomePrevisto = 0;
        let totalExpensePrevisto = 0;
        
        const categoryIncome: { [key: string]: number } = {};
        const categoryExpense: { [key: string]: number } = {};
        
        const monthlyData = Array.from({ length: 12 }, () => ({
            entrateConsuntivo: 0,
            usciteConsuntivo: 0,
            entratePrevisto: 0,
            uscitePrevisto: 0,
        }));

        // Filter data once per year
        const yearMovements = (movements || []).filter(mov => parseDate(mov.data).getFullYear() === year && (company === 'Tutte' || mov.societa === company));
        const yearIncomeForecasts = (incomeForecasts || []).filter(f => parseDate(f.dataPrevista).getFullYear() === year && (company === 'Tutte' || f.societa === company));
        const yearExpenseForecasts = (expenseForecasts || []).filter(f => parseDate(f.dataScadenza).getFullYear() === year && (company === 'Tutte' || f.societa === company));
        const yearDeadlines = (deadlines || []).filter(d => parseDate(d.dataScadenza).getFullYear() === year && (company === 'Tutte' || d.societa === company));

        // Aggregate CONSUNTIVO totals and categories directly from movements
        yearMovements.forEach(mov => {
            const income = mov.entrata || 0;
            const expense = mov.uscita || 0;
            totalIncomeConsuntivo += income;
            totalExpenseConsuntivo += expense;
            if (income > 0) categoryIncome[mov.categoria] = (categoryIncome[mov.categoria] || 0) + income;
            if (expense > 0) categoryExpense[mov.categoria] = (categoryExpense[mov.categoria] || 0) + expense;
            
            const monthIndex = parseDate(mov.data).getMonth();
            monthlyData[monthIndex].entrateConsuntivo += income;
            monthlyData[monthIndex].usciteConsuntivo += expense;
        });

        // Aggregate PREVISTO totals and categories from forecasts and deadlines
        yearIncomeForecasts.forEach(f => {
            if (f.stato !== 'Incassato') {
                const weightedIncome = (f.importoLordo || 0) * f.probabilita;
                totalIncomePrevisto += weightedIncome;
                categoryIncome[f.categoria] = (categoryIncome[f.categoria] || 0) + weightedIncome;
                const monthIndex = parseDate(f.dataPrevista).getMonth();
                monthlyData[monthIndex].entratePrevisto += weightedIncome;
            }
        });

        yearExpenseForecasts.forEach(f => {
            if (f.stato !== 'Pagato') {
                const weightedExpense = (f.importoLordo || 0) * f.probabilita;
                totalExpensePrevisto += weightedExpense;
                categoryExpense[f.categoria] = (categoryExpense[f.categoria] || 0) + weightedExpense;
                const monthIndex = parseDate(f.dataScadenza).getMonth();
                monthlyData[monthIndex].uscitePrevisto += weightedExpense;
            }
        });
        
        yearDeadlines.forEach(d => {
            if (d.stato !== 'Pagato') {
                const remainingAmount = (d.importoPrevisto - d.importoPagato);
                totalExpensePrevisto += remainingAmount;
                categoryExpense[d.categoria] = (categoryExpense[d.categoria] || 0) + remainingAmount;
                const monthIndex = parseDate(d.dataScadenza).getMonth();
                monthlyData[monthIndex].uscitePrevisto += remainingAmount;
            }
        });

        return {
            totalIncomeConsuntivo,
            totalExpenseConsuntivo,
            totalIncomePrevisto,
            totalExpensePrevisto,
            monthlyData,
            categoryIncome,
            categoryExpense,
        };
    };

    const mainYearData = getYearlyTotals(mainYear);
    const comparisonYearData = comparisonYear ? getYearlyTotals(comparisonYear) : null;

    const totals = {
        [`entrateConsuntivo${mainYear}`]: mainYearData.totalIncomeConsuntivo,
        [`usciteConsuntivo${mainYear}`]: mainYearData.totalExpenseConsuntivo,
        [`entratePrevisto${mainYear}`]: mainYearData.totalIncomePrevisto,
        [`uscitePrevisto${mainYear}`]: mainYearData.totalExpensePrevisto,
    };
    if (comparisonYear && comparisonYearData) {
        totals[`entrateConsuntivo${comparisonYear}`] = comparisonYearData.totalIncomeConsuntivo;
        totals[`usciteConsuntivo${comparisonYear}`] = comparisonYearData.totalExpenseConsuntivo;
    }

    const chartData = mainYearData.monthlyData.map((month, i) => ({
      month: new Date(mainYear, i).toLocaleString('it-IT', { month: 'short' }),
      ...month
    }));
    
    const comparisonChartData = mainYearData.monthlyData.map((month, i) => {
      const compMonthData = comparisonYearData ? comparisonYearData.monthlyData[i] : {entrateConsuntivo: 0, usciteConsuntivo: 0};
      return {
        month: new Date(mainYear, i).toLocaleString('it-IT', { month: 'short' }),
        [`entrate${mainYear}`]: month.entrateConsuntivo,
        [`uscite${mainYear}`]: month.usciteConsuntivo,
        [`entrate${comparisonYear}`]: compMonthData.entrateConsuntivo,
        [`uscite${comparisonYear}`]: compMonthData.usciteConsuntivo,
      }
    });

    const allIncomeCategories = new Set([...Object.keys(mainYearData.categoryIncome || {}), ...Object.keys(comparisonYearData?.categoryIncome || {})]);
    const allExpenseCategories = new Set([...Object.keys(mainYearData.categoryExpense || {}), ...Object.keys(comparisonYearData?.categoryExpense || {})]);

    const combinedIncomeTotals = Array.from(allIncomeCategories).map(cat => ({
        category: cat,
        totalMain: mainYearData.categoryIncome?.[cat] || 0,
        totalComparison: comparisonYearData?.categoryIncome?.[cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);

    const combinedExpenseTotals = Array.from(allExpenseCategories).map(cat => ({
        category: cat,
        totalMain: mainYearData.categoryExpense?.[cat] || 0,
        totalComparison: comparisonYearData?.categoryExpense?.[cat] || 0,
    })).sort((a,b) => b.totalMain - a.totalMain);
    
    // --- CASHFLOW CHART ---
    const companyMovements = (movements || []).filter(m => company === 'Tutte' || m.societa === company);
    const companyIncomeForecasts = (incomeForecasts || []).filter(f => company === 'Tutte' || f.societa === company);
    const companyExpenseForecasts = (expenseForecasts || []).filter(f => company === 'Tutte' || f.societa === company);
    const companyDeadlines = (deadlines || []).filter(d => company === 'Tutte' || d.societa === company);
    
    let cashflowBalance = companyMovements.filter(m => parseDate(m.data) < startOfMonth(today)).reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
    const cashflowProjectionData = Array.from({ length: 12 }, (_, i) => {
        const monthDate = addMonths(today, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        let monthInflows = 0;
        let monthOutflows = 0;

        companyMovements.forEach(m => { if (isWithinInterval(parseDate(m.data), { start: monthStart < today ? monthStart : today, end: today })) { monthInflows += m.entrata || 0; monthOutflows += m.uscita || 0; } });
        companyIncomeForecasts.forEach(f => { if (isWithinInterval(parseDate(f.dataPrevista), { start: monthStart < today ? today : monthStart, end: monthEnd })) monthInflows += f.importoLordo * f.probabilita; });
        companyExpenseForecasts.forEach(f => { if (isWithinInterval(parseDate(f.dataScadenza), { start: monthStart < today ? today : monthStart, end: monthEnd })) monthOutflows += f.importoLordo * f.probabilita; });
        companyDeadlines.forEach(d => { if (d.stato !== 'Pagato' && isWithinInterval(parseDate(d.dataScadenza), { start: monthStart < today ? today : monthStart, end: monthEnd })) monthOutflows += (d.importoPrevisto - d.importoPagato); });
        
        cashflowBalance += monthInflows - monthOutflows;
        return { month: monthDate.toLocaleString('it-IT', { month: 'short' }), saldo: cashflowBalance };
    });


    return { 
        chartData, 
        totals,
        categoryTotals: {
            income: combinedIncomeTotals,
            expense: combinedExpenseTotals,
        },
        comparisonChartData,
        cashflowChartData: cashflowProjectionData,
    };

  }, [mainYear, comparisonYear, company, movements, incomeForecasts, expenseForecasts, deadlines]);
  
  const pieIncomeData = useMemo(() => categoryTotals.income.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain })), [categoryTotals.income]);
  const pieExpenseData = useMemo(() => categoryTotals.expense.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain })), [categoryTotals.expense]);

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
                  <Bar dataKey={`entrateConsuntivo`} name={`Entrate Cons.`} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`usciteConsuntivo`} name={`Uscite Cons.`} fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`entratePrevisto`} name={`Entrate Prev.`} fill="hsla(var(--chart-2), 0.5)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`uscitePrevisto`} name={`Uscite Prev.`} fill="hsla(var(--chart-4), 0.5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
        )}
        </CardContent>
      </Card>
      
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChartData}>
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
                  <Bar dataKey={`entrate${mainYear}`} name={`Entrate ${mainYear}`} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`uscite${mainYear}`} name={`Uscite ${mainYear}`} fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`entrate${comparisonYear}`} name={`Entrate ${comparisonYear}`} fill="hsla(var(--chart-1), 0.5)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`uscite${comparisonYear}`} name={`Uscite ${comparisonYear}`} fill="hsla(var(--chart-3), 0.5)" radius={[4, 4, 0, 0]} />
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
         <CashflowChart data={cashflowChartData} />
      </div>
    </div>
  );
}
