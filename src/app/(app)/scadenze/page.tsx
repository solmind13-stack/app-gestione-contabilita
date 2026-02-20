// src/app/(app)/scadenze/page.tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, getDocs, doc, addDoc, updateDoc, query, where, CollectionReference, deleteDoc, DocumentData, runTransaction } from 'firebase/firestore';
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
import { PlusCircle, Upload, Search, ArrowUp, ArrowDown, Pencil, CalendarClock, AlertTriangle, History, Loader2, Sparkles, Trash2, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, parseDate } from '@/lib/utils';
import type { Scadenza, AppUser, Movimento, RecurringExpensePattern, CompanyProfile, DeadlineSuggestion } from '@/lib/types';
import { AddDeadlineDialog } from '@/components/scadenze/add-deadline-dialog';
import { useToast } from '@/hooks/use-toast';
import { YEARS } from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportDeadlinesDialog } from '@/components/scadenze/import-deadlines-dialog';
import { suggestFiscalDeadlines } from '@/ai/flows/suggest-fiscal-deadlines';
import { logDataChange } from '@/ai/flows/data-audit-trail';
import { getYear, subYears } from 'date-fns';


const getQuery = (firestore: any, user: AppUser | null, collectionName: string) => {
    if (!firestore || !user) return null;
    let q = collection(firestore, collectionName) as CollectionReference<DocumentData>;
    if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        return query(q, where('societa', '==', user.company));
    }
    return query(q);
}

