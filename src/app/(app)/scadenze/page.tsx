// src/app/(app)/scadenze/page.tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, getDocs, doc, addDoc, updateDoc, query, where, CollectionReference, deleteDoc } from 'firebase/firestore';
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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Pencil, CalendarClock, AlertTriangle, History, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Scadenza, AppUser, Movimento, DeadlineSuggestion, CompanyProfile } from '@/lib/types';
import { AddDeadlineDialog } from '@/components/scadenze/add-deadline-dialog';
import { useToast } from '@/hooks/use-toast';
import { YEARS, CATEGORIE, RICORRENZE, STATI_SCADENZE } from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { suggestDeadlines } from '@/ai/flows/suggest-deadlines-from-movements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportDeadlinesDialog } from '@/components/scadenze/import-deadlines-dialog';


const getScadenzeQuery = (firestore: any, user: AppUser | null, company: string) => {
    if (!firestore || !user) return null;
    
    let q = collection(firestore, 'deadlines') as CollectionReference<Scadenza>;

    if (user.role === 'admin' || user.role === 'editor') {
        if (company !== 'Tutte') {
            return query(q, where('societa', '==', company));
        }
    } else if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null; // Should not happen if user is set up correctly
        return query(q, where('societa', '==', user.company));
    }

    return query(q);
}

