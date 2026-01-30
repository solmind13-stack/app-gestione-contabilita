// src/components/previsioni/cashflow-detail.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CashflowDetailProps {
    year: number;
    data: {
        month: string;
        starting: number;
        inflows: number;
        outflows: number;
        closing: number;
    }[];
    isLoading: boolean;
    isAllYearsSelected: boolean;
}

export function CashflowDetail({ year, data, isLoading, isAllYearsSelected }: CashflowDetailProps) {
    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Dettaglio Flusso di Cassa per il {year}</CardTitle>
            <CardDescription>
                Visione mensile del flusso di cassa, combinando dati storici e previsionali (ponderati per probabilità).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      );
    }
    
    if (isAllYearsSelected) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Dettaglio Flusso di Cassa</CardTitle>
                </CardHeader>
                <CardContent className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Info className="h-8 w-8 mb-2"/>
                    <p>Seleziona un anno specifico per visualizzare</p>
                    <p>il dettaglio mensile del flusso di cassa.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Dettaglio Flusso di Cassa per il {year}</CardTitle>
                <CardDescription>
                    Visione mensile del flusso di cassa, combinando dati storici e previsionali (ponderati per probabilità).
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                        {(data || []).map((row, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{row.month}</TableCell>
                                <TableCell className="text-right">{formatCurrency(row.starting)}</TableCell>
                                <TableCell className="text-right text-green-600">{formatCurrency(row.inflows)}</TableCell>
                                <TableCell className="text-right text-red-600">{formatCurrency(row.outflows)}</TableCell>
                                <TableCell className={cn("text-right font-bold", row.closing < 0 ? 'text-destructive' : '')}>
                                    {formatCurrency(row.closing)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
