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
import { Button } from '@/components/ui/button';
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
import { Loader2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { categorizeTransaction } from '@/ai/flows/categorize-transactions-with-ai-suggestions';
import { useToast } from '@/hooks/use-toast';
import type { Movimento, AppUser, LinkableItem, Scadenza, PrevisioneUscita, PrevisioneEntrata } from '@/lib/types';
import { it } from 'date-fns/locale';
import { CATEGORIE, IVA_PERCENTAGES, METODI_PAGAMENTO } from '@/lib/constants';
import { suggestMovementLink } from '@/ai/flows/suggest-movement-link-flow';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';


const FormSchema = z.object({
  societa: z.enum(['LNC', 'STG'], { required_error: 'Seleziona una società' }),
  data: z.string().min(1, 'Seleziona una data'),
  descrizione: z.string().min(3, 'La descrizione è obbligatoria'),
  importo: z.coerce.number().refine(val => val !== 0, 'L\'importo non può essere zero'),
  tipo: z.enum(['entrata', 'uscita']),
  categoria: z.string().min(1, 'La categoria è obbligatoria'),
  sottocategoria: z.string(),
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
  defaultCompany?: 'LNC' | 'STG';
  currentUser: AppUser;
  scadenze: Scadenza[];
  expenseForecasts: PrevisioneUscita[];
  incomeForecasts: PrevisioneEntrata[];
}

export function AddMovementDialog({
  isOpen,
  setIsOpen,
  onAddMovement,
  onEditMovement,
  movementToEdit,
  defaultCompany,
  currentUser,
  scadenze,
  expenseForecasts,
  incomeForecasts
}: AddMovementDialogProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [aiSuggestions, setAiSuggestions] = useState<LinkableItem[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | undefined>(undefined);
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  
  const isEditMode = !!movementToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

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
          linkedTo: movementToEdit.linkedTo || '',
        });
      } else {
        form.reset({
          societa: defaultCompany || 'LNC',
          data: format(new Date(), 'yyyy-MM-dd'),
          descrizione: '',
          importo: 0,
          tipo: 'uscita',
          categoria: '',
          sottocategoria: '',
          iva: 0.22,
          conto: '',
          operatore: '',
          metodoPag: '',
          note: '',
          linkedTo: '',
        });
      }
  }, [isOpen, isEditMode, movementToEdit, defaultCompany, form]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const watchedTipo = form.watch('tipo');

  const openItems = useMemo((): LinkableItem[] => {
    let items: LinkableItem[] = [];
    
    if (watchedTipo === 'uscita') {
        const openDeadlines = (scadenze || [])
            .filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato')
            .map(d => ({
                id: d.id,
                type: 'scadenze' as const,
                description: d.descrizione,
                date: d.dataScadenza,
                amount: d.importoPrevisto - d.importoPagato,
                societa: d.societa,
                status: d.stato,
            }));

        const openExpenseForecasts = (expenseForecasts || [])
            .filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato')
            .map(f => ({
                id: f.id,
                type: 'expenseForecasts' as const,
                description: f.descrizione,
                date: f.dataScadenza,
                amount: f.importoLordo - (f.importoEffettivo || 0),
                societa: f.societa,
                status: f.stato,
            }));
            
        items = [...openDeadlines, ...openExpenseForecasts];
    } else { // entrata
        items = (incomeForecasts || [])
            .filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato')
            .map(f => ({
                id: f.id,
                type: 'incomeForecasts' as const,
                description: f.descrizione,
                date: f.dataPrevista,
                amount: f.importoLordo - (f.importoEffettivo || 0),
                societa: f.societa,
                status: f.stato,
            }));
    }

    return items.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  }, [watchedTipo, scadenze, expenseForecasts, incomeForecasts]);


  const prepareAndSubmit = async (data: FormValues, linkedItemId?: string) => {
    setIsSubmitting(true);
    const dataToSave: Omit<Movimento, 'id'> = {
        societa: data.societa,
        data: data.data,
        anno: new Date(data.data).getFullYear(),
        descrizione: data.descrizione,
        categoria: data.categoria,
        sottocategoria: data.sottocategoria,
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
        await onEditMovement({ ...dataToSave, id: movementToEdit.id, createdBy: movementToEdit.createdBy });
    } else {
        await onAddMovement(dataToSave, linkedItemId);
    }
    setIsSubmitting(false);
    setIsOpen(false);
  }

  const onSubmit = async (data: FormValues) => {
    // If a manual link is selected, just submit.
    if (data.linkedTo) {
        await prepareAndSubmit(data, data.linkedTo);
        return;
    }

    setIsSubmitting(true);
    try {
        const { suggestions } = await suggestMovementLink({
            movement: {
                description: data.descrizione,
                amount: data.importo,
                type: data.tipo,
            },
            openItems: openItems,
        });

        if (suggestions && suggestions.length > 0) {
            setAiSuggestions(suggestions);
            setSelectedSuggestion(suggestions[0].id); // Pre-select the first one
            setShowSuggestionDialog(true);
        } else {
            // No suggestion, just save
            await prepareAndSubmit(data);
        }
    } catch (e) {
        toast({
            variant: "destructive",
            title: "Errore Suggerimento AI",
            description: "Impossibile ottenere suggerimenti. Il movimento sarà salvato senza collegamento."
        });
        await prepareAndSubmit(data); // Save without link on AI error
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSuggestionConfirm = async () => {
    setShowSuggestionDialog(false);
    const data = form.getValues();
    await prepareAndSubmit(data, selectedSuggestion);
  };
  
  const handleSuggestionDecline = async () => {
      setShowSuggestionDialog(false);
      const data = form.getValues();
      await prepareAndSubmit(data); // Save without any link
  };

  const handleAiCategorize = useCallback(async () => {
    const description = form.getValues('descrizione');
    if (!description || description.length < 5) {
      toast({ variant: 'destructive', title: 'Descrizione troppo breve', description: 'Inserisci una descrizione più dettagliata per usare l\'AI.' });
      return;
    }
    setIsCategorizing(true);
    try {
      const result = await categorizeTransaction({ description });
      form.setValue('categoria', result.category, { shouldValidate: true });
      form.setValue('sottocategoria', result.subcategory, { shouldValidate: true });
      form.setValue('iva', result.ivaPercentage, { shouldValidate: true });
      toast({ title: 'Categorizzazione AI completata!', description: 'Controlla i campi suggeriti.', className: 'bg-green-100 dark:bg-green-900' });
    } catch (error) {
      console.error("Error during AI categorization:", error);
      toast({ variant: 'destructive', title: 'Errore AI', description: 'Impossibile suggerire una categoria in questo momento.' });
    } finally {
      setIsCategorizing(false);
    }
  }, [form, toast]);
  
  const selectedCategory = form.watch('categoria');

  return (
    <>
    <AlertDialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
        <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
            <AlertDialogTitle>Suggerimento di Collegamento AI</AlertDialogTitle>
            <AlertDialogDescription>
                L'assistente AI ha trovato delle corrispondenze per questo movimento. Seleziona la voce corretta per collegarli o salva senza collegare.
            </AlertDialogDescription>
            </AlertDialogHeader>
            
            <Controller
                control={form.control}
                name="linkedTo"
                render={({ field }) => (
                <RadioGroup
                    value={selectedSuggestion}
                    onValueChange={setSelectedSuggestion}
                    className="max-h-[400px] overflow-y-auto"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell></TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Descrizione</TableCell>
                                <TableCell>Data</TableCell>
                                <TableCell className="text-right">Importo</TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {aiSuggestions.map((s) => (
                           <TableRow key={s.id}>
                               <TableCell><RadioGroupItem value={s.id} id={s.id} /></TableCell>
                               <TableCell><Badge variant="outline">{s.type === 'scadenze' ? 'Scadenza' : 'Previsione'}</Badge></TableCell>
                               <TableCell className="font-medium">{s.description}</TableCell>
                               <TableCell>{formatDate(s.date)}</TableCell>
                               <TableCell className="text-right">{formatCurrency(s.amount)}</TableCell>
                           </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </RadioGroup>
                )}
            />


            <AlertDialogFooter>
                <Button variant="outline" onClick={handleSuggestionDecline}>Salva senza Collegare</Button>
                <Button onClick={handleSuggestionConfirm}>Conferma e Salva</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>


    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={currentUser?.role === 'company'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleziona società" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        <SelectItem value="LNC">LNC</SelectItem>
                        <SelectItem value="STG">STG</SelectItem>
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
                    <FormLabel>Collega a Voce Esistente (Opzionale)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleziona per collegare il pagamento a una previsione/scadenza..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="none">Nessun collegamento</SelectItem>
                            {openItems.map(item => (
                                <SelectItem key={`${item.type}-${item.id}`} value={`${item.type}/${item.id}`}>
                                    {`(${item.societa}) ${item.description} - ${format(new Date(item.date), 'dd/MM/yy')} - €${item.amount.toFixed(2)}`}
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategory}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="nessuna">Nessuna</SelectItem>
                              {selectedCategory && CATEGORIE[selectedCategory as keyof typeof CATEGORIE]?.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
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
                        <Select onValueChange={(val) => field.onChange(parseFloat(val))} value={String(field.value)}>
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
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Conto</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Es: BAPR, Contanti..."/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
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
