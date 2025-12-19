// src/components/movimenti/add-movement-dialog.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { categorizeTransaction } from '@/ai/flows/categorize-transactions-with-ai-suggestions';
import { useToast } from '@/hooks/use-toast';
import type { Movimento, AppUser } from '@/lib/types';
import { it } from 'date-fns/locale';
import { CATEGORIE, IVA_PERCENTAGES, METODI_PAGAMENTO } from '@/lib/constants';

const FormSchema = z.object({
  societa: z.enum(['LNC', 'STG'], { required_error: 'Seleziona una società' }),
  data: z.date({ required_error: 'Seleziona una data' }),
  descrizione: z.string().min(3, 'La descrizione è obbligatoria'),
  importo: z.coerce.number().refine(val => val !== 0, 'L\'importo non può essere zero'),
  tipo: z.enum(['entrata', 'uscita']),
  categoria: z.string().min(1, 'La categoria è obbligatoria'),
  sottocategoria: z.string().min(1, 'La sottocategoria è obbligatoria'),
  iva: z.coerce.number().min(0).max(1),
  conto: z.string().optional(),
  operatore: z.string().optional(),
  metodoPag: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddMovementDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onAddMovement: (movement: Omit<Movimento, 'id'>) => Promise<void>;
  onEditMovement: (movement: Movimento) => Promise<void>;
  movementToEdit?: Movimento | null;
  defaultCompany?: 'LNC' | 'STG';
  currentUser: AppUser;
}

export function AddMovementDialog({
  isOpen,
  setIsOpen,
  onAddMovement,
  onEditMovement,
  movementToEdit,
  defaultCompany,
  currentUser,
}: AddMovementDialogProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!movementToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && movementToEdit) {
        form.reset({
          societa: movementToEdit.societa,
          data: new Date(movementToEdit.data),
          descrizione: movementToEdit.descrizione,
          importo: movementToEdit.entrata > 0 ? movementToEdit.entrata : movementToEdit.uscita,
          tipo: movementToEdit.entrata > 0 ? 'entrata' : 'uscita',
          categoria: movementToEdit.categoria,
          sottocategoria: movementToEdit.sottocategoria,
          iva: movementToEdit.iva,
          conto: movementToEdit.conto || '',
          operatore: movementToEdit.operatore || currentUser?.displayName || '',
          metodoPag: movementToEdit.metodoPag || '',
          note: movementToEdit.note || '',
        });
      } else {
        form.reset({
          societa: defaultCompany,
          data: new Date(),
          descrizione: '',
          importo: 0,
          tipo: 'uscita',
          categoria: '',
          sottocategoria: '',
          iva: 0.22,
          conto: '',
          operatore: currentUser?.displayName || '',
          metodoPag: '',
          note: '',
        });
      }
    }
  }, [isOpen, isEditMode, movementToEdit, defaultCompany, currentUser, form]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    const dataToSave = {
        societa: data.societa,
        data: format(data.data, 'yyyy-MM-dd'),
        anno: data.data.getFullYear(),
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
    };

    if (isEditMode && movementToEdit) {
        await onEditMovement({ ...dataToSave, id: movementToEdit.id });
    } else {
        await onAddMovement(dataToSave);
    }
    setIsSubmitting(false);
    setIsOpen(false);
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
      if (result) {
        form.setValue('categoria', result.category, { shouldValidate: true });
        form.setValue('sottocategoria', result.subcategory, { shouldValidate: true });
        form.setValue('iva', result.ivaPercentage, { shouldValidate: true });
        toast({ title: 'Categorizzazione AI completata!', description: 'Controlla i campi suggeriti.', className: 'bg-green-100 dark:bg-green-900' });
      }
    } catch (error) {
      console.error("Error during AI categorization:", error);
      toast({ variant: 'destructive', title: 'Errore AI', description: 'Impossibile suggerire una categoria in questo momento.' });
    } finally {
      setIsCategorizing(false);
    }
  }, [form, toast]);
  
  const selectedCategory = form.watch('categoria');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Modifica Movimento' : 'Aggiungi Nuovo Movimento'}</DialogTitle>
          <DialogDescription>
             {isEditMode ? 'Modifica i dettagli della transazione.' : 'Inserisci i dettagli della transazione. Usa l\'assistente AI per una categorizzazione rapida.'}
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
                        <FormItem className="flex flex-col">
                        <FormLabel>Data Movimento</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP", { locale: it })
                                ) : (
                                    <span>Scegli una data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
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
                            {IVA_PERCENTAGES.map(iva => <SelectItem key={iva} value={String(iva)}>{iva * 100}%</SelectItem>)}
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
                        <FormLabel>Operatore</FormLabel>
                         <FormControl>
                            <Input {...field} disabled />
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
  );
}
