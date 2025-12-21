// src/app/(app)/movimenti/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, query, where, getDocs, doc, addDoc, updateDoc, CollectionReference, deleteDoc } from 'firebase/firestore';

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Pencil, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { movimentiData as initialMovimenti } from '@/lib/movimenti-data';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Movimento, Riepilogo, AppUser } from '@/lib/types';
import { AddMovementDialog } from '@/components/movimenti/add-movement-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { ImportMovementsDialog } from '@/components/movimenti/import-movements-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIE, YEARS } from '@/lib/constants';

const getMovimentiQuery = (firestore: any, user: AppUser | null, company: 'LNC' | 'STG' | 'Tutte') => {
    if (!firestore || !user) return null;
    
    let q = collection(firestore, 'movements') as CollectionReference<Movimento>;

    if (user.role === 'admin' || user.role === 'editor') {
        if (company !== 'Tutte') {
            return query(q, where('societa', '==', company));
        }
    } else if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null; // Should not happen if user is set up correctly
        return query(q, where('societa', '==', user.company));
    }

    return query(q); // For admin/editor with "Tutte" selected
}


export default function MovimentiPage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
    
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    
    const movimentiQuery = useMemo(() => getMovimentiQuery(firestore, user, selectedCompany), [firestore, user, selectedCompany]);

    const { data: movimentiData, isLoading: isLoadingMovimenti, error } = useCollection<Movimento>(movimentiQuery);

    const [isSeeding, setIsSeeding] = useState(false);
    const [movementToDelete, setMovementToDelete] = useState<Movimento | null>(null);
    const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Filters state
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('Tutti');
    const [selectedOperator, setSelectedOperator] = useState<string>('Tutti');
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true);
        // Set default year on client side to prevent hydration mismatch
        if (!selectedYear) {
            setSelectedYear(YEARS[1].toString());
        }
    }, []);


     useEffect(() => {
        const seedDatabase = async () => {
            if (!firestore || isSeeding) return;

            // Check if seeding is necessary by checking one collection
            const q = query(collection(firestore, "movements"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setIsSeeding(true);
                toast({ title: "Popolamento database...", description: "Caricamento dati iniziali in corso. Potrebbe richiedere un istante." });
                
                try {
                    const batch = writeBatch(firestore);
                    
                    // Seed movements
                    initialMovimenti.forEach((movimento) => {
                        const docRef = doc(collection(firestore, "movements"));
                        const { id, ...movimentoData } = movimento;
                        batch.set(docRef, { 
                            ...movimentoData, 
                            createdBy: user?.uid || 'system',
                            inseritoDa: 'System', 
                            createdAt: new Date().toISOString() 
                        });
                    });
                    
                    await batch.commit();
                    toast({ title: "Database popolato!", description: "I dati iniziali sono stati caricati con successo." });
                } catch (error) {
                    console.error("Error seeding database:", error);
                    toast({ variant: "destructive", title: "Errore nel popolamento", description: "Impossibile caricare i dati iniziali." });
                } finally {
                    setIsSeeding(false);
                }
            }
        };
        if (firestore && user && !isLoadingMovimenti) {
            seedDatabase();
        }
    }, [firestore, toast, isSeeding, isLoadingMovimenti, user]);


    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
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
    
    const handleAddMovement = async (newMovementData: Omit<Movimento, 'id'>) => {
        if (!user || !firestore) return;
        try {
            await addDoc(collection(firestore, 'movements'), {
                ...newMovementData,
                createdBy: user.uid,
                inseritoDa: user.displayName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Movimento Aggiunto", description: "Il nuovo movimento è stato salvato." });
        } catch (error) {
            console.error("Error adding movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Salvataggio', description: 'Impossibile salvare il movimento. Controlla i permessi.' });
        }
    };

    const handleEditMovement = async (updatedMovement: Movimento) => {
         if (!user || !firestore || !updatedMovement.id) return;
        try {
            const docRef = doc(firestore, 'movements', updatedMovement.id);
            const { id, ...dataToUpdate } = updatedMovement;
            await updateDoc(docRef, { 
                ...dataToUpdate, 
                updatedAt: new Date().toISOString(), 
                createdBy: updatedMovement.createdBy || user.uid,
                inseritoDa: user.displayName, // Always update with the current editor
            });
            toast({ title: "Movimento Aggiornato", description: "Il movimento è stato modificato." });
        } catch (error) {
             console.error("Error updating movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile modificare il movimento. Controlla i permessi.' });
        }
    };

    const handleDeleteMovement = async () => {
        if (!movementToDelete || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'movements', movementToDelete.id));
            toast({ title: "Movimento Eliminato", description: "Il movimento è stato eliminato con successo." });
        } catch (error) {
            console.error("Error deleting movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Eliminazione', description: 'Impossibile eliminare il movimento. Controlla i permessi.' });
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
    
    const handleImportMovements = async (importedMovements: Omit<Movimento, 'id'>[]) => {
        if (!user || !firestore) return;
        try {
            const batch = writeBatch(firestore);
            importedMovements.forEach(movement => {
                const docRef = doc(collection(firestore, 'movements'));
                batch.set(docRef, {
                    ...movement,
                    createdBy: user.uid,
                    inseritoDa: user.displayName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            });
            await batch.commit();
            toast({
                title: "Importazione completata",
                description: `${importedMovements.length} movimenti sono stati importati con successo.`
            });
        } catch (error) {
             console.error("Error importing movements: ", error);
             toast({ variant: 'destructive', title: 'Errore Importazione', description: 'Impossibile salvare i movimenti importati.' });
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
        uniqueCategories, 
        uniqueSubCategories, 
        uniqueOperators 
    } = useMemo(() => {
        let data = movimentiData || [];
        
        // Dynamic options for filters
        const categories = [...new Set(data.map(m => m.categoria))].sort();
        const operators = [...new Set(data.map(m => m.operatore).filter(Boolean))].sort();
        
        // Filtering logic
        let filtered = data
            .filter(m => !selectedYear || selectedYear === 'Tutti' || m.anno === Number(selectedYear))
            .filter(m => selectedCategory === 'Tutti' || m.categoria === selectedCategory)
            .filter(m => selectedSubCategory === 'Tutti' || m.sottocategoria === selectedSubCategory)
            .filter(m => selectedOperator === 'Tutti' || m.operatore === selectedOperator)
            .filter(m => m.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // After filtering by category, find available subcategories
        const subCategories = [...new Set(filtered.map(m => m.sottocategoria))].sort();

        // Sorting logic
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
            uniqueCategories: categories,
            uniqueSubCategories: subCategories,
            uniqueOperators: operators
        };
    }, [movimentiData, searchTerm, sortOrder, selectedYear, selectedCategory, selectedSubCategory, selectedOperator]);
    
    useEffect(() => {
        // Reset subcategory if parent category changes and subcategory is no longer valid
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
        return `Movimenti - ${selectedCompany}`;
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
        />
        <ImportMovementsDialog
            isOpen={isImportDialogOpen}
            setIsOpen={setIsImportDialogOpen}
            onImport={handleImportMovements}
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
        />
        <AlertDialog open={!!movementToDelete} onOpenChange={(open) => !open && setMovementToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione non può essere annullata. Il movimento &quot;{movementToDelete?.descrizione}&quot; del {movementToDelete && formatDate(movementToDelete.data)} per un importo di {movementToDelete && formatCurrency(movementToDelete.entrata > 0 ? movementToDelete.entrata : movementToDelete.uscita)} sarà eliminato permanentemente.
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

       <Tabs value={selectedCompany} onValueChange={(value) => setSelectedCompany(value as 'LNC' | 'STG' | 'Tutte')} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            {user && (user.role === 'admin' || user.role === 'editor') && (
                 <TabsList>
                    <TabsTrigger value="Tutte">Tutte</TabsTrigger>
                    <TabsTrigger value="LNC">LNC</TabsTrigger>
                    <TabsTrigger value="STG">STG</TabsTrigger>
                </TabsList>
            )}
            <div className={cn("flex w-full md:w-auto items-center gap-2", (user?.role === 'admin' || user?.role === 'editor') ? '' : 'ml-auto')}>
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
        {isClient && <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Anno:</label>
                <Select value={selectedYear || ''} onValueChange={(value) => setSelectedYear(value)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Anno" />
                    </SelectTrigger>
                    <SelectContent>
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
        </div>}

        <Card>
            <CardHeader>
                <CardTitle>{getPageTitle()}</CardTitle>
                <CardDescription>
                    Visualizza, aggiungi e importa i tuoi movimenti finanziari per l'anno {selectedYear}.
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
                        <TableRow key={movimento.id} data-state={isSelected ? "selected" : ""}>
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
                                <Badge variant={movimento.societa === 'LNC' ? 'default' : 'secondary'}>{movimento.societa}</Badge>
                            </TableCell>
                            <TableCell>{movimento.anno}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(movimento.data)}</TableCell>
                            <TableCell>{movimento.descrizione}</TableCell>
                            <TableCell>
                            <Badge variant="secondary">{movimento.categoria}</Badge>
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
                            <TableCell>{movimento.conto}</TableCell>
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
        </Tabs>


      <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardHeader>
              <CardTitle>Riepilogo Movimenti {selectedCompany !== 'Tutte' && (user?.role === 'admin' || user?.role === 'editor') ? selectedCompany : ''}</CardTitle>
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
