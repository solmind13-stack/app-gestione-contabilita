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
    const { monthlyData } = useMemo(() => {
        const { movements, incomeForecasts, expenseForecasts, deadlines } = allData;
        
        const today = new Date();
        const currentYear = today.getFullYear();

        const companyMovements = (movements || []).filter(m => company === 'Tutte' || m.societa === company);
        const companyIncomeForecasts = (incomeForecasts || []).filter(f => company === 'Tutte' || f.societa === company);
        const companyExpenseForecasts = (expenseForecasts || []).filter(f => company === 'Tutte' || f.societa === company);
        const companyDeadlines = (deadlines || []).filter(d => company === 'Tutte' || d.societa === company);

        // Calculate Starting Balance from all movements before the selected year
        let openingBalance = companyMovements
            .filter(m => parseDate(m.data).getFullYear() < year)
            .reduce((acc, mov) => acc + (mov.entrata || 0) - (mov.uscita || 0), 0);
        
        const data = Array.from({ length: 12 }, (_, i) => {
            const monthName = new Date(year, i).toLocaleString('it-IT', { month: 'long' });
            let monthInflows = 0;
            let monthOutflows = 0;
            
            const monthStart = startOfMonth(new Date(year, i));
            const monthEnd = endOfMonth(monthStart);
            const isPastMonth = year < currentYear || (year === currentYear && i < today.getMonth());

            if (isPastMonth) {
                // Use historical data from movements
                 companyMovements.forEach(mov => {
                    const movDate = parseDate(mov.data);
                    if (isWithinInterval(movDate, {start: monthStart, end: monthEnd})) {
                        monthInflows += mov.entrata || 0;
                        monthOutflows += mov.uscita || 0;
                    }
                });
            } else {
                 // Use forecast data for current and future months
                companyIncomeForecasts.forEach(f => {
                    const forecastDate = parseDate(f.dataPrevista);
                    if (isWithinInterval(forecastDate, {start: monthStart, end: monthEnd}) && f.stato !== 'Incassato') {
                        monthInflows += f.importoLordo * f.probabilita;
                    }
                });
                companyExpenseForecasts.forEach(f => {
                    const forecastDate = parseDate(f.dataScadenza);
                    if (isWithinInterval(forecastDate, {start: monthStart, end: monthEnd}) && f.stato !== 'Pagato') {
                        monthOutflows += f.importoLordo * f.probabilita;
                    }
                });
                companyDeadlines.forEach(scad => {
                    const deadlineDate = parseDate(scad.dataScadenza);
                    if (isWithinInterval(deadlineDate, {start: monthStart, end: monthEnd}) && scad.stato !== 'Pagato') {
                        monthOutflows += (scad.importoPrevisto - scad.importoPagato);
                    }
                })
            }

            const closingBalance = openingBalance + monthInflows - monthOutflows;
            const monthResult = {
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                starting: openingBalance,
                inflows: monthInflows,
                outflows: monthOutflows,
                closing: closingBalance,
            };
            openingBalance = closingBalance;
            return monthResult;
        });

        return { monthlyData: data };

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
