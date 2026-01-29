// src/components/dashboard/monthly-summary-table.tsx
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { formatCurrency, parseDate } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, Scadenza } from '@/lib/types';
import { cn } from '@/lib/utils';
import { startOfYear, endOfYear, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface MonthlySummaryTableProps {
    allData: {
        movements: Movimento[];
        incomeForecasts: PrevisioneEntrata[];
        expenseForecasts: PrevisioneUscita[];
        deadlines: Scadenza[];
    };
    isLoading: boolean;
}

export function MonthlySummaryTable({ allData, isLoading }: MonthlySummaryTableProps) {
    const { monthlyData } = useMemo(() => {
        const { movements, incomeForecasts, expenseForecasts, deadlines } = allData;
        const currentYear = new Date().getFullYear();
        
        let openingBalance = movements
            .filter(m => parseDate(m.data).getFullYear() < currentYear)
            .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);

        const data = Array.from({ length: 12 }, (_, i) => {
            const monthName = new Date(currentYear, i).toLocaleString('it-IT', { month: 'long' });
            const monthStart = startOfMonth(new Date(currentYear, i));
            const monthEnd = endOfMonth(new Date(currentYear, i));

            let monthInflows = 0;
            let monthOutflows = 0;

            // Historical data from movements for past months
            if (new Date() > monthEnd) {
                 movements.forEach(mov => {
                    const movDate = parseDate(mov.data);
                    if (isWithinInterval(movDate, {start: monthStart, end: monthEnd})) {
                        monthInflows += mov.entrata || 0;
                        monthOutflows += mov.uscita || 0;
                    }
                });
            } else {
                 // Forecasted data for current and future months
                 incomeForecasts.forEach(f => {
                    const forecastDate = parseDate(f.dataPrevista);
                    if (isWithinInterval(forecastDate, {start: monthStart, end: monthEnd})) {
                        monthInflows += (f.importoLordo || 0) * f.probabilita;
                    }
                 });
                 expenseForecasts.forEach(f => {
                    const forecastDate = parseDate(f.dataScadenza);
                    if (isWithinInterval(forecastDate, {start: monthStart, end: monthEnd})) {
                        monthOutflows += (f.importoLordo || 0) * f.probabilita;
                    }
                 });
                 deadlines.forEach(d => {
                     const deadlineDate = parseDate(d.dataScadenza);
                     if (isWithinInterval(deadlineDate, {start: monthStart, end: monthEnd}) && d.stato !== 'Pagato') {
                         monthOutflows += (d.importoPrevisto - d.importoPagato);
                     }
                 });
            }

            const monthResult = {
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                starting: openingBalance,
                inflows: monthInflows,
                outflows: monthOutflows,
                closing: openingBalance + monthInflows - outflows,
            };

            openingBalance = monthResult.closing;
            return monthResult;
        });

        return { monthlyData: data };

    }, [allData]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Riepilogo Mensile del Flusso di Cassa</CardTitle>
                <CardDescription>
                    Visione mensile del flusso di cassa, combinando dati storici e previsionali per l'anno in corso.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mese</TableHead>
                                    <TableHead className="text-right">Saldo Iniziale</TableHead>
                                    <TableHead className="text-right text-green-600">Entrate Previste</TableHead>
                                    <TableHead className="text-right text-red-600">Uscite Previste</TableHead>
                                    <TableHead className="text-right font-bold">Saldo Finale Previsto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyData.map((data, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{data.month}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(data.starting)}</TableCell>
                                        <TableCell className="text-right text-green-600">{formatCurrency(data.inflows)}</TableCell>
                                        <TableCell className="text-right text-red-600">{formatCurrency(data.outflows)}</TableCell>
                                        <TableCell className={cn("text-right font-bold", data.closing < 0 ? 'text-destructive' : '')}>
                                            {formatCurrency(data.closing)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
