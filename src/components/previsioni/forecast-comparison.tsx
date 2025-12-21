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

export function ForecastComparison({
  year,
  company,
  movements,
  incomeForecasts,
  expenseForecasts,
}: ForecastComparisonProps) {

  const chartData = useMemo(() => {
    // Placeholder data
    const months = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    return months.map(m => ({ month: m.substring(0,3), entrateAnnoCorrente: 0, usciteAnnoCorrente: 0, entrateAnnoPrecedente: 0, usciteAnnoPrecedente: 0 }));
  }, [year, movements, incomeForecasts, expenseForecasts]);
  
  const totals = {
      entrateAnnoCorrente: 0,
      usciteAnnoCorrente: 0,
      entrateAnnoPrecedente: 0,
      usciteAnnoPrecedente: 0,
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Confronto Entrate/Uscite Previste</CardTitle>
        <CardDescription>
          Analisi delle previsioni per l'anno {year} a confronto con i dati storici del {year - 1}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[350px]">
         <p className='text-center text-muted-foreground'>Dati non disponibili. Connettere al database per visualizzare il grafico.</p>
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
