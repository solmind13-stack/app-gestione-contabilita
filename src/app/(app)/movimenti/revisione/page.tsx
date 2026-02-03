// src/app/(app)/movimenti/revisione/page.tsx
"use client";

import { useState, useMemo, useCallback } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc, DocumentData } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Loader2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Movimento, AppUser, TrainingFeedback } from '@/lib/types';
import { AddMovementDialog } from '@/components/movimenti/add-movement-dialog';
import { useToast } from "@/hooks/use-toast";

export default function RevisionePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [editingMovement, setEditingMovement] = useState<Movimento | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const movimentiDaRevisionareQuery = useMemo(() => {
    if (!firestore || !user) return null;
    let q: DocumentData = query(collection(firestore, 'movements'), where('status', '==', 'manual_review'));
    if(user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        q = query(q, where('societa', '==', user.company));
    }
    return q;
  }, [firestore, user?.uid, user?.role, user?.company]);

  const { data: movimenti, isLoading: isLoadingMovimenti, error } = useCollection<Movimento>(movimentiDaRevisionareQuery);

  const handleSaveFeedback = useCallback(async (feedback: Omit<TrainingFeedback, 'id' | 'createdAt'>) => {
    if (!firestore) return;
    try {
        await addDoc(collection(firestore, 'training_feedback'), {
            ...feedback,
            createdAt: new Date().toISOString(),
        });
    } catch(e) {
        console.error("Failed to save training feedback:", e);
        // We don't show a toast here to not bother the user if this fails
    }
  }, [firestore]);


  const handleEditMovement = async (updatedMovement: Movimento) => {
    if (!user || !firestore || !updatedMovement.id) return;

    const originalMovement = movimenti?.find(m => m.id === updatedMovement.id);

    try {
        const movementDocRef = doc(firestore, 'movements', updatedMovement.id);
        const finalMovementData = {
            ...updatedMovement,
            status: 'ok' as const, // Mark as reviewed
            updatedAt: new Date().toISOString(),
        };
        await updateDoc(movementDocRef, finalMovementData as any);

        // Feedback loop logic
        if (originalMovement && originalMovement.status === 'manual_review') {
            await handleSaveFeedback({
                descriptionPattern: originalMovement.descrizione,
                category: updatedMovement.categoria,
                subcategory: updatedMovement.sottocategoria,
                userId: user.uid,
            });
        }
        
        toast({ title: "Movimento Aggiornato", description: "La classificazione è stata salvata." });
    } catch (e) {
        console.error("Error updating movement:", e);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare il movimento.' });
    }
  };

  const openEditDialog = (movimento: Movimento) => {
    setEditingMovement(movimento);
    setIsDialogOpen(true);
  };
  
  const isLoading = isUserLoading || isLoadingMovimenti;

  return (
    <div className="space-y-6">
      <AddMovementDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        onEditMovement={handleEditMovement}
        onAddMovement={async () => {}} // Not used here
        movementToEdit={editingMovement}
        currentUser={user!}
        // Pass empty arrays for linkable items as they are not needed in review mode
        deadlines={[]} 
        expenseForecasts={[]}
        incomeForecasts={[]}
        companies={[]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Movimenti da Revisionare</CardTitle>
          <CardDescription>
            Controlla i movimenti importati che l'AI non è riuscita a classificare con certezza.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Società</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right">Entrata</TableHead>
                <TableHead className="text-right">Uscita</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-red-500">
                    Errore nel caricamento dei dati da revisionare.
                  </TableCell>
                </TableRow>
              ) : movimenti && movimenti.length > 0 ? (
                movimenti.map((movimento) => (
                  <TableRow key={movimento.id}>
                    <TableCell>{formatDate(movimento.data)}</TableCell>
                    <TableCell><Badge variant={movimento.societa === 'LNC' ? 'default' : 'secondary'}>{movimento.societa}</Badge></TableCell>
                    <TableCell className="font-medium">{movimento.descrizione}</TableCell>
                    <TableCell className="text-right text-green-600">{movimento.entrata > 0 ? formatCurrency(movimento.entrata) : '-'}</TableCell>
                    <TableCell className="text-right text-red-600">{movimento.uscita > 0 ? formatCurrency(movimento.uscita) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(movimento)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Revisiona
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Info className="h-8 w-8"/>
                        <p className="font-semibold">Nessun movimento da revisionare!</p>
                        <p className="text-sm">Tutti i movimenti importati sono stati classificati con successo.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
