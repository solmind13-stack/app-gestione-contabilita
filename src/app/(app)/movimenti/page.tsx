// src/app/(app)/movimenti/page.tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, writeBatch, query, where, getDocs, doc, addDoc, updateDoc, CollectionReference, deleteDoc, runTransaction, getDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  TableFooter
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Pencil, Sparkles, Loader2, Trash2, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, maskAccountNumber } from '@/lib/utils';
import type { Movimento, Riepilogo, AppUser, Scadenza, PrevisioneUscita, PrevisioneEntrata, CompanyProfile, AppSettings, TrainingFeedback } from '@/lib/types';
import { AddMovementDialog } from '@/components/movimenti/add-movement-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { ImportMovementsDialog } from '@/components/movimenti/import-movements-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIE, YEARS } from '@/lib/constants';
import { ReviewMovementsDialog } from '@/components/movimenti/review-movements-dialog';

const getQuery = (firestore: any, user: AppUser | null, collectionName: string) => {
    if (!firestore || !user) return null;
    let q = collection(firestore, collectionName) as CollectionReference<DocumentData>;
    if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        return query(q, where('societa', '==', user.company));
    }
    return query(q);
}


export default function MovimentiPage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
    
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const settingsDocRef = useMemo(() => firestore ? doc(firestore, 'settings', 'appConfiguration') : null, [firestore]);
    const { data: appSettings, isLoading: isLoadingSettings } = useDoc<AppSettings>(settingsDocRef);
    
    const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user]);
    const deadlinesQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user]);
    const expenseForecastsQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user]);
    const incomeForecastsQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user]);
    const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    

    const { data: movimentiData, isLoading: isLoadingMovimenti, error } = useCollection<Movimento>(movimentiQuery);
    const { data: deadlines } = useCollection<Scadenza>(deadlinesQuery);
    const { data: expenseForecasts } = useCollection<PrevisioneUscita>(expenseForecastsQuery);
    const { data: incomeForecasts } = useCollection<PrevisioneEntrata>(incomeForecastsQuery);
    const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);


    const [isSeeding, setIsSeeding] = useState(false);
    const [movementToDelete, setMovementToDelete] = useState<Movimento | null>(null);
    const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Filters state
    const [selectedYear, setSelectedYear] = useState<string>('Tutti');
    const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Tutti');
    const [selectedOperator, setSelectedOperator] = useState<string>('Tutti');


    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingMovement, setEditingMovement] = useState<Movimento | null>(null);

    // Set the default selected company based on user role
    useEffect(() => {
        if (user?.role === 'company' && user.company) {
            setSelectedCompany(user.company);
        } else if (user?.role === 'company-editor' && user.company) {
            setSelectedCompany(user.company);
        }
    }, [user]);

    const handleOpenAddDialog = (movement?: Movimento) => {
        setEditingMovement(movement || null);
        setIsAddDialogOpen(true);
    }
    
    const handleSaveFeedback = useCallback(async (feedback: Omit<TrainingFeedback, 'id' | 'createdAt'>) => {
        if (!firestore || !user) return;
        try {
            await addDoc(collection(firestore, 'training_feedback'), {
                ...feedback,
                createdAt: new Date().toISOString(),
                userId: user.uid,
            });
        } catch(e) {
            console.error("Failed to save training feedback:", e);
        }
    }, [firestore, user]);
    
    const handleAddMovement = async (newMovementData: Omit<Movimento, 'id'>, linkedItemId?: string) => {
        if (!user || !firestore) return;
        
        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. If a link is provided, first READ the linked document
                let linkedDocRef;
                let linkedDoc;
                if (linkedItemId) {
                    const [collectionName, docId] = linkedItemId.split('/');
                    if (!collectionName || !docId) throw new Error("ID elemento collegato non valido.");
                    
                    linkedDocRef = doc(firestore, collectionName, docId);
                    linkedDoc = await transaction.get(linkedDocRef);
                    if (!linkedDoc.exists()) {
                        throw new Error("Documento collegato non trovato!");
                    }
                }
                
                // 2. Perform all WRITES
                const newMovementRef = doc(collection(firestore, "movements"));
                const movementPayload = {
                    ...newMovementData,
                    createdBy: user.uid,
                    inseritoDa: user.displayName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    linkedTo: linkedItemId || null, // Ensure linkedTo is null, not undefined
                    status: 'ok' as const,
                };
                transaction.set(newMovementRef, movementPayload);

                // 3. Update the linked document if it exists
                if (linkedDocRef && linkedDoc) {
                    const collectionName = linkedDocRef.parent.id;
                    if (collectionName === 'deadlines') {
                        const data = linkedDoc.data() as Scadenza;
                        const movementAmount = newMovementData.uscita;
                        const newPaidAmount = (data.importoPagato || 0) + movementAmount;
                        const newStatus = newPaidAmount >= data.importoPrevisto ? 'Pagato' : 'Parziale';
                        
                        transaction.update(linkedDocRef, {
                            importoPagato: newPaidAmount,
                            stato: newStatus,
                            dataPagamento: newMovementData.data
                        });
                    } else if (collectionName === 'expenseForecasts') {
                        const data = linkedDoc.data() as PrevisioneUscita;
                        const movementAmount = newMovementData.uscita;
                        const newPaidAmount = (data.importoEffettivo || 0) + movementAmount;
                        const newStatus = newPaidAmount >= data.importoLordo ? 'Pagato' : 'Parziale';
                        
                        transaction.update(linkedDocRef, {
                            importoEffettivo: newPaidAmount,
                            stato: newStatus,
                            dataPagamento: newMovementData.data
                        });
                    } else if (collectionName === 'incomeForecasts') {
                        const data = linkedDoc.data() as PrevisioneEntrata;
                        const movementAmount = newMovementData.entrata;
                        const newReceivedAmount = (data.importoEffettivo || 0) + movementAmount;
                        const newStatus = newReceivedAmount >= data.importoLordo ? 'Incassato' : 'Parziale';

                        transaction.update(linkedDocRef, {
                            importoEffettivo: newReceivedAmount,
                            stato: newStatus,
                            dataIncasso: newMovementData.data
                        });
                    }
                }
            });
            
            toast({ title: "Operazione Completata", description: "Il movimento è stato salvato e i dati collegati sono stati aggiornati." });

        } catch (error: any) {
            console.error("Error in transaction: ", error);
            toast({ variant: 'destructive', title: 'Errore Transazione', description: `Impossibile completare l'operazione. ${error.message}` });
        }
    };

    const handleEditMovement = async (updatedMovement: Movimento) => {
        if (!user || !firestore || !updatedMovement.id) return;
    
        const originalMovement = movimentiData?.find(m => m.id === updatedMovement.id);
    
        try {
            await runTransaction(firestore, async (transaction) => {
                const movementDocRef = doc(firestore, 'movements', updatedMovement.id);
    
                const originalMovementSnap = await transaction.get(movementDocRef);
                if (!originalMovementSnap.exists()) {
                    throw new Error("Movimento originale non trovato!");
                }
                const originalMovementData = originalMovementSnap.data() as Movimento;
    
                let linkedDocSnap;
                let linkedDocRef;
                if (updatedMovement.linkedTo) {
                    const [collectionName, docId] = updatedMovement.linkedTo.split('/');
                    if (!collectionName || !docId) throw new Error("ID elemento collegato non valido.");
                    linkedDocRef = doc(firestore, collectionName, docId);
                    linkedDocSnap = await transaction.get(linkedDocRef);
                    if (!linkedDocSnap?.exists()) {
                        console.warn(`Documento collegato ${updatedMovement.linkedTo} non trovato durante l'aggiornamento.`);
                        linkedDocRef = undefined; 
                    }
                }
    
                const { id, ...dataToUpdate } = updatedMovement;
                const finalMovementData = {
                    ...dataToUpdate,
                    updatedAt: new Date().toISOString(),
                    createdBy: originalMovementData.createdBy || user.uid,
                    inseritoDa: user.displayName,
                };
    
                transaction.update(movementDocRef, finalMovementData);
    
                if (linkedDocRef && linkedDocSnap?.exists()) {
                    const collectionName = linkedDocRef.parent.id;
                    const originalAmount = originalMovementData.uscita > 0 ? originalMovementData.uscita : -originalMovementData.entrata;
                    const newAmount = updatedMovement.uscita > 0 ? updatedMovement.uscita : -updatedMovement.entrata;
                    const amountDifference = newAmount - originalAmount;
    
                    if (collectionName === 'deadlines') {
                        const data = linkedDocSnap.data() as Scadenza;
                        const newPaidAmount = (data.importoPagato || 0) + amountDifference;
                        const newStatus = newPaidAmount >= data.importoPrevisto ? 'Pagato' : (newPaidAmount > 0 ? 'Parziale' : 'Da pagare');
                        transaction.update(linkedDocRef, { importoPagato: newPaidAmount, stato: newStatus });
    
                    } else if (collectionName === 'expenseForecasts' || collectionName === 'incomeForecasts') {
                        const data = linkedDocSnap.data() as PrevisioneUscita | PrevisioneEntrata;
                        const newEffectiveAmount = (data.importoEffettivo || 0) + amountDifference;
                        const isExpense = collectionName === 'expenseForecasts';
                        
                        let newStatus;
                        if (newEffectiveAmount >= data.importoLordo) {
                            newStatus = isExpense ? 'Pagato' : 'Incassato';
                        } else if (newEffectiveAmount > 0) {
                            newStatus = 'Parziale';
                        } else {
                            newStatus = isExpense ? 'Da pagare' : 'Da incassare';
                        }
                        transaction.update(linkedDocRef, { importoEffettivo: newEffectiveAmount, stato: newStatus });
                    }
                }
            });
            
            if (originalMovement && originalMovement.status === 'manual_review' && updatedMovement.status === 'ok') {
                await handleSaveFeedback({
                    descriptionPattern: originalMovement.descrizione,
                    category: updatedMovement.categoria,
                    subcategory: updatedMovement.sottocategoria,
                    userId: user.uid,
                });
            }
    
            toast({ title: "Movimento Aggiornato", description: "Il movimento e le voci collegate sono stati aggiornati." });
        } catch (error: any) {
            console.error("Error updating movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: `Impossibile modificare il movimento. ${error.message}` });
        }
    };

    const handleDeleteMovement = async () => {
        if (!movementToDelete || !firestore) return;
        try {
            await runTransaction(firestore, async (transaction) => {
                const movementDocRef = doc(firestore, 'movements', movementToDelete.id);
                
                const movementSnap = await transaction.get(movementDocRef);
                if (!movementSnap.exists()) {
                    throw new Error("Movimento da eliminare non trovato.");
                }
                const movement = movementSnap.data() as Movimento;

                if (movement.linkedTo) {
                    const [collectionName, docId] = movement.linkedTo.split('/');
                    const linkedDocRef = doc(firestore, collectionName, docId);
                    const linkedDocSnap = await transaction.get(linkedDocRef);
                    
                    if (linkedDocSnap.exists()) {
                        
                        if (collectionName === 'deadlines') {
                            const data = linkedDocSnap.data() as Scadenza;
                            const movementAmount = movement.uscita;
                            const newPaidAmount = (data.importoPagato || 0) - movementAmount;
                            const newStatus = newPaidAmount >= data.importoPrevisto ? 'Pagato' : (newPaidAmount > 0 ? 'Parziale' : 'Da pagare');
                            transaction.update(linkedDocRef, { importoPagato: newPaidAmount, stato: newStatus });
                        } else if (collectionName === 'expenseForecasts' || collectionName === 'incomeForecasts') {
                            const data = linkedDocSnap.data() as PrevisioneUscita | PrevisioneEntrata;
                            const movementAmount = movement.uscita > 0 ? movement.uscita : movement.entrata;
                            const newEffectiveAmount = (data.importoEffettivo || 0) - movementAmount;
                            
                            let newStatus;
                            const isExpense = collectionName === 'expenseForecasts';
                            if (newEffectiveAmount >= data.importoLordo) {
                                newStatus = isExpense ? 'Pagato' : 'Incassato';
                            } else if (newEffectiveAmount > 0) {
                                newStatus = 'Parziale';
                            } else {
                                newStatus = isExpense ? 'Da pagare' : 'Da incassare';
                            }
                            transaction.update(linkedDocRef, { importoEffettivo: newEffectiveAmount, stato: newStatus });
                        }
                    } else {
                        console.warn(`Documento collegato ${movement.linkedTo} non trovato durante l'eliminazione.`);
                    }
                }
                
                transaction.delete(movementDocRef);
            });
            
            toast({ title: "Movimento Eliminato", description: "Il movimento e la voce collegata sono stati aggiornati." });

        } catch (error: any) {
            console.error("Error deleting movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Eliminazione', description: `Impossibile eliminare il movimento. ${error.message}` });
        } finally {
            setMovementToDelete(null);
        }
    };


    const handleBulkDelete = async () => {
        if (!firestore || selectedIds.length === 0 || user?.role !== 'admin') {
            toast({ variant: 'destructive', title: 'Azione non permessa', description: 'Nessun elemento selezionato o permessi non sufficienti.' });
            return;
        }
        try {
            const batch = writeBatch(firestore);
            selectedIds.forEach(id => {
                const docRef = doc(firestore, 'movements', id);
                batch.delete(docRef);
            });
            await batch.commit();
            toast({ title: "Movimenti Eliminati", description: `${selectedIds.length} movimenti sono stati eliminati.` });
            setSelectedIds([]); // Clear selection
        } catch (error) {
            console.error("Error bulk deleting movements:", error);
            toast({ variant: 'destructive', title: 'Errore Eliminazione Multipla', description: 'Impossibile eliminare i movimenti selezionati.' });
        } finally {
            setIsBulkDeleteAlertOpen(false);
        }
    };
    
    const handleImportMovements = async (importedMovements: Omit<Movimento, 'id'>[]): Promise<Movimento[]> => {
        if (!user || !firestore) return [];
        const newMovementsWithIds: Movimento[] = [];
        try {
            const batch = writeBatch(firestore);
            
            importedMovements.forEach(movement => {
                const docRef = doc(collection(firestore, 'movements'));
                const newMovement: Movimento = {
                    id: docRef.id,
                    ...movement,
                    createdBy: user.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                batch.set(docRef, newMovement);
                newMovementsWithIds.push(newMovement);
            });

            await batch.commit();
            toast({
                title: "Importazione completata",
                description: `${newMovementsWithIds.length} movimenti sono stati salvati nel database.`
            });
            return newMovementsWithIds;

        } catch (error: any) {
             console.error("Error importing movements: ", error);
             toast({ variant: 'destructive', title: 'Errore Importazione', description: `Impossibile salvare i movimenti importati. ${error.message}` });
             return []; // Return empty array on failure
        }
    };


    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredMovimenti.map(m => m.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(rowId => rowId !== id));
        }
    };

    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - (lordo / (1 + iva));

    const { 
        filteredMovimenti, 
        movimentiDaRevisionare,
        uniqueCategories, 
        uniqueSubCategories, 
        uniqueOperators 
    } = useMemo(() => {
        let data = (movimentiData || []).filter(m => selectedCompany === 'Tutte' || m.societa === selectedCompany);
        
        const inReview = data.filter(m => m.status === 'manual_review');
        const approved = data.filter(m => m.status !== 'manual_review');
        
        const categories = [...new Set(approved.map(m => m.categoria).filter(Boolean))].sort();
        const operators = [...new Set(approved.map(m => m.operatore).filter(Boolean))].sort();
        
        let filtered = approved
            .filter(m => selectedYear === 'Tutti' || m.anno === Number(selectedYear))
            .filter(m => selectedCategory === 'Tutti' || m.categoria === selectedCategory)
            .filter(m => selectedSubCategory === 'Tutti' || m.sottocategoria === selectedSubCategory)
            .filter(m => selectedOperator === 'Tutti' || m.operatore === selectedOperator)
            .filter(m => m.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const subCategories = [...new Set(filtered.map(m => m.sottocategoria).filter(Boolean))].sort();

        filtered = filtered.sort((a, b) => {
                const dateA = new Date(a.data).getTime();
                const dateB = new Date(b.data).getTime();
                 if (sortOrder === 'asc') {
                    return dateA - dateB;
                } else {
                    return dateB - dateA;
                }
            });

        return {
            filteredMovimenti: filtered,
            movimentiDaRevisionare: inReview,
            uniqueCategories: categories,
            uniqueSubCategories: subCategories,
            uniqueOperators: operators
        };
    }, [movimentiData, searchTerm, sortOrder, selectedYear, selectedCategory, selectedSubCategory, selectedOperator, selectedCompany]);
    
    useEffect(() => {
        if (selectedCategory === 'Tutti') {
            setSelectedSubCategory('Tutti');
        }
    }, [selectedCategory]);

    const riepilogo = useMemo((): Riepilogo => {
        const data = filteredMovimenti;
        const totaleEntrate = data.reduce((acc, m) => acc + (m.entrata || 0), 0);
        const totaleUscite = data.reduce((acc, m) => acc + (m.uscita || 0), 0);
        const ivaEntrate = data.reduce((acc, m) => acc + (m.entrata && m.entrata > 0 ? calculateIva(m.entrata, m.iva) : 0), 0);
        const ivaUscite = data.reduce((acc, m) => acc + (m.uscita && m.uscita > 0 ? calculateIva(m.uscita, m.iva) : 0), 0);
        const saldo = totaleEntrate - totaleUscite;
        const ivaNetta = ivaEntrate - ivaUscite;

        return { totaleEntrate, totaleUscite, saldo, ivaEntrate, ivaUscite, ivaNetta };
    }, [filteredMovimenti]);
    
    const totalEntrateNette = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.entrata && m.entrata > 0 ? calculateNetto(m.entrata, m.iva) : 0), 0), [filteredMovimenti]);
    const totalIvaEntrate = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.entrata && m.entrata > 0 ? calculateIva(m.entrata, m.iva) : 0), 0), [filteredMovimenti]);
    const totalUsciteNette = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.uscita && m.uscita > 0 ? calculateNetto(m.uscita, m.iva) : 0), 0), [filteredMovimenti]);
    const totalIvaUscite = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.uscita && m.uscita > 0 ? calculateIva(m.uscita, m.iva) : 0), 0), [filteredMovimenti]);

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Movimenti';
        const companyName = companies?.find(c => c.sigla === selectedCompany)?.name || selectedCompany;
        return `Movimenti - ${companyName}`;
    }
    
    const canDelete = (movimento: Movimento) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.uid === movimento.createdBy;
    }

  return (
    <div className="flex flex-col gap-6">
       <AddMovementDialog
            isOpen={isAddDialogOpen}
            setIsOpen={setIsAddDialogOpen}
            onAddMovement={handleAddMovement}
            onEditMovement={handleEditMovement}
            movementToEdit={editingMovement}
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
            currentUser={user!}
            deadlines={deadlines || []}
            expenseForecasts={expenseForecasts || []}
            incomeForecasts={incomeForecasts || []}
            companies={companies || []}
        />
        <ImportMovementsDialog
            isOpen={isImportDialogOpen}
            setIsOpen={setIsImportDialogOpen}
            onImport={handleImportMovements}
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : undefined}
            currentUser={user}
            companies={companies || []}
            categories={appSettings?.categories || {}}
            allMovements={movimentiData || []}
        />
        <ReviewMovementsDialog
            isOpen={isReviewDialogOpen}
            setIsOpen={setIsReviewDialogOpen}
            movementsToReview={movimentiDaRevisionare}
            appSettings={appSettings}
            onFeedback={handleSaveFeedback}
        />
        <AlertDialog open={!!movementToDelete} onOpenChange={(open) => !open && setMovementToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione non può essere annullata. Il movimento &quot;{movementToDelete?.descrizione}&quot; del {movementToDelete && formatDate(movementToDelete.data)} per un importo di {movementToDelete && formatCurrency(movementToDelete.entrata > 0 ? movementToDelete.entrata : movementToDelete.uscita)} sarà eliminato permanentemente. Se è collegato a una scadenza, l'importo pagato verrà stornato.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteMovement} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione non può essere annullata. Verranno eliminati permanentemente {selectedIds.length} movimenti.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">Elimina Tutti</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

       
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            {user && (user.role === 'admin' || user.role === 'editor') && (
                <Select value={selectedCompany} onValueChange={(value) => setSelectedCompany(value as string)}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Società" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutte">Tutte</SelectItem>
                        {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
            <div className={cn("flex w-full md:w-auto items-center gap-2", (user?.role === 'admin' || user?.role === 'editor') ? '' : 'ml-auto')}>
                <Button variant={movimentiDaRevisionare.length > 0 ? 'destructive' : 'outline'} onClick={() => setIsReviewDialogOpen(true)}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Da Revisionare ({movimentiDaRevisionare.length})
                </Button>
                {user?.role === 'admin' && selectedIds.length > 0 && (
                     <Button variant="destructive" onClick={() => setIsBulkDeleteAlertOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Elimina ({selectedIds.length})
                    </Button>
                )}
                <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cerca per descrizione..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenAddDialog()} className="flex-shrink-0" disabled={!user}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Aggiungi
                </Button>
                <Button variant="outline" className="flex-shrink-0" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importa
                </Button>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Anno:</label>
                <Select value={selectedYear || ''} onValueChange={(value) => setSelectedYear(value)}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Anno" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutti gli anni</SelectItem>
                        {YEARS.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Categoria:</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutte le Categorie</SelectItem>
                        {uniqueCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Sottocategoria:</label>
                <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory} disabled={selectedCategory === 'Tutti'}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sottocategoria" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutte le Sottocategorie</SelectItem>
                        {uniqueSubCategories.map(sub => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Operatore:</label>
                <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Operatore" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutti gli Operatori</SelectItem>
                        {uniqueOperators.map(op => (
                            <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>{getPageTitle()}</CardTitle>
                <CardDescription>
                    Visualizza, aggiungi e importa i tuoi movimenti finanziari {selectedYear === 'Tutti' ? 'per tutti gli anni' : `per l'anno ${selectedYear}`}.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    {user?.role === 'admin' && (
                        <TableHead padding="checkbox">
                        <Checkbox
                            checked={selectedIds.length > 0 && selectedIds.length === filteredMovimenti.length}
                            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                            aria-label="Seleziona tutte le righe"
                        />
                        </TableHead>
                    )}
                    <TableHead>Società</TableHead>
                    <TableHead>Anno</TableHead>
                    <TableHead>
                        <Button variant="ghost" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                            Data
                            {sortOrder === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUp className="ml-2 h-4 w-4" />}
                        </Button>
                    </TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Sottocategoria</TableHead>
                    <TableHead className="text-right">Entrate Lorde</TableHead>
                    <TableHead className="text-right">Uscite Lorde</TableHead>
                    <TableHead className="text-center">% IVA</TableHead>
                    <TableHead className="text-right">Entrate Nette</TableHead>
                    <TableHead className="text-right">IVA Entrate</TableHead>
                    <TableHead className="text-right">Uscite Nette</TableHead>
                    <TableHead className="text-right">IVA Uscite</TableHead>
                    <TableHead>Conto</TableHead>
                    <TableHead>Metodo Pag.</TableHead>
                    <TableHead>Pagato da (Operatore)</TableHead>
                    <TableHead>Inserito Da</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(isLoadingMovimenti || isUserLoading || isSeeding) ? (
                        <TableRow>
                            <TableCell colSpan={19} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                            </TableCell>
                        </TableRow>
                    ) : error ? (
                         <TableRow>
                            <TableCell colSpan={19} className="h-24 text-center text-red-500">
                                Errore nel caricamento dei dati: {error.message}
                            </TableCell>
                        </TableRow>
                    ) : filteredMovimenti.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={19} className="h-24 text-center">Nessun movimento trovato.</TableCell>
                        </TableRow>
                    ) : (
                        filteredMovimenti.map((movimento) => {
                            const isSelected = selectedIds.includes(movimento.id);
                            const entrataLorda = movimento.entrata || 0;
                            const uscitaLorda = movimento.uscita || 0;
                            const entrataNetta = entrataLorda > 0 ? calculateNetto(entrataLorda, movimento.iva) : 0;
                            const ivaEntrata = entrataLorda > 0 ? calculateIva(entrataLorda, movimento.iva) : 0;
                            const uscitaNetta = uscitaLorda > 0 ? calculateNetto(uscitaLorda, movimento.iva) : 0;
                            const ivaUscita = uscitaLorda > 0 ? calculateIva(uscitaLorda, movimento.iva) : 0;

                        return (
                        <TableRow key={movimento.id} data-state={isSelected ? "selected" : ""} className={movimento.status === 'manual_review' ? 'bg-amber-50 dark:bg-amber-950' : ''}>
                            {user?.role === 'admin' && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => handleSelectRow(movimento.id, checked as boolean)}
                                        aria-label="Seleziona riga"
                                    />
                                </TableCell>
                            )}
                            <TableCell>
                                <Badge variant="secondary">{movimento.societa}</Badge>
                            </TableCell>
                            <TableCell>{movimento.anno}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(movimento.data)}</TableCell>
                            <TableCell>{movimento.descrizione}</TableCell>
                            <TableCell>
                            <Badge variant="outline">{movimento.categoria}</Badge>
                            </TableCell>
                            <TableCell>{movimento.sottocategoria}</TableCell>
                            <TableCell className={cn("text-right font-medium", entrataLorda > 0 && "text-green-600")}>
                            {entrataLorda > 0 ? formatCurrency(entrataLorda) : '-'}
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", uscitaLorda > 0 && "text-red-600")}>
                            {uscitaLorda > 0 ? formatCurrency(uscitaLorda) : '-'}
                            </TableCell>
                            <TableCell className="text-center">{movimento.iva > 0 ? `${movimento.iva * 100}%` : '0%'}</TableCell>
                            <TableCell className="text-right">{entrataNetta > 0 ? formatCurrency(entrataNetta) : '-'}</TableCell>
                            <TableCell className="text-right">{ivaEntrata > 0 ? formatCurrency(ivaEntrata) : '-'}</TableCell>
                            <TableCell className="text-right">{uscitaNetta > 0 ? formatCurrency(uscitaNetta) : '-'}</TableCell>
                            <TableCell className="text-right">{ivaUscita > 0 ? formatCurrency(ivaUscita) : '-'}</TableCell>
                            <TableCell>{maskAccountNumber(movimento.conto)}</TableCell>
                            <TableCell>{movimento.metodoPag}</TableCell>
                            <TableCell>{movimento.operatore}</TableCell>
                            <TableCell>{movimento.inseritoDa}</TableCell>
                            <TableCell>{movimento.note}</TableCell>
                            <TableCell className="text-right">
                                <div className='flex justify-end'>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenAddDialog(movimento)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    {canDelete(movimento) && (
                                        <Button variant="ghost" size="icon" onClick={() => setMovementToDelete(movimento)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                        );
                    }))}
                </TableBody>
                {filteredMovimenti.length > 0 && (
                    <TableFooter>
                        <TableRow>
                        <TableCell colSpan={user?.role === 'admin' ? 7 : 6} className="font-bold">TOTALI</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{formatCurrency(riepilogo.totaleEntrate)}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">{formatCurrency(riepilogo.totaleUscite)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-bold">{formatCurrency(totalEntrateNette)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(totalIvaEntrate)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(totalUsciteNette)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(totalIvaUscite)}</TableCell>
                        <TableCell colSpan={6}></TableCell>
                        </TableRow>
                    </TableFooter>
                )}
                </Table>
            </div>
            </CardContent>
        </Card>


      <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardHeader>
              <CardTitle>Riepilogo Movimenti {selectedCompany !== 'Tutte' && (user?.role === 'admin' || user?.role === 'editor') ? (companies?.find(c => c.sigla === selectedCompany)?.name || selectedCompany) : ''}</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Entrate:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totaleEntrate)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Uscite:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totaleUscite)}</span>
                  </div>
                   <div className="flex justify-between font-bold">
                      <span>Saldo:</span>
                      <span>{formatCurrency(riepilogo.saldo)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Entrate:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.ivaEntrate)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Uscite:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.ivaUscite)}</span>
                  </div>
                   <div className="flex justify-between font-bold">
                      <span>IVA Netta:</span>
                      <span>{formatCurrency(riepilogo.ivaNetta)}</span>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
