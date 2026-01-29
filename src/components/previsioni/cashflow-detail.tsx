// src/components/previsioni/cashflow-detail.tsx
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { formatCurrency, parseDate } from '@/lib/utils';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, Scadenza } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface CashflowDetailProps {
    year: number;
    company: 'LNC' | 'STG' | 'Tutte';
    allData: {
        movements: Movimento[];
        incomeForecasts: PrevisioneEntrata[];
        expenseForecasts: PrevisioneUscita[];
        deadlines: Scadenza[];
    };
    isLoading: boolean;
}

export function CashflowDetail({ year, company, allData, isLoading }: CashflowDetailProps) {
    const { monthlyData, startingBalance } = useMemo(() => {
        const { movements, incomeForecasts, expenseForecasts, deadlines } = allData;

        // Calculate Starting Balance from all movements before the selected year
        let initialBalance = movements
            .filter(m => {
                const movYear = parseDate(m.data).getFullYear();
                return movYear < year && (company === 'Tutte' || m.societa === company)
            })
            .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
        
        const data = Array.from({ length: 12 }, (_, i) => {
            const monthName = new Date(year, i).toLocaleString('it-IT', { month: 'long' });
            let inflows = 0;
            let outflows = 0;

            const today = new Date();
            const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && i < today.getMonth());

            if (isPastMonth) {
                // Use historical data from movements
                 movements.forEach(mov => {
                    const movDate = parseDate(mov.data);
                    if (movDate.getFullYear() === year && movDate.getMonth() === i && (company === 'Tutte' || mov.societa === company)) {
                        inflows += mov.entrata || 0;
                        outflows += mov.uscita || 0;
                    }
                });
            } else {
                 // Use forecast data for current and future months
                incomeForecasts.forEach(f => {
                    const forecastDate = parseDate(f.dataPrevista);
                    if (forecastDate.getFullYear() === year && forecastDate.getMonth() === i && (company === 'Tutte' || f.societa === company)) {
                        inflows += f.importoLordo * f.probabilita;
                    }
                });
                expenseForecasts.forEach(f => {
                    const forecastDate = parseDate(f.dataScadenza);
                    if (forecastDate.getFullYear() === year && forecastDate.getMonth() === i && (company === 'Tutte' || f.societa === company)) {
                        outflows += f.importoLordo * f.probabilita;
                    }
                });
                deadlines.forEach(scad => {
                    const deadlineDate = parseDate(scad.dataScadenza);
                    if (deadlineDate.getFullYear() === year && deadlineDate.getMonth() === i && scad.stato !== 'Pagato') {
                        if (company === 'Tutte' || scad.societa === company) {
                            outflows += (scad.importoPrevisto - scad.importoPagato);
                        }
                    }
                })
            }

            const closingBalance = initialBalance + inflows - outflows;
            const monthResult = {
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                starting: initialBalance,
                inflows,
                outflows,
                closing: closingBalance,
            };
            initialBalance = closingBalance;
            return monthResult;
        });

        return { monthlyData: data, startingBalance: initialBalance };

    }, [year, company, allData]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Dettaglio Flusso di Cassa per il {year}</CardTitle>
                <CardDescription>
                    Visione mensile del flusso di cassa, combinando dati storici e previsionali (ponderati per probabilità).
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mese</TableHead>
                                <TableHead className="text-right">Saldo Iniziale</TableHead>
                                <TableHead className="text-right text-green-600">Entrate Previste</TableHead>
                                <TableHead className="text-right text-red-600">Uscite Previste</TableHead>
                                <TableHead className="text-right font-bold">Saldo Finale</TableHead>
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
                )}
            </CardContent>
        </Card>
    );
}