export default function ScadenzePage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [editingDeadline, setEditingDeadline] = useState<Scadenza | null>(null);
    const [deadlineToDelete, setDeadlineToDelete] = useState<Scadenza | null>(null);
    const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // State for AI suggestions
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
    const [deadlineSuggestions, setDeadlineSuggestions] = useState<DeadlineSuggestion[]>([]);
    const [selectedSuggestions, setSelectedSuggestions] = useState<DeadlineSuggestion[]>([]);

    // Filters
    const [selectedYear, setSelectedYear] = useState<string>('Tutti');
    const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
    const [selectedStatus, setSelectedStatus] = useState<string>('Tutti');
    const [selectedRecurrence, setSelectedRecurrence] = useState<string>('Tutti');

    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const deadlinesQuery = useMemo(() => getScadenzeQuery(firestore, user, selectedCompany), [firestore, user, selectedCompany]);
    const movimentiQuery = useMemo(() => firestore ? query(collection(firestore, 'movements')) : null, [firestore]);
    const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    
    const { data: scadenze, isLoading: isLoadingScadenze, error } = useCollection<Scadenza>(deadlinesQuery);
    const { data: movimenti, isLoading: isLoadingMovimenti } = useCollection<Movimento>(movimentiQuery);
    const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);

    const isLoading = isLoadingScadenze || isLoadingMovimenti || isUserLoading || isLoadingCompanies;

    useEffect(() => {
        if (user?.role === 'company' && user.company) {
            setSelectedCompany(user.company);
        }
         else if (user?.role === 'company-editor' && user.company) {
            setSelectedCompany(user.company);
        }
    }, [user]);

    const handleAddDeadline = async (newDeadlineData: Omit<Scadenza, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Utente non autenticato o database non disponibile.' });
            return;
        }
        try {
            await addDoc(collection(firestore, 'deadlines'), {
                ...newDeadlineData,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Scadenza Aggiunta", description: "La nuova scadenza è stata salvata." });
        } catch (error) {
            console.error("Error adding deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Salvataggio', description: 'Impossibile salvare la scadenza. Riprova.' });
        }
    };

    const handleEditDeadline = async (updatedDeadline: Scadenza) => {
         if (!user || !firestore || !updatedDeadline.id) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Dati non validi per l\'aggiornamento.' });
            return;
        }
        try {
            const docRef = doc(firestore, 'deadlines', updatedDeadline.id);
            const { id, ...dataToUpdate } = updatedDeadline;
            await updateDoc(docRef, {
                ...dataToUpdate,
                createdBy: updatedDeadline.createdBy || user.uid,
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Scadenza Aggiornata", description: "La scadenza è stata modificata." });
        } catch (error) {
             console.error("Error updating deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile modificare la scadenza. Riprova.' });
        }
    };
    
    const handleDeleteDeadline = async () => {
        if (!deadlineToDelete || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'deadlines', deadlineToDelete.id));
            toast({ title: "Scadenza Eliminata", description: "La scadenza è stata eliminata con successo." });
        } catch (error) {
            console.error("Error deleting deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Eliminazione', description: 'Impossibile eliminare la scadenza. Controlla i permessi.' });
        } finally {
            setDeadlineToDelete(null);
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
                const docRef = doc(firestore, 'deadlines', id);
                batch.delete(docRef);
            });
            await batch.commit();
            toast({ title: "Scadenze Eliminate", description: `${selectedIds.length} scadenze sono state eliminate.` });
            setSelectedIds([]); // Clear selection
        } catch (error) {
            console.error("Error bulk deleting deadlines:", error);
            toast({ variant: 'destructive', title: 'Errore Eliminazione Multipla', description: 'Impossibile eliminare le scadenze selezionate.' });
        } finally {
            setIsBulkDeleteAlertOpen(false);
        }
    };

    const handleImportDeadlines = async (importedDeadlines: Omit<Scadenza, 'id'>[]): Promise<Scadenza[]> => {
        if (!user || !firestore) return [];
        const newDeadlinesWithIds: Scadenza[] = [];
        try {
            const batch = writeBatch(firestore);
            
            importedDeadlines.forEach(deadline => {
                const docRef = doc(collection(firestore, 'deadlines'));
                const newDeadline: Scadenza = {
                    id: docRef.id,
                    ...deadline,
                    createdBy: user.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                batch.set(docRef, newDeadline);
                newDeadlinesWithIds.push(newDeadline);
            });
    
            await batch.commit();
            toast({
                title: "Importazione completata",
                description: `${newDeadlinesWithIds.length} scadenze sono state salvate nel database.`
            });
            return newDeadlinesWithIds;
    
        } catch (error: any) {
             console.error("Error importing deadlines: ", error);
             toast({ variant: 'destructive', title: 'Errore Importazione', description: `Impossibile salvare le scadenze importate. ${error.message}` });
             return []; // Return empty array on failure
        }
    };
    
    const handleSuggestDeadlines = async () => {
        if (!movimenti || movimenti.length === 0) {
            toast({ variant: 'destructive', title: 'Nessun Movimento', description: 'Non ci sono movimenti da analizzare.' });
            return;
        }
        setIsSuggestionLoading(true);
        try {
            const recentMovements = movimenti.slice(0, 50).map(m => ({ description: m.descrizione, amount: m.uscita }));
            const result = await suggestDeadlines({ movements: recentMovements });
            
            if (result.suggestions.length === 0) {
                 toast({ title: 'Nessun Suggerimento', description: 'L\'AI non ha trovato nuove scadenze potenziali dai movimenti recenti.' });
            } else {
                setDeadlineSuggestions(result.suggestions);
                setSelectedSuggestions(result.suggestions); // Pre-select all
                setIsSuggestionDialogOpen(true);
            }
        } catch (error) {
            console.error("Error suggesting deadlines:", error);
            toast({ variant: 'destructive', title: 'Errore AI', description: 'Impossibile ottenere suggerimenti.' });
        } finally {
            setIsSuggestionLoading(false);
        }
    };

    const handleCreateSuggestedDeadlines = async () => {
        if (!firestore || !user || selectedSuggestions.length === 0) return;
        setIsSuggestionLoading(true);
        try {
            const batch = writeBatch(firestore);
            selectedSuggestions.forEach(suggestion => {
                const newDeadlineRef = doc(collection(firestore, 'deadlines'));
                const newDeadline: Omit<Scadenza, 'id'> = {
                    societa: 'LNC', // Default or make selectable
                    anno: new Date().getFullYear(),
                    dataScadenza: new Date().toISOString(), // Placeholder, should be improved
                    descrizione: suggestion.description,
                    categoria: suggestion.category,
                    importoPrevisto: suggestion.amount,
                    importoPagato: 0,
                    stato: 'Da pagare',
                    ricorrenza: suggestion.recurrence,
                    createdBy: user.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                batch.set(newDeadlineRef, newDeadline);
            });
            await batch.commit();
            toast({ title: 'Scadenze Create', description: `${selectedSuggestions.length} nuove scadenze sono state aggiunte.` });
            setIsSuggestionDialogOpen(false);
            setDeadlineSuggestions([]);
            setSelectedSuggestions([]);
        } catch (error) {
            console.error("Error creating suggested deadlines:", error);
            toast({ variant: 'destructive', title: 'Errore Creazione', description: 'Impossibile creare le scadenze suggerite.' });
        } finally {
            setIsSuggestionLoading(false);
        }
    };


    const handleOpenDialog = (deadline?: Scadenza) => {
        setEditingDeadline(deadline || null);
        setIsDialogOpen(true);
    };
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredScadenze.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };
    
    const handleSelectSuggestion = (suggestion: DeadlineSuggestion, checked: boolean) => {
        if (checked) {
            setSelectedSuggestions(prev => [...prev, suggestion]);
        } else {
            setSelectedSuggestions(prev => prev.filter(s => s.originalMovementDescription !== suggestion.originalMovementDescription));
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(rowId => rowId !== id));
        }
    };
    
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const { 
        filteredScadenze,
        uniqueCategories,
        uniqueStatuses,
        uniqueRecurrences,
        riepilogo, 
        scadenzeMese, 
        scadenzeUrgenti, 
        scadenzeScadute 
    } = useMemo(() => {
        let data = scadenze || [];
        
        const categories = [...new Set(data.map(item => item.categoria))].sort();
        const statuses = [...new Set(data.map(item => item.stato))].sort();
        const recurrences = [...new Set(data.map(item => item.ricorrenza))].sort();
        
        let filtered = data
            .filter(s => selectedYear === 'Tutti' || s.anno === Number(selectedYear))
            .filter(s => selectedCategory === 'Tutti' || s.categoria === selectedCategory)
            .filter(s => selectedStatus === 'Tutti' || s.stato === selectedStatus)
            .filter(s => selectedRecurrence === 'Tutti' || s.ricorrenza === selectedRecurrence)
            .filter(s => s.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));
        
        filtered = filtered.sort((a, b) => {
                const dateA = new Date(a.dataScadenza).getTime();
                const dateB = new Date(b.dataScadenza).getTime();
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });

        const setteGiorni = new Date(oggi);
        setteGiorni.setDate(oggi.getDate() + 7);

        const scadenzeNelMese = filtered.filter(s => {
            const dataScadenza = new Date(s.dataScadenza);
            return dataScadenza.getMonth() === oggi.getMonth() && dataScadenza.getFullYear() === oggi.getFullYear() && s.stato !== 'Pagato';
        });

        const scadenzeUrg = filtered.filter(s => {
            const dataScadenza = new Date(s.dataScadenza);
            return dataScadenza >= oggi && dataScadenza <= setteGiorni && s.stato !== 'Pagato';
        });

        const scadenzeOverdue = filtered.filter(s => new Date(s.dataScadenza) < oggi && s.stato !== 'Pagato' && s.stato !== 'Annullato');

        const totalePrevisto = filtered.reduce((acc, s) => acc + s.importoPrevisto, 0);
        const totalePagato = filtered.reduce((acc, s) => acc + s.importoPagato, 0);
        const daPagare = totalePrevisto - totalePagato;
        const percentualeCompletamento = totalePrevisto > 0 ? (totalePagato / totalePrevisto) * 100 : 0;
        
        return {
            filteredScadenze: filtered,
            uniqueCategories: categories,
            uniqueStatuses: statuses,
            uniqueRecurrences: recurrences,
            riepilogo: { totalePrevisto, totalePagato, daPagare, percentualeCompletamento },
            scadenzeMese: {
                importo: scadenzeNelMese.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0),
                conteggio: scadenzeNelMese.length
            },
            scadenzeUrgenti: {
                importo: scadenzeUrg.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0),
                conteggio: scadenzeUrg.length
            },
            scadenzeScadute: {
                importo: scadenzeOverdue.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0),
                conteggio: scadenzeOverdue.length
            }
        };
    }, [scadenze, searchTerm, sortOrder, selectedYear, selectedCategory, selectedStatus, selectedRecurrence, oggi]);

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Scadenze';
        const companyName = companies?.find(c => c.sigla === selectedCompany)?.name || selectedCompany;
        return `Scadenze - ${companyName}`;
    };
    
    const canDelete = (scadenza: Scadenza) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        // Allow user to delete if they are the creator
        return user.uid === scadenza.createdBy;
    }

  return (
    <div className="flex flex-col gap-6">
      <AddDeadlineDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        onAddDeadline={handleAddDeadline}
        onEditDeadline={handleEditDeadline}
        deadlineToEdit={editingDeadline}
        defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany as 'LNC' | 'STG' : user?.company as 'LNC' | 'STG'}
        currentUser={user!}
      />

        <ImportDeadlinesDialog
            isOpen={isImportDialogOpen}
            setIsOpen={setIsImportDialogOpen}
            onImport={handleImportDeadlines}
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : undefined}
            currentUser={user}
            companies={companies || []}
            allDeadlines={scadenze || []}
        />
      
      <Dialog open={isSuggestionDialogOpen} onOpenChange={setIsSuggestionDialogOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Suggerimenti Scadenze dall'AI</DialogTitle>
                <DialogDescription>
                    L'AI ha analizzato i tuoi movimenti recenti e suggerisce di creare le seguenti scadenze ricorrenti. Seleziona quelle che vuoi aggiungere.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><Checkbox 
                                checked={selectedSuggestions.length === deadlineSuggestions.length && deadlineSuggestions.length > 0}
                                onCheckedChange={(checked) => setSelectedSuggestions(checked ? deadlineSuggestions : [])}
                            />
                            </TableHead>
                            <TableHead>Nuova Descrizione</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Ricorrenza</TableHead>
                            <TableHead className="text-right">Importo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {deadlineSuggestions.map((suggestion, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Checkbox 
                                        checked={selectedSuggestions.some(s => s.originalMovementDescription === suggestion.originalMovementDescription)}
                                        onCheckedChange={(checked) => handleSelectSuggestion(suggestion, checked as boolean)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{suggestion.description}</TableCell>
                                <TableCell><Badge variant="outline">{suggestion.category}</Badge></TableCell>
                                <TableCell>{suggestion.recurrence}</TableCell>
                                <TableCell className="text-right">{formatCurrency(suggestion.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsSuggestionDialogOpen(false)}>Annulla</Button>
                <Button onClick={handleCreateSuggestedDeadlines} disabled={isSuggestionLoading || selectedSuggestions.length === 0}>
                    {isSuggestionLoading ? <Loader2 className="animate-spin" /> : `Crea ${selectedSuggestions.length} Scadenze`}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!deadlineToDelete} onOpenChange={(open) => !open && setDeadlineToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione non può essere annullata. La scadenza &quot;{deadlineToDelete?.descrizione}&quot; del {deadlineToDelete && formatDate(deadlineToDelete.dataScadenza)} per un importo di {deadlineToDelete && formatCurrency(deadlineToDelete.importoPrevisto)} sarà eliminata permanentemente.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteDeadline} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setIsBulkDeleteAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei sicuro di voler eliminare?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Questa azione non può essere annullata. Verranno eliminate permanentemente {selectedIds.length} scadenze.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">Elimina Tutti</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
    ) : (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scadenze nel Mese</CardTitle>
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(scadenzeMese.importo)}</div>
                <p className="text-xs text-muted-foreground">{scadenzeMese.conteggio} scadenze questo mese</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scadenze Urgenti</CardTitle>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-orange-500">{formatCurrency(scadenzeUrgenti.importo)}</div>
                <p className="text-xs text-muted-foreground">{scadenzeUrgenti.conteggio} scadenze nei prossimi 7 giorni</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scadute</CardTitle>
                <History className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-500">{formatCurrency(scadenzeScadute.importo)}</div>
                <p className="text-xs text-muted-foreground">{scadenzeScadute.conteggio} scadenze non pagate</p>
            </CardContent>
        </Card>
        <Card>
             <CardHeader>
              <CardTitle className="text-sm font-medium">Riepilogo Generale</CardTitle>
          </CardHeader>
          <CardContent>
                <div className="space-y-2">
                    <div className="flex justify-between font-medium text-sm">
                        <span>% Pagato</span>
                        <span>{riepilogo.percentualeCompletamento.toFixed(0)}%</span>
                    </div>
                    <Progress value={riepilogo.percentualeCompletamento} />
                </div>
          </CardContent>
        </Card>
    </div>
    )}
    
    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        {user && (user.role === 'admin' || user.role === 'editor') && (
            <Select value={selectedCompany} onValueChange={(value) => setSelectedCompany(value as string)}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Società" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Tutte">Tutte le società</SelectItem>
                    {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
                </SelectContent>
            </Select>
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
             <Button variant="outline" onClick={handleSuggestDeadlines} disabled={isSuggestionLoading}>
                {isSuggestionLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Sparkles className="mr-2 h-4 w-4" />}
                Suggerisci Scadenze
            </Button>
            <Button onClick={() => handleOpenDialog()} className="flex-shrink-0" disabled={!user}>
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
            <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value)}>
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
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Tutti">Tutte le Categorie</SelectItem>
                    {uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
         <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Stato:</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stato" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Tutti">Tutti gli Stati</SelectItem>
                    {uniqueStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
         <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Ricorrenza:</label>
            <Select value={selectedRecurrence} onValueChange={setSelectedRecurrence}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Ricorrenza" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Tutti">Tutte le Ricorrenze</SelectItem>
                    {uniqueRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    </div>

    <Card>
        <CardHeader>
            <CardTitle>{getPageTitle()}</CardTitle>
            <CardDescription>
            Visualizza, aggiungi e gestisci le tue scadenze fiscali e pagamenti {selectedYear === 'Tutti' ? 'per tutti gli anni' : `per l'anno ${selectedYear}`}.
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
                                    checked={selectedIds.length > 0 && filteredScadenze.length > 0 && selectedIds.length === filteredScadenze.length}
                                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                    aria-label="Seleziona tutte le righe"
                                />
                            </TableHead>
                        )}
                        <TableHead>Società</TableHead>
                        <TableHead>
                            <Button variant="ghost" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                Data Scadenza
                                {sortOrder === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUp className="ml-2 h-4 w-4" />}
                            </Button>
                        </TableHead>
                        <TableHead>Data Pagamento</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Sottocategoria</TableHead>
                        <TableHead className="text-right">Importo Previsto</TableHead>
                        <TableHead className="text-right">Importo Pagato</TableHead>
                        <TableHead className="text-center">Stato</TableHead>
                        <TableHead>Ricorrenza</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={13} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                            </TableCell>
                        </TableRow>
                    ) : error ? (
                        <TableRow>
                            <TableCell colSpan={13} className="h-24 text-center text-red-500">
                                Errore nel caricamento: {error.message}
                            </TableCell>
                        </TableRow>
                    ) : filteredScadenze.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={13} className="h-24 text-center">Nessuna scadenza trovata.</TableCell>
                        </TableRow>
                    ) : (
                        filteredScadenze.map((scadenza) => {
                            const isSelected = selectedIds.includes(scadenza.id);
                            return (
                                <TableRow key={scadenza.id} data-state={isSelected ? "selected" : ""} className={cn(new Date(scadenza.dataScadenza) < oggi && scadenza.stato !== 'Pagato' && scadenza.stato !== 'Annullato' && 'bg-red-50 dark:bg-red-900/20')}>
                                    {user?.role === 'admin' && (
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => handleSelectRow(scadenza.id, checked as boolean)}
                                                aria-label="Seleziona riga"
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Badge variant={scadenza.societa === 'LNC' ? 'default' : 'secondary'}>{scadenza.societa}</Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">{formatDate(scadenza.dataScadenza)}</TableCell>
                                    <TableCell className="whitespace-nowrap">{scadenza.dataPagamento ? formatDate(scadenza.dataPagamento) : '-'}</TableCell>
                                    <TableCell>{scadenza.descrizione}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{scadenza.categoria}</Badge>
                                    </TableCell>
                                    <TableCell>{scadenza.sottocategoria}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(scadenza.importoPrevisto)}</TableCell>
                                    <TableCell className="text-right font-medium">{scadenza.importoPagato > 0 ? formatCurrency(scadenza.importoPagato) : '-'}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge
                                        className={cn({
                                            "bg-green-600 hover:bg-green-700 text-white": scadenza.stato === 'Pagato',
                                            "bg-red-600 hover:bg-red-700 text-white": scadenza.stato === 'Da pagare',
                                            "bg-yellow-500 hover:bg-yellow-600 text-white": scadenza.stato === 'Parziale',
                                            "bg-gray-500 hover:bg-gray-600 text-white": scadenza.stato === 'Annullato',
                                        })}
                                        >{scadenza.stato}</Badge>
                                    </TableCell>
                                    <TableCell>{scadenza.ricorrenza}</TableCell>
                                    <TableCell>{scadenza.note}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(scadenza)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {canDelete(scadenza) && (
                                                <Button variant="ghost" size="icon" onClick={() => setDeadlineToDelete(scadenza)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
                {filteredScadenze.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={user?.role === 'admin' ? 7 : 6} className="font-bold">TOTALI</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePrevisto)}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePagato)}</TableCell>
                            <TableCell colSpan={4}></TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
        </div>
        </CardContent>
    </Card>
    </div>
  );
}
