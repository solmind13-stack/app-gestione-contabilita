// src/app/(app)/scadenze/revisione/page.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, doc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Loader2, Sparkles, Trash2, ChevronRight, Copy, Info, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, parseDate } from '@/lib/utils';
import type { DeadlineSuggestion, Movimento, Scadenza } from '@/lib/types';
import { format as formatFns } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function RevisioneSuggerimentiPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedSuggestions, setSelectedSuggestions] = useState<DeadlineSuggestion[]>([]);
    const [generationYear, setGenerationYear] = useState<number>(new Date().getFullYear());
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingItem, setConfirmingItem] = useState<{suggestion: DeadlineSuggestion, similar: Scadenza} | null>(null);
    const [isRejectAllAlertOpen, setIsRejectAllAlertOpen] = useState(false);


    const suggestionsQuery = useMemo(() => 
        firestore && user ? query(collection(firestore, 'users', user.uid, 'deadlineSuggestions'), where('status', '==', 'pending')) : null, 
    [firestore, user]);

    const allDeadlinesQuery = useMemo(() => firestore ? collection(firestore, 'deadlines') : null, [firestore]);
    const movimentiQuery = useMemo(() => firestore ? collection(firestore, 'movements') : null, [firestore]);

    const { data: suggestions, isLoading: isLoadingSuggestions } = useCollection<DeadlineSuggestion>(suggestionsQuery);
    const { data: allDeadlines, isLoading: isLoadingDeadlines } = useCollection<Scadenza>(allDeadlinesQuery);
    const { data: allMovements, isLoading: isLoadingMovements } = useCollection<Movimento>(movimentiQuery);

    const isLoading = isLoadingSuggestions || isUserLoading || isLoadingDeadlines || isLoadingMovements;

    useEffect(() => {
        if (suggestions) {
            setSelectedSuggestions(suggestions.filter(s => s.amountType === 'fixed'));
        }
    }, [suggestions]);

    const handleSelectSuggestion = (suggestion: DeadlineSuggestion, checked: boolean) => {
        setSelectedSuggestions(prev => 
            checked ? [...prev, suggestion] : prev.filter(s => s.id !== suggestion.id)
        );
    };

    const proceedWithCreation = useCallback(async (suggestionsToCreate: DeadlineSuggestion[]) => {
        if (!firestore || !user || suggestionsToCreate.length === 0) return;
        setIsCreating(true);

        try {
            const batch = writeBatch(firestore);
            let createdCount = 0;

            for (const pattern of suggestionsToCreate) {
                const getNextDate = (month: number, day: number) => new Date(generationYear, month, day);

                const createDeadline = (date: Date) => {
                    if (date.getFullYear() !== generationYear) return;
                    
                    const newDeadlineRef = doc(collection(firestore, 'deadlines'));
                    const newDeadline: Omit<Scadenza, 'id'> = {
                        societa: pattern.societa as 'LNC' | 'STG',
                        anno: date.getFullYear(),
                        dataScadenza: formatFns(date, 'yyyy-MM-dd'),
                        descrizione: `${pattern.descrizionePulita} - ${formatFns(date, 'MMMM yyyy', { locale: it })}`,
                        categoria: pattern.categoria,
                        sottocategoria: pattern.sottocategoria || '',
                        importoPrevisto: pattern.importoPrevisto,
                        importoPagato: 0,
                        stato: 'Da pagare',
                        ricorrenza: pattern.ricorrenza,
                        createdBy: user.uid,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        tipoTassa: pattern.tipoTassa || '',
                        periodoRiferimento: '',
                        source: 'ai-suggested',
                    };
                    batch.set(newDeadlineRef, newDeadline);
                    createdCount++;
                };

                const primoMese = (pattern.primoMese || new Date().getMonth() + 1) - 1;

                switch (pattern.ricorrenza) {
                    case 'Mensile':
                        for (let i = 0; i < 12; i++) createDeadline(getNextDate(i, pattern.giornoStimato));
                        break;
                    case 'Bimestrale':
                        for (let i = 0; i < 6; i++) createDeadline(getNextDate(primoMese + i * 2, pattern.giornoStimato));
                        break;
                    case 'Trimestrale':
                        for (let i = 0; i < 4; i++) createDeadline(getNextDate(primoMese + i * 3, pattern.giornoStimato));
                        break;
                    case 'Quadrimestrale':
                         for (let i = 0; i < 3; i++) createDeadline(getNextDate(primoMese + i * 4, pattern.giornoStimato));
                        break;
                    case 'Semestrale':
                        for (let i = 0; i < 2; i++) createDeadline(getNextDate(primoMese + i * 6, pattern.giornoStimato));
                        break;
                    case 'Annuale':
                        createDeadline(getNextDate(primoMese, pattern.giornoStimato));
                        break;
                }
                
                // Mark suggestion as accepted
                const suggestionRef = doc(firestore, 'users', user.uid, 'deadlineSuggestions', pattern.id);
                batch.update(suggestionRef, { status: 'accepted' });
            }

            await batch.commit();
            toast({ title: 'Scadenze Create!', description: `${createdCount} nuove scadenze sono state aggiunte per il ${generationYear}.` });
            setSelectedSuggestions([]);
            
        } catch (error) {
            console.error("Error creating suggested deadlines:", error);
            toast({ variant: 'destructive', title: 'Errore Creazione', description: 'Impossibile creare le scadenze suggerite.' });
        } finally {
            setIsCreating(false);
            setConfirmingItem(null);
        }
    }, [firestore, user, generationYear, toast]);


    const handleCreateSelected = useCallback(async () => {
        if (!selectedSuggestions.length) return;
        const existing = allDeadlines || [];

        const cleanDesc = (d: string) => d.toLowerCase().trim();

        // Find the first suggestion that might be a duplicate
        for(const suggestion of selectedSuggestions) {
            const similarDeadline = existing.find(e => 
                e.societa === suggestion.societa &&
                e.ricorrenza === suggestion.ricorrenza &&
                (cleanDesc(e.descrizione).includes(cleanDesc(suggestion.descrizionePulita)) || 
                 cleanDesc(suggestion.descrizionePulita).includes(cleanDesc(e.descrizione)))
            );

            if (similarDeadline) {
                setConfirmingItem({ suggestion, similar: similarDeadline });
                return; // Stop and ask for confirmation
            }
        }
        
        // If no potential duplicates found, create all
        await proceedWithCreation(selectedSuggestions);

    }, [selectedSuggestions, allDeadlines, proceedWithCreation]);

    const handleRejectSuggestion = async (suggestionId: string) => {
        if (!firestore || !user) return;
        const suggestionRef = doc(firestore, 'users', user.uid, 'deadlineSuggestions', suggestionId);
        try {
            await deleteDoc(suggestionRef);
            toast({ title: "Suggerimento Rimosso" });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile rimuovere il suggerimento.' });
        }
    };

    const handleRejectAll = async () => {
        if (!firestore || !user || !suggestions || suggestions.length === 0) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);
            suggestions.forEach(suggestion => {
                const suggestionRef = doc(firestore, 'users', user.uid, 'deadlineSuggestions', suggestion.id);
                batch.delete(suggestionRef);
            });
            await batch.commit();
            toast({ title: 'Tutti i suggerimenti sono stati rimossi.' });
        } catch (e) {
            console.error("Error rejecting all suggestions:", e);
            toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile rimuovere tutti i suggerimenti.' });
        } finally {
            setIsDeleting(false);
            setIsRejectAllAlertOpen(false);
        }
    };
    
    const handleReplicateExact = useCallback(async (suggestion: DeadlineSuggestion, sourceMovements: Movimento[]) => {
        if (!firestore || !user || sourceMovements.length === 0) return;
        setIsCreating(true);

        try {
            const batch = writeBatch(firestore);
            let createdCount = 0;

            for (const mov of sourceMovements) {
                const newDate = new Date(generationYear, parseDate(mov.data).getMonth(), parseDate(mov.data).getDate());
                const newDateString = formatFns(newDate, 'yyyy-MM-dd');

                const isDuplicate = (allDeadlines || []).some(d =>
                    d.societa === mov.societa &&
                    d.dataScadenza === newDateString &&
                    d.descrizione === mov.descrizione &&
                    d.importoPrevisto === mov.uscita
                );

                if (isDuplicate || newDate.getFullYear() !== generationYear) continue;

                const newDeadlineRef = doc(collection(firestore, 'deadlines'));
                const newDeadline: Omit<Scadenza, 'id'> = {
                    societa: mov.societa as 'LNC' | 'STG',
                    anno: newDate.getFullYear(),
                    dataScadenza: newDateString,
                    descrizione: mov.descrizione,
                    categoria: mov.categoria,
                    sottocategoria: mov.sottocategoria || '',
                    importoPrevisto: mov.uscita,
                    importoPagato: 0,
                    stato: 'Da pagare',
                    ricorrenza: 'Nessuna',
                    createdBy: user.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    source: 'ai-suggested',
                    note: `Replicato dal movimento originale del ${formatDate(mov.data)}`
                };
                batch.set(newDeadlineRef, newDeadline);
                createdCount++;
            }
            
            const suggestionRef = doc(firestore, 'users', user.uid, 'deadlineSuggestions', suggestion.id);
            batch.update(suggestionRef, { status: 'accepted' });

            await batch.commit();

            if (createdCount > 0) {
                toast({ title: 'Scadenze Replicate!', description: `${createdCount} nuove scadenze sono state create per il ${generationYear}.` });
            } else {
                 toast({ title: 'Nessuna Scadenza Creata', description: 'Le scadenze potrebbero essere già esistenti per l\'anno selezionato.', variant: 'default' });
            }

        } catch (error) {
            console.error("Error replicating exact deadlines:", error);
            toast({ variant: 'destructive', title: 'Errore Replica', description: 'Impossibile creare le scadenze.' });
        } finally {
            setIsCreating(false);
        }
    }, [firestore, user, generationYear, toast, allDeadlines]);

    return (
        <div className="space-y-6">
            <AlertDialog open={!!confirmingItem} onOpenChange={(open) => !open && setConfirmingItem(null)}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Potenziale Duplicato Trovato</AlertDialogTitle>
                        <AlertDialogDescription>
                            Stai per creare una serie per <span className="font-bold">"{confirmingItem?.suggestion.descrizionePulita}"</span>.
                            Esiste già una scadenza simile: <span className="font-bold">"{confirmingItem?.similar.descrizione}"</span> con la stessa ricorrenza.
                            <br/><br/>
                            Sei sicuro di voler procedere e creare comunque le nuove scadenze?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmingItem(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => proceedWithCreation(selectedSuggestions)}>
                            Crea Comunque
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isRejectAllAlertOpen} onOpenChange={setIsRejectAllAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro di voler cancellare tutto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione eliminerà permanentemente tutti i {suggestions?.length || 0} suggerimenti in attesa. Non potrai annullare questa operazione.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRejectAll} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : 'Elimina Tutto'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div>
                  <h1 className="text-3xl font-bold">Revisione Suggerimenti Scadenze</h1>
                  <p className="text-muted-foreground">
                    L'AI ha identificato questi pattern di spesa. Seleziona e crea le scadenze per l'anno desiderato.
                  </p>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                         <div className="flex items-center gap-4">
                            <Label htmlFor="generation-year">Genera scadenze per l'anno:</Label>
                            <Select value={String(generationYear)} onValueChange={(v) => setGenerationYear(Number(v))}>
                                <SelectTrigger className="w-[120px]" id="generation-year">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => router.back()}>Annulla</Button>
                            {(suggestions?.length || 0) > 0 &&
                                <Button variant="destructive" onClick={() => setIsRejectAllAlertOpen(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Cancella Tutti
                                </Button>
                            }
                            <Button onClick={handleCreateSelected} disabled={isCreating || selectedSuggestions.length === 0}>
                                {isCreating ? <Loader2 className="animate-spin mr-2"/> : <Check className="mr-2"/>}
                                Crea {selectedSuggestions.length} Serie Selezionate
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                 <CardContent>
                    <ScrollArea className="h-[60vh] p-1 pr-4">
                        <Accordion type="multiple" className="w-full space-y-4">
                             {isLoading ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin"/>
                                    <p className="ml-2">Caricamento suggerimenti...</p>
                                </div>
                            ) : suggestions && suggestions.length > 0 ? (
                                suggestions.map((pattern) => {
                                    const isSelected = selectedSuggestions.some(s => s.id === pattern.id);
                                    const isFixed = pattern.amountType === 'fixed';
                                    const sourceMovements = (allMovements || []).filter(m => pattern.sourceMovementIds.includes(m.id));

                                    return (
                                        <AccordionItem value={pattern.id} key={pattern.id} className="border-b-0">
                                            <Card className={cn("transition-all", isSelected && isFixed ? "border-primary" : "")}>
                                                <div className="p-4">
                                                    <div className="flex flex-row items-start gap-4">
                                                        <div className="flex flex-col gap-2 pt-1">
                                                            <Checkbox 
                                                                id={`pattern-${pattern.id}`}
                                                                checked={isSelected}
                                                                onCheckedChange={(checked) => handleSelectSuggestion(pattern, checked as boolean)}
                                                                disabled={!isFixed}
                                                            />
                                                                {!isFixed && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span tabIndex={0}><AlertTriangle className="h-5 w-5 text-amber-500"/></span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Importi variabili. Usa la replica esatta.</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                )}
                                                        </div>
                                                        <div className="flex-grow grid gap-1 text-left">
                                                            <Label htmlFor={`pattern-${pattern.id}`} className="font-bold text-base cursor-pointer">{pattern.descrizionePulita}</Label>
                                                            <p className="text-sm text-muted-foreground">{pattern.ragione}</p>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-1">
                                                                <span>Società: <Badge variant="secondary">{pattern.societa}</Badge></span>
                                                                <span>Importo Medio: <Badge variant="outline">{formatCurrency(pattern.importoPrevisto)}</Badge></span>
                                                                <span>Ricorrenza: <Badge variant="outline">{pattern.ricorrenza}</Badge></span>
                                                                {pattern.metodoPagamentoTipico && <span>Pagamento: <Badge variant="outline">{pattern.metodoPagamentoTipico}</Badge></span>}
                                                                <span>Cat: <Badge variant="outline">{pattern.categoria}</Badge></span>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="shrink-0 text-destructive self-center" onClick={() => handleRejectSuggestion(pattern.id)}>
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <AccordionTrigger className="!py-0 !px-4 !pb-4 !-mt-2 !font-normal !text-primary !justify-start !gap-1 hover:!no-underline">
                                                    <span className="hover:underline">Vedi i {sourceMovements.length} movimenti originali</span>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-6 pb-4">
                                                    <h4 className="text-sm font-semibold mb-2">Movimenti Originali Analizzati:</h4>
                                                    <ScrollArea className="h-40 border rounded-md">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Data</TableHead>
                                                                    <TableHead>Descrizione</TableHead>
                                                                    <TableHead className="text-right">Importo</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {sourceMovements.map(mov => (
                                                                    <TableRow key={mov.id}>
                                                                        <TableCell>{formatDate(mov.data)}</TableCell>
                                                                        <TableCell>{mov.descrizione}</TableCell>
                                                                        <TableCell className="text-right text-red-600">{formatCurrency(mov.uscita)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </ScrollArea>
                                                        <div className="mt-4 flex justify-end">
                                                        <Button variant="secondary" onClick={() => handleReplicateExact(pattern, sourceMovements)} disabled={isCreating}>
                                                                {isCreating ? <Loader2 className="animate-spin mr-2"/> : null}
                                                            Replica Esatta per il {generationYear}
                                                        </Button>
                                                    </div>
                                                </AccordionContent>
                                            </Card>
                                        </AccordionItem>
                                    )
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                                    <Info className="w-10 h-10 mb-4" />
                                    <p className="font-semibold">Nessun suggerimento da revisionare.</p>
                                    <p className="text-sm">Esegui una nuova analisi dalla pagina "Scadenze".</p>
                                </div>
                            )}
                        </Accordion>
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>
    );
}
