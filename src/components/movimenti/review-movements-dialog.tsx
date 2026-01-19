// src/components/movimenti/review-movements-dialog.tsx

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import type { Movimento, AppSettings, TrainingFeedback } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CATEGORIE, IVA_PERCENTAGES, METODI_PAGAMENTO } from '@/lib/constants';

interface ReviewMovementsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  movementsToReview: Movimento[];
  appSettings: AppSettings | null;
  onFeedback: (feedback: Omit<TrainingFeedback, 'id' | 'createdAt'>) => Promise<void>;
}

export function ReviewMovementsDialog({
  isOpen,
  setIsOpen,
  movementsToReview,
  appSettings,
  onFeedback,
}: ReviewMovementsDialogProps) {
  const [editedMovements, setEditedMovements] = useState<Movimento[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    if (isOpen) {
      setEditedMovements(movementsToReview.map(mov => ({ ...mov })));
      setSelectedIds([]);
    }
  }, [isOpen, movementsToReview]);

  const handleFieldChange = (id: string, field: keyof Movimento, value: any) => {
    setEditedMovements(prev =>
      prev.map(mov => {
        if (mov.id === id) {
          const updatedMov = { ...mov, [field]: value };
          if (field === 'categoria') {
            updatedMov.sottocategoria = ''; // Reset subcategory when category changes
          }
          return updatedMov;
        }
        return mov;
      })
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? editedMovements.map(m => m.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(rowId => rowId !== id)
    );
  };

  const handleSaveChanges = async () => {
    if (!firestore || !user) return;
    setIsSaving(true);
    const batch = writeBatch(firestore);
    let changesCount = 0;

    for (const editedMov of editedMovements) {
      const originalMov = movementsToReview.find(m => m.id === editedMov.id);
      if (originalMov && JSON.stringify(originalMov) !== JSON.stringify(editedMov)) {
        changesCount++;
        const docRef = doc(firestore, 'movements', editedMov.id);
        const dataToUpdate = {
          ...editedMov,
          status: 'ok' as const,
          updatedAt: new Date().toISOString(),
        };
        batch.update(docRef, dataToUpdate as any);

        // Save feedback
        await onFeedback({
            descriptionPattern: originalMov.descrizione,
            category: dataToUpdate.categoria,
            subcategory: dataToUpdate.sottocategoria,
            userId: user.uid,
        });
      }
    }
    
    if (changesCount === 0) {
        toast({ title: "Nessuna modifica", description: "Nessun movimento è stato modificato." });
        setIsSaving(false);
        return;
    }

    try {
      await batch.commit();
      toast({ title: 'Modifiche Salvate', description: `${changesCount} movimenti sono stati aggiornati.` });
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving movements:', error);
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare le modifiche.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteSelected = async () => {
    if (!firestore || selectedIds.length === 0) return;
    setIsDeleting(true);
    const batch = writeBatch(firestore);
    selectedIds.forEach(id => {
      batch.delete(doc(firestore, 'movements', id));
    });

    try {
      await batch.commit();
      toast({ title: 'Movimenti Eliminati', description: `${selectedIds.length} movimenti sono stati eliminati.` });
      setEditedMovements(prev => prev.filter(m => !selectedIds.includes(m.id)));
      setSelectedIds([]);
    } catch (error) {
       console.error('Error deleting movements:', error);
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare i movimenti.' });
    } finally {
        setIsDeleting(false);
    }
  }

  const allCategories = appSettings?.categories ? Object.keys(appSettings.categories) : Object.keys(CATEGORIE);
  const allOperators = appSettings?.operators || [];
  const allPaymentMethods = appSettings?.paymentMethods || METODI_PAGAMENTO;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Revisione Movimenti Importati</DialogTitle>
          <DialogDescription>
            Modifica le categorie, l'IVA e altri dettagli direttamente qui. Salva tutte le modifiche alla fine.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"><Checkbox onCheckedChange={(e) => handleSelectAll(e as boolean)} checked={selectedIds.length > 0 && selectedIds.length === editedMovements.length && editedMovements.length > 0} /></TableHead>
                <TableHead className="w-28">Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="w-32 text-right">Importo</TableHead>
                <TableHead className="w-48">Categoria</TableHead>
                <TableHead className="w-48">Sottocategoria</TableHead>
                <TableHead className="w-24">% IVA</TableHead>
                <TableHead className="w-44">Metodo Pag.</TableHead>
                <TableHead className="w-44">Operatore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editedMovements.map(mov => {
                const subcategories = appSettings?.categories?.[mov.categoria] || CATEGORIE[mov.categoria as keyof typeof CATEGORIE] || [];
                return (
                  <TableRow key={mov.id} className="text-sm">
                    <TableCell className="p-2"><Checkbox onCheckedChange={(checked) => handleSelectRow(mov.id, checked as boolean)} checked={selectedIds.includes(mov.id)} /></TableCell>
                    <TableCell className="p-2 whitespace-nowrap">{formatDate(mov.data)}</TableCell>
                    <TableCell className="p-2 break-words">{mov.descrizione}</TableCell>
                    <TableCell className="p-2 text-right whitespace-nowrap">{formatCurrency(mov.entrata > 0 ? mov.entrata : mov.uscita)}</TableCell>
                    <TableCell className="p-2">
                      <Select value={mov.categoria} onValueChange={(value) => handleFieldChange(mov.id, 'categoria', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-2">
                      <Select value={mov.sottocategoria} onValueChange={(value) => handleFieldChange(mov.id, 'sottocategoria', value)} disabled={subcategories.length === 0}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{subcategories.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                     <TableCell className="p-2">
                      <Select value={String(mov.iva)} onValueChange={(value) => handleFieldChange(mov.id, 'iva', parseFloat(value))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{IVA_PERCENTAGES.map(iva => <SelectItem key={iva.value} value={String(iva.value)}>{iva.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-2">
                      <Select value={mov.metodoPag || ''} onValueChange={(value) => handleFieldChange(mov.id, 'metodoPag', value)}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..."/></SelectTrigger>
                        <SelectContent>{allPaymentMethods.map(mp => <SelectItem key={mp} value={mp}>{mp}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                     <TableCell className="p-2">
                      <Select value={mov.operatore || ''} onValueChange={(value) => handleFieldChange(mov.id, 'operatore', value)}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..."/></SelectTrigger>
                        <SelectContent>{allOperators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="pt-4 justify-between">
            <div>
                {selectedIds.length > 0 && (
                    <Button variant="destructive" onClick={handleDeleteSelected} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        Elimina Selezionati ({selectedIds.length})
                    </Button>
                )}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>Annulla</Button>
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Salva Modifiche
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