export default function ScadenzePage() {
    const { toast } = useToast();
    const router = useRouter();
    const [selectedCompany, setSelectedCompany] = useState<string>('Tutte');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [editingDeadline, setEditingDeadline] = useState<Scadenza | null>(null);
    const [deadlineToDelete, setDeadlineToDelete] = useState<Scadenza | null>(null);
    const [isBulkDeleteAlertOpen, setIsBulkDeleteAlertOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // State for AI suggestions
    const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
    
    // Filters
    const [selectedYear, setSelectedYear] = useState<string>('Tutti');
    const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
    const [selectedStatus, setSelectedStatus] = useState<string>('Tutti');
    const [selectedRecurrence, setSelectedRecurrence] = useState<string>('Tutti');

    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const deadlinesQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user?.uid, user?.role, user?.company]);
    const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user?.uid, user?.role, user?.company]);
    const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const suggestionsQuery = useMemo(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'deadlineSuggestions'), where('status', '==', 'pending')) : null, [firestore, user?.uid]);
    
    const { data: scadenze, isLoading: isLoadingScadenze, error } = useCollection<Scadenza>(deadlinesQuery);
    const { data: movimenti, isLoading: isLoadingMovimenti } = useCollection<Movimento>(movimentiQuery);
    const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);
    const { data: suggestions, isLoading: isLoadingSuggestions } = useCollection<DeadlineSuggestion>(suggestionsQuery);

    const isLoading = isLoadingScadenze || isLoadingMovimenti || isUserLoading || isLoadingCompanies || isLoadingSuggestions;

    useEffect(() => {
        if (user?.role === 'company' || user?.role === 'company-editor') {
            setSelectedCompany(user.company!);
        }
    }, [user]);

    const handleAddDeadline = async (newDeadlineData: Omit<Scadenza, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Utente non autenticato o database non disponibile.' });
            return;
        }
        try {
            const docRef = await addDoc(collection(firestore, 'deadlines'), {
                ...newDeadlineData,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            logDataChange({
                societa: newDeadlineData.societa,
                userId: user.uid,
                collection: 'deadlines',
                documentId: docRef.id,
                action: 'create',
                previousData: null,
                newData: newDeadlineData,
                source: 'manual'
            });

            toast({ title: "Scadenza Aggiunta", description: "La nuova scadenza è stata salvata." });
        } catch (error) {
            console.error("Error adding deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Salvataggio', description: 'Impossibile salvare la scadenza. Riprova.' });
        }
    };

    const handleEditDeadline = async (updatedDeadline: Scadenza) => {
         if (!user || !firestore || !updatedDeadline.id) {
            toast({ variant: 'destructive', title: 'Errore', description: "Dati non validi per l'aggiornamento." });
            return;
        }
        try {
            const docRef = doc(firestore, 'deadlines', updatedDeadline.id);
            const originalSnap = await getDoc(docRef);
            const previousData = originalSnap.data();

            const { id, ...dataToUpdate } = updatedDeadline;
            await updateDoc(docRef, {
                ...dataToUpdate,
                createdBy: updatedDeadline.createdBy || user.uid,
                updatedAt: new Date().toISOString(),
            });

            logDataChange({
                societa: updatedDeadline.societa,
                userId: user.uid,
                collection: 'deadlines',
                documentId: updatedDeadline.id,
                action: 'update',
                previousData: previousData,
                newData: dataToUpdate,
                source: 'manual'
            });

            toast({ title: "Scadenza Aggiornata", description: "La scadenza è stata modificata." });
        } catch (error) {
             console.error("Error updating deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile modificare la scadenza. Riprova.' });
        }
    };

    const runDeleteTransaction = async (deadlineToDelete: Scadenza) => {
        if (!firestore) return;
        
        await runTransaction(firestore, async (transaction) => {
            const deadlineRef = doc(firestore, 'deadlines', deadlineToDelete.id);
            
            // Find all movements linked to this deadline
            const movementsRef = collection(firestore, 'movements');
            const q = query(movementsRef, where('linkedTo', '==', `deadlines/${deadlineToDelete.id}`));
            const linkedMovementsSnap = await getDocs(q);
    
            // Unlink all found movements
            linkedMovementsSnap.forEach(movementDoc => {
                transaction.update(movementDoc.ref, { linkedTo: null });
            });
            
            // Delete the deadline itself
            transaction.delete(deadlineRef);
        });
    }
    
    const handleDeleteDeadline = async () => {
        if (!deadlineToDelete || !user) return;
        try {
            const previousData = { ...deadlineToDelete };
            await runDeleteTransaction(deadlineToDelete);

            logDataChange({
                societa: previousData.societa,
                userId: user.uid,
                collection: 'deadlines',
                documentId: previousData.id,
                action: 'delete',
                previousData: previousData,
                newData: null,
                source: 'manual'
            });

            toast({ title: "Scadenza Eliminata", description: "La scadenza e i relativi collegamenti sono stati rimossi." });
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
        setIsBulkDeleteAlertOpen(false);
        setIsDeleting(true);
        toast({ title: 'Eliminazione in corso...', description: `Eliminazione di ${selectedIds.length} scadenze...` });
        
        let successCount = 0;
        let errorCount = 0;

        const deadlinesToDelete = (scadenze || []).filter(s => selectedIds.includes(s.id));

        for (const deadline of deadlinesToDelete) {
            try {
                const previousData = { ...deadline };
                await runDeleteTransaction(deadline);

                logDataChange({
                    societa: previousData.societa,
                    userId: user.uid,
                    collection: 'deadlines',
                    documentId: previousData.id,
                    action: 'delete',
                    previousData: previousData,
                    newData: null,
                    source: 'bulk_operation'
                });

                successCount++;
            } catch (error) {
                console.error(`Failed to delete deadline ${deadline.id}:`, error);
                errorCount++;
            }
        }
        
        if (errorCount > 0) {
            toast({ variant: 'destructive', title: 'Eliminazione Parziale', description: `${successCount} scadenze eliminate. ${errorCount} eliminazioni fallite.` });
        } else {
            toast({ title: "Eliminazione Completata", description: `${successCount} scadenze sono state eliminate.` });
        }
        
        setSelectedIds([]);
        setIsDeleting(false);
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

            newDeadlinesWithIds.forEach(dl => {
                logDataChange({
                    societa: dl.societa,
                    userId: user.uid,
                    collection: 'deadlines',
                    documentId: dl.id,
                    action: 'create',
                    previousData: null,
                    newData: dl,
                    source: 'import'
                });
            });

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

    const handleSuggestDeadlines = useCallback(async () => {
        if (!firestore || !user) return;
        setIsSuggestionLoading(true);
    
        const companiesToAnalyze = selectedCompany === 'Tutte' && companies
            ? companies.map(c => c.sigla)
            : [selectedCompany];
    
        if (companiesToAnalyze.length === 0 || !movimenti) {
            toast({ variant: 'destructive', title: 'Nessun Dato', description: 'Non ci sono società o movimenti da analizzare.' });
            setIsSuggestionLoading(false);
            return;
        }
    
        let totalSuggestionsCreated = 0;
        
        for (const company of companiesToAnalyze) {
            if (!company) continue;
            
            const twoYearsAgo = getYear(subYears(new Date(), 2));
            const movementsToAnalyze = (movimenti || []).filter(m => m.societa === company && m.anno >= twoYearsAgo && m.uscita > 0);
    
            if (movementsToAnalyze.length < 3) continue;
    
            const createGroupingKey = (desc: string): string => {
                const lowerDesc = desc.toLowerCase().trim();
                const primaryEntities = ['f24', 'imu', 'ires', 'irap', 'iva', 'inps', 'telecom', 'tim', 'enel', 'bapr', 'gse', 'eris', 'reggiani', 'h&s', 'spazio pedagogia'];
                
                for (const entity of primaryEntities) {
                    if (lowerDesc.includes(entity)) {
                         if (entity === 'f24') {
                            if (lowerDesc.includes('imu')) return 'f24 imu';
                            if (lowerDesc.includes('ires')) return 'f24 ires';
                            return 'f24';
                        }
                        return entity;
                    }
                }
            
                const noiseWords = ['pagamento', 'accredito', 'addebito', 'sdd', 'rata', 'canone', 'fattura', 'fatt', 'ft', 'rif', 'riferimento', 'n\.', 'num\.', 'del', 'al', 'su', 'e', 'di', 'a', 'vs', 'commissioni', 'bancarie', 'spese', 'recupero', 'imposta', 'bollo', 'su', 'estratto', 'conto', 'ren', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre', 'gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
                const noiseRegex = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'gi');
                let cleanedDesc = lowerDesc.replace(noiseRegex, '');
                cleanedDesc = cleanedDesc.replace(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\b\d{2,}\b)/g, '');
                cleanedDesc = cleanedDesc.replace(/[.,\-_/()]/g, ' ').trim();
                const significantWords = cleanedDesc.split(/\s+/).filter(w => w.length > 2);
                return significantWords.slice(0, 3).join(' ');
            };
    
            const groupedByDescription = movementsToAnalyze.reduce((acc, mov) => {
                const key = createGroupingKey(mov.descrizione);
                if (!key) return acc;
                if (!acc[key]) acc[key] = [];
                acc[key].push(mov);
                return acc;
            }, {} as Record<string, Movimento[]>);
    
            const finalCandidateGroups: Movimento[][] = [];
            
            Object.values(groupedByDescription).forEach(group => {
                if (group.length < 3) return;
            
                group.sort((a,b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());
                
                const sortedByAmount = [...group].sort((a, b) => a.uscita - b.uscita);
                let currentCluster: Movimento[] = [sortedByAmount[0]];
            
                for (let i = 1; i < sortedByAmount.length; i++) {
                    const currentMov = sortedByAmount[i];
                    const clusterAvg = currentCluster.reduce((sum, m) => sum + m.uscita, 0) / currentCluster.length;
                    const tolerance = 0.15; // 15%
            
                    if (clusterAvg > 0 && Math.abs(currentMov.uscita - clusterAvg) / clusterAvg <= tolerance) {
                        currentCluster.push(currentMov);
                    } else if (clusterAvg === 0 && currentMov.uscita === 0) {
                         currentCluster.push(currentMov);
                    } else {
                        if (currentCluster.length >= 3) finalCandidateGroups.push(currentCluster);
                        currentCluster = [currentMov];
                    }
                }
                if (currentCluster.length >= 3) finalCandidateGroups.push(currentCluster);
            });
            
            const filteredCandidates = finalCandidateGroups.filter(group => {
                if (group.length === 0) return false;

                const avgAmount = group.reduce((sum, m) => sum + m.uscita, 0) / group.length;

                // Check against existing future deadlines
                const hasExistingFutureDeadline = (scadenze || []).some(deadline => {
                    if (deadline.societa !== company) return false;
                    if (parseDate(deadline.dataScadenza) < new Date()) return false;
                    
                    const amountDifference = Math.abs(deadline.importoPrevisto - avgAmount);
                    const isAmountSimilar = (avgAmount > 0) ? (amountDifference / avgAmount) < 0.10 : false;
                    
                    const groupDescKey = createGroupingKey(group[0].descrizione);
                    const deadlineDescKey = createGroupingKey(deadline.descrizione);
                    
                    return isAmountSimilar && groupDescKey === deadlineDescKey;
                });
                
                return !hasExistingFutureDeadline;
            });
    
            if (filteredCandidates.length === 0) continue;
            
            const analysisPayload = filteredCandidates.map((group, index) => {
    
                const amounts = group.map(m => m.uscita);
                const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
                const stdDev = Math.sqrt(amounts.map(x => Math.pow(x - avgAmount, 2)).reduce((a, b) => a + b, 0) / amounts.length);
                const coefficientOfVariation = avgAmount === 0 ? 0 : stdDev / avgAmount;
                const amountType = coefficientOfVariation < 0.05 ? 'fixed' : 'variable';
    
                let ricorrenza: RecurringExpensePattern['ricorrenza'] = 'Altro';
                if (group.length > 1) {
                    let totalDays = 0;
                    for (let i = 1; i < group.length; i++) {
                        const date1 = parseDate(group[i - 1].data);
                        const date2 = parseDate(group[i].data);
                        totalDays += (date2.getTime() - date1.getTime()) / (1000 * 3600 * 60 * 24);
                    }
                    const avgDays = totalDays / (group.length - 1);
    
                    if (avgDays > 25 && avgDays < 35) ricorrenza = 'Mensile';
                    else if (avgDays > 55 && avgDays < 65) ricorrenza = 'Bimestrale';
                    else if (avgDays > 85 && avgDays < 95) ricorrenza = 'Trimestrale';
                    else if (avgDays > 115 && avgDays < 125) ricorrenza = 'Quadrimestrale';
                    else if (avgDays > 175 && avgDays < 185) ricorrenza = 'Semestrale';
                    else if (avgDays > 360 && avgDays < 370) ricorrenza = 'Annuale';
                }
    
                const daysOfMonth = group.map(m => parseDate(m.data).getDate());
                const giornoStimato = Math.round(daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length);
    
                const firstMonth = group.length > 0 ? parseDate(group[0].data).getMonth() + 1 : undefined;
    
                const categoryCounts = group.reduce((acc, mov) => {
                    const key = `${mov.categoria || 'Da categorizzare'}|||${mov.sottocategoria || 'Da categorizzare'}`;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
            
                const mostCommonCatSub = Object.keys(categoryCounts).length > 0 
                    ? Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b)
                    : 'Da categorizzare|||Da categorizzare';
            
                const [sourceCategory, sourceSubcategory] = mostCommonCatSub.split('|||');
    
                return {
                    id: index,
                    description: group[0].descrizione,
                    count: group.length,
                    avgAmount: avgAmount,
                    amountType: amountType,
                    ricorrenza: ricorrenza,
                    giornoStimato: giornoStimato,
                    primoMese: firstMonth,
                    sourceCategory: sourceCategory,
                    sourceSubcategory: sourceSubcategory,
                };
            });
    
            try {
                const result = await suggestFiscalDeadlines({
                    company: company,
                    analysisCandidates: JSON.stringify(analysisPayload),
                });
                
                if (result?.suggestions && result.suggestions.length > 0) {
                    const batch = writeBatch(firestore);
                    for (const suggestion of result.suggestions) {
                        const originalGroup = filteredCandidates[suggestion.sourceCandidateId];
                        if (!originalGroup) continue;
    
                        const newSuggestionRef = doc(collection(firestore, 'users', user.uid, 'deadlineSuggestions'));
                        const suggestionPayload: Omit<DeadlineSuggestion, 'id'> = {
                            ...(suggestion as Omit<RecurringExpensePattern, 'sourceCandidateId'>),
                            sourceMovementIds: originalGroup.map(m => m.id),
                            status: 'pending',
                            userId: user.uid,
                            createdAt: new Date().toISOString()
                        };
                        batch.set(newSuggestionRef, suggestionPayload);
                    }
                    await batch.commit();
                    totalSuggestionsCreated += result.suggestions.length;
                }
            } catch (error: any) {
                console.error(`Error suggesting deadlines for ${company}:`, error);
                toast({
                    variant: 'destructive',
                    title: `Errore Analisi per ${company}`,
                    description: 'Impossibile completare l\'analisi.'
                });
            }
        }
        
        setIsSuggestionLoading(false);
        if (totalSuggestionsCreated > 0) {
            toast({
                title: 'Analisi Completata',
                description: `${totalSuggestionsCreated} nuovi suggerimenti sono disponibili per la revisione.`
            });
            router.push('/scadenze/revisione');
        } else {
            toast({
                title: 'Nessun Nuovo Suggerimento',
                description: 'Nessuna nuova scadenza ricorrente è stata trovata in base ai filtri attuali.'
            });
        }
    }, [movimenti, scadenze, toast, selectedCompany, companies, firestore, user, router]);


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
        let data = (scadenze || []).filter(s => selectedCompany === 'Tutte' || s.societa === selectedCompany);
        
        const categories = [...new Set(data.map(item => item.categoria).filter(Boolean))].sort();
        const statuses = [...new Set(data.map(item => item.stato).filter(Boolean))].sort();
        const recurrences = [...new Set(data.map(item => item.ricorrenza).filter(Boolean))].sort();
        
        let filtered = data
            .filter(s => selectedYear === 'Tutti' || s.anno === Number(selectedYear))
            .filter(s => selectedCategory === 'Tutti' || s.categoria === selectedCategory)
            .filter(s => selectedStatus === 'Tutti' || s.stato === selectedStatus)
            .filter(s => selectedRecurrence === 'Tutti' || s.ricorrenza === selectedRecurrence)
            .filter(s => s.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));
        
        filtered = filtered.sort((a, b) => {
                const dateA = parseDate(a.dataScadenza).getTime();
                const dateB = parseDate(b.dataScadenza).getTime();
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });

        const setteGiorni = new Date(oggi);
        setteGiorni.setDate(oggi.getDate() + 7);

        const scadenzeNelMese = filtered.filter(s => {
            const dataScadenza = parseDate(s.dataScadenza);
            return dataScadenza.getMonth() === oggi.getMonth() && dataScadenza.getFullYear() === oggi.getFullYear() && s.stato !== 'Pagato';
        });

        const scadenzeUrg = filtered.filter(s => {
            const dataScadenza = parseDate(s.dataScadenza);
            return dataScadenza >= oggi && dataScadenza <= setteGiorni && s.stato !== 'Pagato';
        });

        const scadenzeOverdue = filtered.filter(s => parseDate(s.dataScadenza) < oggi && s.stato !== 'Pagato' && s.stato !== 'Annullato');

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
    }, [scadenze, searchTerm, sortOrder, selectedYear, selectedCategory, selectedStatus, selectedRecurrence, oggi, selectedCompany]);

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
        existingDeadlines={scadenze || []}
        companies={companies || []}
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
                        Questa azione non può essere annullata. Verranno eliminate permanentemente {selectedIds.length} scadenze, scollegando eventuali movimenti associati.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Elimina Tutti'}
                    </AlertDialogAction>
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
                 <Button variant="destructive" onClick={() => setIsBulkDeleteAlertOpen(true)} disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina ({selectedIds.length})
                </Button>
            )}
             <Button variant="outline" onClick={() => router.push('/scadenze/revisione')}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Revisiona Suggerimenti ({suggestions?.length || 0})
            </Button>
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
                Suggerisci
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
                        <TableHead>Metodo Pag.</TableHead>
                        <TableHead className="text-center">Stato</TableHead>
                        <TableHead>Ricorrenza</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={14} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                            </TableCell>
                        </TableRow>
                    ) : error ? (
                        <TableRow>
                            <TableCell colSpan={14} className="h-24 text-center text-red-500">
                                Errore nel caricamento: {error.message}
                            </TableCell>
                        </TableRow>
                    ) : filteredScadenze.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={14} className="h-24 text-center">Nessuna scadenza trovata.</TableCell>
                        </TableRow>
                    ) : (
                        filteredScadenze.map((scadenza) => {
                            const isSelected = selectedIds.includes(scadenza.id);
                            const linkedMovements = movimenti?.filter(m => m.linkedTo === `deadlines/${scadenza.id}`);
                            const paymentMethods = linkedMovements?.map(m => m.metodoPag).filter(Boolean).join(', ');
                            return (
                                <TableRow key={scadenza.id} data-state={isSelected ? "selected" : ""} className={cn(parseDate(scadenza.dataScadenza) < oggi && scadenza.stato !== 'Pagato' && scadenza.stato !== 'Annullato' && 'bg-red-50 dark:bg-red-900/20')}>
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
                                    <TableCell>{paymentMethods || '-'}</TableCell>
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
                            <TableCell />
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
