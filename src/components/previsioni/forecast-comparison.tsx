'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Loader2 } from 'lucide-react';

interface ForecastComparisonProps {
  year: number;
  company: 'LNC' | 'STG' | 'Tutte';
  movements: Movimento[];
  incomeForecasts: PrevisioneEntrata[];
  expenseForecasts: PrevisioneUscita[];
  isLoading: boolean;
}

export function ForecastComparison({
  year,
  company,
  movements,
  incomeForecasts,
  expenseForecasts,
  isLoading,
}: ForecastComparisonProps) {

  const { chartData, totals } = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    
    const data = months.map(monthIndex => {
        const monthName = new Date(year, monthIndex).toLocaleString('it-IT', { month: 'long' });
        const monthShort = monthName.charAt(0).toUpperCase() + monthName.slice(1, 3);

        const currentYearData = {
            entrate: 0,
            uscite: 0,
        };

        const previousYearData = {
            entrate: 0,
            uscite: 0,
        };
        
        // Filter movements for both years
        movements.forEach(mov => {
            const movDate = new Date(mov.data);
            const movYear = movDate.getFullYear();
            const movMonth = movDate.getMonth();

            if(movYear === year && movMonth === monthIndex) {
                currentYearData.entrate += mov.entrata;
                currentYearData.uscite += mov.uscita;
            } else if (movYear === year - 1 && movMonth === monthIndex) {
                 previousYearData.entrate += mov.entrata;
                 previousYearData.uscite += mov.uscita;
            }
        });

        // Filter forecasts for the current month and year (only for future months)
        const today = new Date();
        if (year > today.getFullYear() || (year === today.getFullYear() && monthIndex >= today.getMonth())) {
            incomeForecasts.forEach(forecast => {
                if (forecast.anno === year && new Date(forecast.dataPrevista).getMonth() === monthIndex) {
                    currentYearData.entrate += forecast.importoLordo * forecast.probabilita;
                }
            });

            expenseForecasts.forEach(forecast => {
                if (forecast.anno === year && new Date(forecast.dataScadenza).getMonth() === monthIndex) {
                    currentYearData.uscite += forecast.importoLordo * forecast.probabilita;
                }
            });
        }


        return {
            month: monthShort,
            entrateAnnoCorrente: currentYearData.entrate,
            usciteAnnoCorrente: currentYearData.uscite,
            entrateAnnoPrecedente: previousYearData.entrate,
            usciteAnnoPrecedente: previousYearData.uscite,
        };
    });
    
    const total = data.reduce((acc, month) => {
        acc.entrateAnnoCorrente += month.entrateAnnoCorrente;
        acc.usciteAnnoCorrente += month.usciteAnnoCorrente;
        acc.entrateAnnoPrecedente += month.entrateAnnoPrecedente;
        acc.usciteAnnoPrecedente += month.usciteAnnoPrecedente;
        return acc;
    }, {
        entrateAnnoCorrente: 0,
        usciteAnnoCorrente: 0,
        entrateAnnoPrecedente: 0,
        usciteAnnoPrecedente: 0,
    });

    return { chartData: data, totals: total };

  }, [year, movements, incomeForecasts, expenseForecasts]);
  

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riepilogo Generale: Confronto Entrate/Uscite</CardTitle>
        <CardDescription>
          Analisi dei dati storici e previsti per l'anno {year} a confronto con il {year - 1}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[350px]">
         {isLoading ? (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
         ) : (
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tickLine={false} axisLine={false} />
                <Tooltip
                    contentStyle={{
                        background: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="entrateAnnoPrecedente" name={`Entrate ${year - 1}`} fill="hsl(var(--chart-2))" opacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey="usciteAnnoPrecedente" name={`Uscite ${year - 1}`} fill="hsl(var(--chart-4))" opacity={0.5} radius={[4, 4, 0, 0]} />
                <Bar dataKey="entrateAnnoCorrente" name={`Entrate ${year}`} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="usciteAnnoCorrente" name={`Uscite ${year}`} fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
            </ResponsiveContainer>
         )}
        </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Entrate {year}</p>
                {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto mt-1" /> : <p className="text-xl font-bold">{formatCurrency(totals.entrateAnnoCorrente)}</p>}
            </div>
             <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Uscite {year}</p>
                {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto mt-1" /> : <p className="text-xl font-bold">{formatCurrency(totals.usciteAnnoCorrente)}</p>}
            </div>
             <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Entrate {year - 1}</p>
                 {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto mt-1" /> : <p className="text-xl font-bold">{formatCurrency(totals.entrateAnnoPrecedente)}</p>}
            </div>
             <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Uscite {year - 1}</p>
                {isLoading ? <Skeleton className="h-7 w-3/4 mx-auto mt-1" /> : <p className="text-xl font-bold">{formatCurrency(totals.usciteAnnoPrecedente)}</p>}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
