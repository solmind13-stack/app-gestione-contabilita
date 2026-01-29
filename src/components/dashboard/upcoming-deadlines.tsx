// src/components/dashboard/upcoming-deadlines.tsx

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Scadenza } from "@/lib/types";
import { AlertTriangle, CalendarOff } from "lucide-react";

interface UpcomingDeadlinesProps {
    deadlines: Scadenza[];
}

export function UpcomingDeadlines({ deadlines }: UpcomingDeadlinesProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-orange-500" />
            Prossime Scadenze
        </CardTitle>
        <CardDescription>Le prossime 5 scadenze entro i prossimi 3 mesi.</CardDescription>
      </CardHeader>
      <CardContent>
        {deadlines && deadlines.length > 0 ? (
            <Table>
                <TableBody>
                    {deadlines.map(d => (
                        <TableRow key={d.id}>
                            <TableCell className="p-2">
                                <div className="font-medium">{d.descrizione}</div>
                                <div className="text-sm text-muted-foreground">{formatDate(d.dataScadenza)}</div>
                            </TableCell>
                            <TableCell className="p-2 text-right">
                                <div className="font-bold text-orange-600">{formatCurrency(d.importoPrevisto - d.importoPagato)}</div>
                                <Badge variant="outline">{d.societa}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                <CalendarOff className="w-10 h-10 mb-4" />
                <p className="font-semibold">Nessuna scadenza imminente.</p>
                <p className="text-sm">Tutto tranquillo per ora!</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
