// src/components/previsioni/forecast-comparison.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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

interface ForecastComparisonProps {
  mainYear: number;
  comparisonYear: number | null;
  isLoading: boolean;
  totals: { [key: string]: number };
  monthlyComparisonData: any[];
  categoryComparisonData: { income: any[]; expense: any[] };
  allData: {
    movements: any[];
    incomeForecasts: any[];
    expenseForecasts: any[];
    deadlines: any[];
  };
}

export function ForecastComparison({
  mainYear,
  comparisonYear,
  isLoading,
  totals,
  monthlyComparisonData,
  categoryComparisonData,
}: ForecastComparisonProps) {
  
  const pieIncomeData = useMemo(() => categoryComparisonData.income.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain })), [categoryComparisonData.income]);
  const pieExpenseData = useMemo(() => categoryComparisonData.expense.filter(d => d.totalMain > 0).map(d => ({ name: d.category, value: d.totalMain })), [categoryComparisonData.expense]);

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
              <BarChart data={monthlyComparisonData}>
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
      
      {comparisonYear && (
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
                  <BarChart data={monthlyComparisonData}>
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
      )}
      
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

      {comparisonYear && (
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
                    ) : categoryComparisonData.income.length > 0 ? (
                        categoryComparisonData.income.map(({category, totalMain, totalComparison}) => (
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
                    ) : categoryComparisonData.expense.length > 0 ? (
                        categoryComparisonData.expense.map(({category, totalMain, totalComparison}) => (
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
      )}
    </div>
  );
}
