// src/components/movimenti/add-movement-dialog.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Wand2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Movimento, AppUser, LinkableItem, Scadenza, PrevisioneUscita, PrevisioneEntrata, CompanyProfile } from '@/lib/types';
import { it } from 'date-fns/locale';
import { CATEGORIE, IVA_PERCENTAGES, METODI_PAGAMENTO } from '@/lib/constants';
import { categorizeTransaction } from '@/ai/flows/categorize-transactions-with-ai-suggestions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { formatCurrency, formatDate, maskAccountNumber, parseDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { validateMovement } from '@/lib/data-validation';


const FormSchema = z.object({
  societa: z.string({ required_error: 'Seleziona una società' }),
  data: z.string().min(1, 'Seleziona una data'),
  descrizione: z.string().min(3, 'La descrizione è obbligatoria'),
  importo: z.coerce.number().refine(val => val !== 0, 'L\'importo non può essere zero'),
  tipo: z.enum(['entrata', 'uscita']),
  categoria: z.string().min(1, 'La categoria è obbligatoria'),
  sottocategoria: z.string().optional(),
  iva: z.coerce.number().min(0).max(1),
  conto: z.string().optional(),
  operatore: z.string().optional(),
  metodoPag: z.string().optional(),
  note: z.string().optional(),
  linkedTo: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddMovementDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onAddMovement: (movement: Omit<Movimento, 'id'>, linkedItemId?: string) => Promise<void>;
  onEditMovement: (movement: Movimento) => Promise<void>;
  movementToEdit?: Movimento | null;
  defaultCompany?: string;
  currentUser: AppUser;
  deadlines: Scadenza[];
  expenseForecasts: PrevisioneUscita[];
  incomeForecasts: PrevisioneEntrata[];
  companies: CompanyProfile[];
  existingMovements: Movimento[];
}

const getJaccardIndex = (str1: string, str2: string): number => {
    const noise = new Set(['e', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'col', 'coi', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'pagamento', 'fattura', 'accredito', 'addebito', 'sdd', 'rata', 'canone', 'ft', 'rif', 'n', 'num', 'vs']);
    const clean = (s: string) => s.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s{2,}/g," ").split(' ').filter(w => w.length > 2 && !noise.has(w));
    const set1 = new Set(clean(str1));
    const set2 = new Set(clean(str2));
    if (set1.size === 0 || set2.size === 0) return 0;
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
};

const calculateSimilarity = (item: LinkableItem, formValues: Partial<FormValues>): number => {
    const { societa, importo, descrizione, data: paymentDateStr } = formValues;

    if (!societa || !importo || importo === 0 || !descrizione || !paymentDateStr) return 0;

    // Company must match
    if (item.societa !== societa) {
        return -1;
    }

    let score = 0;
    const OVERDUE_BASE_SCORE = 1000;
    const FUTURE_BASE_SCORE = 500;

    // 1. Date Proximity and Priority
    try {
        const paymentDate = parseDate(paymentDateStr);
        const itemDate = parseDate(item.date);
        const diffDays = (paymentDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);

        if (diffDays >= 0) { // Overdue or on the same day
            // Higher score for more recent overdue items
            score += OVERDUE_BASE_SCORE - (diffDays / 30); // small penalty for being very old
        } else { // Future item
            const futureDiff = Math.abs(diffDays);
            if (futureDiff > 90) { // Penalize items too far in the future
                return 0;
            }
            score += FUTURE_BASE_SCORE - futureDiff;
        }
    } catch (e) {
        return 0; // Invalid date, no score
    }
    
    // 2. Amount Similarity (max 100 points)
    if (item.amount && importo) {
        const difference = Math.abs(item.amount - importo);
        if (difference < 0.02) { // Almost perfect match
            score += 100;
        } else if (importo < item.amount) { // Partial payment, less valuable
            score += Math.max(0, 50 - (difference / item.amount) * 100);
        } else { // Overpayment, also less valuable
             score += Math.max(0, 50 - (difference / item.amount) * 100);
        }
    }
    
    // 3. Description Similarity (max 50 points)
    const jaccardIndex = getJaccardIndex(descrizione, item.description);
    score += jaccardIndex * 50;

    return score;
};


