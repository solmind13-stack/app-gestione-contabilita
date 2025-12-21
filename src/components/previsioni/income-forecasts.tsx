// src/components/previsioni/income-forecasts.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrevisioneEntrata, AppUser } from '@/lib/types';
import { AddIncomeForecastDialog } from './add-income-forecast-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

interface IncomeForecastsProps {
    data: PrevisioneEntrata[];
    year: number;
    isLoading: boolean;
    onAdd: (forecast: Omit<PrevisioneEntrata, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onEdit: (forecast: PrevisioneEntrata) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    defaultCompany?: 'LNC' | 'STG';
    currentUser: AppUser;
}

export function IncomeForecasts({ data, year, isLoading, onAdd, onEdit, onDelete, defaultCompany, currentUser }: IncomeForecastsProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [forecastToEdit, setForecastToEdit] = useState<PrevisioneEntrata | null>(null);
    const [forecastToDelete, setForecastToDelete] = useState<PrevisioneEntrata | null>(null);

    const handleOpenDialog = (forecast?: PrevisioneEntrata) => {
        setForecastToEdit(forecast || null);
        setIsDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!forecastToDelete) return;
        await onDelete(forecastToDelete.id);
        setForecastToDelete(null);
    }
    
    const filteredData = useMemo(() => data.filter(item => item.anno === year), [data, year]);
    
    const canPerformActions = currentUser.role === 'admin' || currentUser.role === 'editor' || currentUser.role === 'company-editor';

    return (
        <>
            <AddIncomeForecastDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                onAddForecast={onAdd}
                onEditForecast={onEdit}
                forecastToEdit={forecastToEdit}
                defaultCompany={defaultCompany}
                currentUser={currentUser}
            />
            <AlertDialog open={!!forecastToDelete} onOpenChange={(open) => !open && setForecastToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. La previsione di entrata "{forecastToDelete?.descrizione}" sarà eliminata permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Previsioni di Entrata</CardTitle>
                        <CardDescription>Gestisci le entrate previste per il {year}.</CardDescription>
                    </div>
                    {canPerformActions && (
                        <Button onClick={() => handleOpenDialog()}>
                            <PlusCircle />
                            Aggiungi Entrata
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Descrizione</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Importo Lordo</TableHead>
                                    <TableHead className="text-center">Probabilità</TableHead>
                                    <TableHead>Stato</TableHead>
                                    <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            Nessuna previsione di entrata per il {year}.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredData.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.descrizione}</TableCell>
                                            <TableCell>{formatDate(item.dataPrevista)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.importoLordo)}</TableCell>
                                            <TableCell className="text-center">{(item.probabilita * 100).toFixed(0)}%</TableCell>
                                            <TableCell>
                                                <Badge variant={item.stato === 'Incassato' ? 'secondary' : 'default'} className={item.stato === 'Da incassare' ? 'bg-green-500' : ''}>
                                                    {item.stato}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canPerformActions && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setForecastToDelete(item)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
