// src/components/scadenze/add-deadline-dialog.tsx
"use client";

import { useState, useEffect } from 'react';
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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Scadenza, AppUser } from '@/lib/types';
import { CATEGORIE_SCADENZE, RICORRENZE, STATI_SCADENZE } from '@/lib/constants';

const FormSchema = z.object({
  societa: z.enum(['LNC', 'STG'], { required_error: 'Seleziona una società' }),
  dataScadenza: z.date({ required_error: 'Seleziona una data' }),
  descrizione: z.string().min(3, 'La descrizione è obbligatoria'),
  importoPrevisto: z.coerce.number().positive('L\'importo deve essere positivo'),
  importoPagato: z.coerce.number().min(0).optional(),
  categoria: z.string().min(1, 'La categoria è obbligatoria'),
  ricorrenza: z.enum(['Nessuna', 'Mensile', 'Trimestrale', 'Semestrale', 'Annuale']),
  stato: z.enum(['Pagato', 'Da pagare', 'Parziale']),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddDeadlineDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onAddDeadline: (deadline: Omit<Scadenza, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onEditDeadline: (deadline: Scadenza) => Promise<void>;
  deadlineToEdit?: Scadenza | null;
  defaultCompany?: 'LNC' | 'STG';
  currentUser: AppUser;
}

export function AddDeadlineDialog({
  isOpen,
  setIsOpen,
  onAddDeadline,
  onEditDeadline,
  deadlineToEdit,
  defaultCompany,
  currentUser,
}: AddDeadlineDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!deadlineToEdit;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && deadlineToEdit) {
        form.reset({
          societa: deadlineToEdit.societa,
          dataScadenza: new Date(deadlineToEdit.dataScadenza),
          descrizione: deadlineToEdit.descrizione,
          importoPrevisto: deadlineToEdit.importoPrevisto,
          importoPagato: deadlineToEdit.importoPagato,
          categoria: deadlineToEdit.categoria,
          ricorrenza: deadlineToEdit.ricorrenza,
          stato: deadlineToEdit.stato,
          note: deadlineToEdit.note || '',
        });
      } else {
        form.reset({
          societa: defaultCompany,
          dataScadenza: new Date(),
          descrizione: '',
          importoPrevisto: 0,
          importoPagato: 0,
          categoria: '',
          ricorrenza: 'Nessuna',
          stato: 'Da pagare',
          note: '',
        });
      }
    }
  }, [isOpen, isEditMode, deadlineToEdit, defaultCompany, currentUser, form]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    const commonData = {
        ...data,
        dataScadenza: format(data.dataScadenza, 'yyyy-MM-dd'),
        anno: data.dataScadenza.getFullYear(),
        importoPagato: data.importoPagato || 0,
    };

    if (isEditMode && deadlineToEdit) {
      await onEditDeadline({ ...commonData, id: deadlineToEdit.id, createdBy: deadlineToEdit.createdBy });
    } else {
      await onAddDeadline(commonData);
    }
    setIsSubmitting(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Modifica Scadenza' : 'Aggiungi Nuova Scadenza'}</DialogTitle>
          <DialogDescription>
             Inserisci i dettagli per la scadenza fiscale o il pagamento.
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
                    name="dataScadenza"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Data Scadenza</FormLabel>
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
                    <FormControl>
                      <Textarea placeholder="Es: Saldo IMU, Acconto IRES, Rata mutuo..." {...field} />
                    </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="importoPrevisto"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Importo Previsto (€)</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {isEditMode && (
                  <FormField
                      control={form.control}
                      name="importoPagato"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Importo Pagato (€)</FormLabel>
                          <FormControl>
                              <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                  />
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            {CATEGORIE_SCADENZE.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="ricorrenza"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Ricorrenza</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {RICORRENZE.map(ric => <SelectItem key={ric} value={ric}>{ric}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            {isEditMode && (
              <FormField
                  control={form.control}
                  name="stato"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Stato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                          {STATI_SCADENZE.map(stato => <SelectItem key={stato} value={stato}>{stato}</SelectItem>)}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
              />
            )}

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
                {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salva Modifiche' : 'Salva Scadenza')}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