export function AddMovementDialog({
  isOpen,
  setIsOpen,
  onAddMovement,
  onEditMovement,
  movementToEdit,
  defaultCompany,
  currentUser,
  deadlines,
  expenseForecasts,
  incomeForecasts,
  companies,
  existingMovements
}: AddMovementDialogProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [confirmationData, setConfirmationData] = useState<{ data: FormValues; match: LinkableItem } | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
  const isEditMode = !!movementToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });
  
  const isMatchOverdue = useMemo(() => {
    if (!confirmationData) return false;
    try {
        const paymentDate = parseDate(confirmationData.data.data!);
        const itemDate = parseDate(confirmationData.match.date);
        // An item is overdue if its due date is before the payment date.
        return itemDate.getTime() < paymentDate.getTime();
    } catch {
        return false;
    }
  }, [confirmationData]);


  const resetForm = useCallback(() => {
     if (isEditMode && movementToEdit) {
        form.reset({
          societa: movementToEdit.societa,
          data: format(new Date(movementToEdit.data), 'yyyy-MM-dd'),
          descrizione: movementToEdit.descrizione,
          importo: movementToEdit.entrata > 0 ? movementToEdit.entrata : movementToEdit.uscita,
          tipo: movementToEdit.entrata > 0 ? 'entrata' : 'uscita',
          categoria: movementToEdit.categoria,
          sottocategoria: movementToEdit.sottocategoria || '',
          iva: movementToEdit.iva,
          conto: movementToEdit.conto || '',
          operatore: movementToEdit.operatore || '',
          metodoPag: movementToEdit.metodoPag || '',
          note: movementToEdit.note || '',
          linkedTo: movementToEdit.linkedTo || 'nessuno',
        });
      } else {
        form.reset({
          societa: defaultCompany,
          data: format(new Date(), 'yyyy-MM-dd'),
          descrizione: '',
          importo: 0,
          tipo: 'uscita',
          categoria: 'Da categorizzare',
          sottocategoria: 'Da categorizzare',
          iva: 0.22,
          conto: '',
          operatore: '',
          metodoPag: '',
          note: '',
          linkedTo: 'nessuno',
        });
      }
  }, [isEditMode, movementToEdit, defaultCompany, form]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmationData(null);
      setValidationWarnings([]);
    }
  }, [isOpen]);
  
  const watchedSocieta = form.watch('societa');
  const watchedTipo = form.watch('tipo');
  const watchedImporto = form.watch('importo');
  const watchedDescrizione = form.watch('descrizione');
  const watchedCategoria = form.watch('categoria');
  const watchedSottocategoria = form.watch('sottocategoria');
  const watchedData = form.watch('data');

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'societa' && type === 'change') {
        const selectedCompany = companies.find(c => c.sigla === value.societa);
        const accounts = selectedCompany?.conti || [];
        if (accounts.length === 1) {
          form.setValue('conto', accounts[0], { shouldValidate: true });
        } else {
          form.setValue('conto', '', { shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, companies]);


  const openItems = useMemo((): LinkableItem[] => {
    let items: LinkableItem[] = [];
    
    if (watchedTipo === 'uscita') {
        const openDeadlines = (deadlines || [])
            .filter(d => (d.stato !== 'Pagato' && d.stato !== 'Annullato') && (d.societa === watchedSocieta))
            .map(d => ({
                id: d.id,
                type: 'deadlines' as const,
                description: d.descrizione,
                date: d.dataScadenza,
                amount: d.importoPrevisto - d.importoPagato,
                societa: d.societa,
                category: d.categoria,
                subcategory: d.sottocategoria || '',
            }));

        const openExpenseForecasts = (expenseForecasts || [])
            .filter(f => (f.stato !== 'Pagato' && f.stato !== 'Annullato') && (f.societa === watchedSocieta))
            .map(f => ({
                id: f.id,
                type: 'expenseForecasts' as const,
                description: f.descrizione,
                date: f.dataScadenza,
                amount: f.importoLordo - (f.importoEffettivo || 0),
                societa: f.societa,
                category: f.categoria,
                subcategory: f.sottocategoria,
            }));
            
        items = [...openDeadlines, ...openExpenseForecasts];
    } else { // entrata
        items = (incomeForecasts || [])
            .filter(f => (f.stato !== 'Incassato' && f.stato !== 'Annullato') && (f.societa === watchedSocieta))
            .map(f => ({
                id: f.id,
                type: 'incomeForecasts' as const,
                description: f.descrizione,
                date: f.dataPrevista,
                amount: f.importoLordo - (f.importoEffettivo || 0),
                societa: f.societa,
                category: f.categoria,
                subcategory: f.sottocategoria,
            }));
    }

    const formValuesForSimilarity: Partial<FormValues> = {
        societa: watchedSocieta,
        importo: watchedImporto,
        descrizione: watchedDescrizione,
        categoria: watchedCategoria,
        sottocategoria: watchedSottocategoria,
        data: watchedData
    };
    
    // Calculate scores and sort
    const scoredItems = items
        .map(item => ({ item, score: calculateSimilarity(item, formValuesForSimilarity) }))
        .filter(scored => scored.score >= 0) // Filter out items from wrong company
        .sort((a, b) => {
            // Primary sort: by score, descending
            if (a.score > b.score) return -1;
            if (a.score < b.score) return 1;

            // Secondary sort (tie-breaker): by date, ascending (oldest first)
            try {
                const dateA = parseDate(a.item.date).getTime();
                const dateB = parseDate(b.item.date).getTime();
                return dateA - dateB;
            } catch (e) {
                return 0; // Don't sort by date if parsing fails
            }
        });

    return scoredItems.map(si => si.item);

  }, [watchedTipo, watchedSocieta, watchedImporto, watchedDescrizione, watchedCategoria, watchedSottocategoria, watchedData, deadlines, expenseForecasts, incomeForecasts]);

    // Effect to pre-select the best match
    useEffect(() => {
        if (isEditMode) return; // Don't auto-select in edit mode

        if (openItems.length > 0) {
            const bestMatch = openItems[0];
            const formValuesForSimilarity = {
                societa: watchedSocieta,
                importo: watchedImporto,
                descrizione: watchedDescrizione,
                categoria: watchedCategoria,
                sottocategoria: watchedSottocategoria,
                data: watchedData
            };
            const bestScore = calculateSimilarity(bestMatch, formValuesForSimilarity);
            
            // Set a threshold for auto-selection to avoid weak matches
            if (bestScore > 80) { 
                form.setValue('linkedTo', `${bestMatch.type}/${bestMatch.id}`);
            } else {
                 form.setValue('linkedTo', 'nessuno');
            }
        } else {
             form.setValue('linkedTo', 'nessuno');
        }
    }, [watchedSocieta, watchedImporto, watchedDescrizione, watchedCategoria, watchedSottocategoria, watchedData, openItems, form, isEditMode]);

    // Effect to set IVA to 0 for "Tasse" category
    useEffect(() => {
        if (watchedCategoria === 'Tasse') {
            form.setValue('iva', 0);
        }
    }, [watchedCategoria, form]);

  const proceedWithSave = async (data: FormValues, linkConfirmed: boolean) => {
    setConfirmationData(null);
    setValidationWarnings([]);
    setIsSubmitting(true);

    let finalLinkedTo = data.linkedTo;
    if (linkConfirmed && confirmationData) {
        finalLinkedTo = `${confirmationData.match.type}/${confirmationData.match.id}`;
    }
    const linkedItemId = finalLinkedTo === 'nessuno' ? undefined : finalLinkedTo;

    const dataToSave: Omit<Movimento, 'id'> = {
        societa: data.societa,
        data: data.data,
        anno: new Date(data.data).getFullYear(),
        descrizione: data.descrizione,
        categoria: data.categoria,
        sottocategoria: data.sottocategoria || '',
        entrata: data.tipo === 'entrata' ? data.importo : 0,
        uscita: data.tipo === 'uscita' ? data.importo : 0,
        iva: data.iva,
        conto: data.conto || '',
        operatore: data.operatore || '',
        metodoPag: data.metodoPag || '',
        note: data.note || '',
        linkedTo: linkedItemId,
    };

    if (isEditMode && movementToEdit) {
        const newStatus = movementToEdit.status === 'manual_review' && data.categoria !== 'Da categorizzare' ? 'ok' : movementToEdit.status;
        await onEditMovement({ ...dataToSave, id: movementToEdit.id, createdBy: movementToEdit.createdBy, status: newStatus });
    } else {
        await onAddMovement(dataToSave, linkedItemId);
    }
    setIsSubmitting(false);
    setIsOpen(false);
  }


  const onSubmit = async (data: FormValues) => {
    // 1. Validation
    const validation = validateMovement(
        { 
            ...data, 
            entrata: data.tipo === 'entrata' ? data.importo : 0, 
            uscita: data.tipo === 'uscita' ? data.importo : 0,
            id: movementToEdit?.id
        }, 
        existingMovements, 
        companies
    );

    if (!validation.isValid) {
        toast({ variant: 'destructive', title: 'Errore di Validazione', description: validation.errors.join('\n') });
        return;
    }

    if (validation.warnings.length > 0 && validationWarnings.length === 0) {
        setValidationWarnings(validation.warnings);
        return; // Wait for user to read warnings
    }

    // 2. Linking logic
    const SIMILARITY_THRESHOLD = 500;
    const userHasLinked = data.linkedTo && data.linkedTo !== 'nessuno';

    if (userHasLinked) {
        await proceedWithSave(data, false);
        return;
    }

    const formValuesForSimilarity = {
        societa: data.societa,
        importo: data.importo,
        descrizione: data.descrizione,
        categoria: data.categoria,
        sottocategoria: data.sottocategoria,
        data: data.data
    };
    
    const scoredItems = openItems
        .map(item => ({ item, score: calculateSimilarity(item, formValuesForSimilarity) }))
        .sort((a, b) => b.score - a.score);

    const bestMatch = scoredItems.length > 0 ? scoredItems[0] : null;

    if (bestMatch && bestMatch.score > SIMILARITY_THRESHOLD) {
        setConfirmationData({ data, match: bestMatch.item });
    } else {
        await proceedWithSave(data, false);
    }
  }

  const handleAiCategorize = useCallback(async () => {
    const description = form.getValues('descrizione');
    if (!description || description.length < 5) {
      toast({ variant: 'destructive', title: 'Descrizione troppo breve', description: 'Inserisci una descrizione più dettagliata per usare l\'AI.' });
      return;
    }
    setIsCategorizing(true);
    try {
      const result = await categorizeTransaction({ description });
      if (result) {
          form.setValue('categoria', result.category, { shouldValidate: true });
          form.setValue('sottocategoria', result.subcategory, { shouldValidate: true });
          form.setValue('iva', result.ivaPercentage, { shouldValidate: true });
          toast({ title: 'Categorizzazione AI completata!', description: 'Controlla i campi suggeriti.', className: 'bg-green-100 dark:bg-green-900' });
      }
    } catch (error: any) {
      console.error("Error during AI categorization:", error);
      toast({ variant: 'destructive', title: 'Errore AI', description: error.message || 'Impossibile suggerire una categoria in questo momento.' });
    } finally {
      setIsCategorizing(false);
    }
  }, [form, toast]);
  

  return (
    <>
      <AlertDialog open={validationWarnings.length > 0} onOpenChange={(open) => !open && setValidationWarnings([])}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" />
                    Avviso di Validazione
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                    <div className="space-y-2">
                        <p>L'analisi dei dati ha rilevato le seguenti anomalie:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            {validationWarnings.map((w, i) => <li key={i} className="text-amber-700 font-medium">{w}</li>)}
                        </ul>
                        <p className="pt-2 font-bold">Vuoi procedere comunque con il salvataggio?</p>
                    </div>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setValidationWarnings([])}>Correggi i Dati</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    setValidationWarnings([]);
                    onSubmit(form.getValues());
                }}>Procedi Comunque</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmationData} onOpenChange={() => setConfirmationData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
             <AlertDialogTitle className={cn(isMatchOverdue && "text-amber-600 dark:text-amber-500", "flex items-center gap-2")}>
                {isMatchOverdue && <AlertTriangle className="h-5 w-5" />}
                {isMatchOverdue ? "Attenzione: Trovata Scadenza Pregressa" : "Trovata Corrispondenza"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
                <div>
                     <p>
                        {isMatchOverdue 
                            ? "Il movimento che stai inserendo sembra corrispondere a una scadenza già passata. È fortemente raccomandato collegarli per mantenere la contabilità corretta."
                            : "Il movimento che stai salvando sembra corrispondere a una voce esistente. Vuoi collegarli?"
                        }
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="border p-3 rounded-lg space-y-1">
                        <h4 className="font-bold mb-1">Movimento</h4>
                        <p className="line-clamp-2"><strong>Desc:</strong> {confirmationData?.data.descrizione}</p>
                        <p><strong>Importo:</strong> {formatCurrency(confirmationData?.data.importo || 0)}</p>
                        <p><strong>Data:</strong> {confirmationData?.data.data ? formatDate(confirmationData.data.data) : '-'}</p>
                    </div>
                    <div className="border p-3 rounded-lg bg-muted/50 space-y-1">
                        <h4 className="font-bold mb-1">Corrispondenza Suggerita</h4>
                        <p className="line-clamp-2"><strong>Desc:</strong> {confirmationData?.match.description}</p>
                        <p><strong>Importo:</strong> {formatCurrency(confirmationData?.match.amount || 0)}</p>
                        <p><strong>Data:</strong> {confirmationData?.match.date ? formatDate(confirmationData.match.date) : '-'}</p>
                    </div>
                    </div>
                </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => proceedWithSave(confirmationData!.data, false)} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Salva Senza Collegare'}
            </Button>
            <Button onClick={() => proceedWithSave(confirmationData!.data, true)} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'Collega e Salva'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    <Dialog open={isOpen && !confirmationData && validationWarnings.length === 0} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Modifica Movimento' : 'Aggiungi Nuovo Movimento'}</DialogTitle>
          <DialogDescription>
             {isEditMode ? 'Modifica i dettagli della transazione.' : 'Inserisci i dettagli della transazione. Puoi collegare questo movimento a una scadenza o previsione esistente.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="societa"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Società</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={currentUser?.role === 'company' || currentUser.role === 'company-editor'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleziona società" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                    control={form.control}
                    name="data"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Data Movimento</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="descrizione"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Textarea placeholder="Es: Pagamento fattura fornitore, Affitto ufficio..." {...field} />
                    </FormControl>
                    <Button type="button" size="icon" variant="outline" onClick={handleAiCategorize} disabled={isCategorizing} aria-label="Categorizzazione AI">
                      {isCategorizing ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="importo"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Importo Lordo (€)</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Tipo Movimento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="uscita">Uscita</SelectItem>
                            <SelectItem value="entrata">Entrata</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

             <FormField
                control={form.control}
                name="linkedTo"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>
                        Collega a Voce Esistente (Opzionale)
                        {field.value && field.value !== 'nessuno' && openItems.some(i => `${i.type}/${i.id}` === field.value) && (
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">Suggerimento</Badge>
                        )}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleziona per collegare il pagamento a una previsione/scadenza..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="nessuno">Nessun collegamento</SelectItem>
                            {openItems.map(item => (
                                <SelectItem key={`${item.type}/${item.id}`} value={`${item.type}/${item.id}`}>
                                    {`(${item.type === 'deadlines' ? 'Scad.' : 'Prev.'}) ${item.description} - ${format(new Date(item.date), 'dd/MM/yy')} - €${item.amount.toFixed(2)}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {Object.keys(CATEGORIE).map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="sottocategoria"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Sottocategoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={!watchedCategoria}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="nessuna">Nessuna</SelectItem>
                              {watchedCategoria && CATEGORIE[watchedCategoria as keyof typeof CATEGORIE]?.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="iva"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>% IVA</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseFloat(val))} value={String(field.value)} disabled={watchedCategoria === 'Tasse'}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {IVA_PERCENTAGES.map(iva => <SelectItem key={iva.value} value={String(iva.value)}>{iva.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField
                    control={form.control}
                    name="operatore"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Pagato da (Operatore)</FormLabel>
                         <FormControl>
                            <Input {...field} placeholder="Es: Mario Rossi" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="metodoPag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metodo Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {METODI_PAGAMENTO.map(metodo => (
                            <SelectItem key={metodo} value={metodo}>{metodo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="conto"
                    render={({ field }) => {
                        const selectedCompany = companies.find(c => c.sigla === watchedSocieta);
                        const accounts = selectedCompany?.conti || [];

                        return (
                            <FormItem>
                                <FormLabel>Conto</FormLabel>
                                <FormControl>
                                    {accounts.length > 1 ? (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!watchedSocieta}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleziona un conto..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map(acc => (
                                                    <SelectItem key={acc} value={acc}>{maskAccountNumber(acc)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            {...field}
                                            value={accounts.length === 1 ? maskAccountNumber(field.value) : field.value}
                                            placeholder="Es: BAPR, Contanti..."
                                            disabled={accounts.length === 1}
                                        />
                                    )}
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Aggiungi note..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annulla</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : isEditMode ? 'Salva Modifiche' : 'Salva Movimento'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
