// src/components/previsioni/expense-forecasts.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrevisioneUscita, AppUser } from '@/lib/types';
import { AddExpenseForecastDialog } from './add-expense-forecast-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

interface ExpenseForecastsProps {
    data: PrevisioneUscita[];
    year: number;
    isLoading: boolean;
    onAdd: (forecast: Omit<PrevisioneUscita, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    onEdit: (forecast: PrevisioneUscita) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    defaultCompany?: 'LNC' | 'STG';
    currentUser: AppUser;
}

export function ExpenseForecasts({ data, year, isLoading, onAdd, onEdit, onDelete, defaultCompany, currentUser }: ExpenseForecastsProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [forecastToEdit, setForecastToEdit] = useState<PrevisioneUscita | null>(null);
    const [forecastToDelete, setForecastToDelete] = useState<PrevisioneUscita | null>(null);

    const handleOpenDialog = (forecast?: PrevisioneUscita) => {
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
            <AddExpenseForecastDialog
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
                            Questa azione non può essere annullata. La previsione di uscita "{forecastToDelete?.descrizione}" sarà eliminata permanentemente.
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
                        <CardTitle>Previsioni di Uscita</CardTitle>
                        <CardDescription>Gestisci le uscite previste per il {year}.</CardDescription>
                    </div>
                     {canPerformActions && (
                        <Button onClick={() => handleOpenDialog()}>
                            <PlusCircle />
                            Aggiungi Uscita
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Società</TableHead>
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
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            Nessuna previsione di uscita per il {year}.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredData.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <Badge variant={item.societa === 'LNC' ? 'default' : 'secondary'}>{item.societa}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{item.descrizione}</TableCell>
                                            <TableCell>{formatDate(item.dataScadenza)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.importoLordo)}</TableCell>
                                            <TableCell className="text-center">{(item.probabilita * 100).toFixed(0)}%</TableCell>
                                            <TableCell>
                                                <Badge variant={item.stato === 'Pagato' ? 'secondary' : 'default'} className={item.stato === 'Da pagare' ? 'bg-red-500' : ''}>
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
