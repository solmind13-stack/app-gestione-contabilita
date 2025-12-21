'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';

interface ForecastComparisonProps {
  year: number;
  company: 'LNC' | 'STG' | 'Tutte';
  movements: Movimento[];
  incomeForecasts: PrevisioneEntrata[];
  expenseForecasts: PrevisioneUscita[];
}

const months = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export function ForecastComparison({
  year,
  company,
  movements,
  incomeForecasts,
  expenseForecasts,
}: ForecastComparisonProps) {

  const chartData = useMemo(() => {
    const dataByMonth = months.map((month, index) => ({
      month: month.substring(0, 3),
      entrateAnnoCorrente: 0,
      usciteAnnoCorrente: 0,
      entrateAnnoPrecedente: 0,
      usciteAnnoPrecedente: 0,
    }));

    const processData = (items: (Movimento | PrevisioneEntrata | PrevisioneUscita)[], type: 'entrata' | 'uscita') => {
      items.forEach(item => {
        const itemYear = 'anno' in item ? item.anno : new Date(item.data).getFullYear();
        let date, amount;

        if ('data' in item) { // Movimento
          date = new Date(item.data);
          amount = type === 'entrata' ? item.entrata : item.uscita;
        } else if ('dataPrevista' in item) { // PrevisioneEntrata
          date = new Date(item.dataPrevista);
          amount = type === 'entrata' ? item.importoLordo : 0;
        } else { // PrevisioneUscita
          date = new Date(item.dataScadenza);
          amount = type === 'uscita' ? item.importoLordo : 0;
        }

        if (amount > 0) {
          const monthIndex = date.getMonth();
          if (itemYear === year) {
            if (type === 'entrata') dataByMonth[monthIndex].entrateAnnoCorrente += amount;
            else dataByMonth[monthIndex].usciteAnnoCorrente += amount;
          } else if (itemYear === year - 1) {
            if (type === 'entrata') dataByMonth[monthIndex].entrateAnnoPrecedente += amount;
            else dataByMonth[monthIndex].usciteAnnoPrecedente += amount;
          }
        }
      });
    };

    // Aggregating current year data from forecasts
    processData(incomeForecasts, 'entrata');
    processData(expenseForecasts, 'uscita');
    
    // Aggregating previous year data from movements
    processData(movements.filter(m => m.anno === year - 1), 'entrata');
    processData(movements.filter(m => m.anno === year - 1), 'uscita');


    return dataByMonth;
  }, [year, movements, incomeForecasts, expenseForecasts]);
  
  const totals = useMemo(() => {
    return chartData.reduce((acc, month) => ({
      entrateAnnoCorrente: acc.entrateAnnoCorrente + month.entrateAnnoCorrente,
      usciteAnnoCorrente: acc.usciteAnnoCorrente + month.usciteAnnoCorrente,
      entrateAnnoPrecedente: acc.entrateAnnoPrecedente + month.entrateAnnoPrecedente,
      usciteAnnoPrecedente: acc.usciteAnnoPrecedente + month.usciteAnnoPrecedente,
    }), {
      entrateAnnoCorrente: 0,
      usciteAnnoCorrente: 0,
      entrateAnnoPrecedente: 0,
      usciteAnnoPrecedente: 0,
    });
  }, [chartData]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Confronto Entrate/Uscite Previste</CardTitle>
        <CardDescription>
          Analisi delle previsioni per l&apos;anno {year} a confronto con i dati storici del {year - 1}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="entrateAnnoCorrente" name={`Entrate ${year}`} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="usciteAnnoCorrente" name={`Uscite ${year}`} fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="entrateAnnoPrecedente" name={`Entrate ${year - 1}`} fill="hsl(var(--chart-2))" opacity={0.5} radius={[4, 4, 0, 0]} />
              <Bar dataKey="usciteAnnoPrecedente" name={`Uscite ${year - 1}`} fill="hsl(var(--chart-4))" opacity={0.5} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Entrate {year}</p>
                <p className="text-xl font-bold">{formatCurrency(totals.entrateAnnoCorrente)}</p>
            </div>
             <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Uscite {year}</p>
                <p className="text-xl font-bold">{formatCurrency(totals.usciteAnnoCorrente)}</p>
            </div>
             <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Entrate {year - 1}</p>
                <p className="text-xl font-bold">{formatCurrency(totals.entrateAnnoPrecedente)}</p>
            </div>
             <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Totale Uscite {year - 1}</p>
                <p className="text-xl font-bold">{formatCurrency(totals.usciteAnnoPrecedente)}</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
