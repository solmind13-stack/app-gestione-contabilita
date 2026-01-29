// src/components/dashboard/monthly-summary-table.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MonthlySummaryTableProps {
    data: {
        month: string;
        starting: number;
        inflows: number;
        outflows: number;
        closing: number;
    }[];
    isLoading: boolean;
}

export function MonthlySummaryTable({ data: monthlyData, isLoading }: MonthlySummaryTableProps) {
    
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
                                    <TableHead className="text-right text-green-600">Entrate</TableHead>
                                    <TableHead className="text-right text-red-600">Uscite</TableHead>
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
