// src/components/previsioni/add-income-forecast-dialog.tsx
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
import type { PrevisioneEntrata, AppUser } from '@/lib/types';
import { CATEGORIE_ENTRATE, CERTEZZA_LIVELLI, STATI_ENTRATE, IVA_PERCENTAGES } from '@/lib/constants';

const FormSchema = z.object({
  societa: z.enum(['LNC', 'STG'], { required_error: 'Seleziona una società' }),
  dataPrevista: z.date({ required_error: 'Seleziona una data' }),
  descrizione: z.string().min(3, 'La descrizione è obbligatoria'),
  importoLordo: z.coerce.number().positive('L\'importo deve essere positivo'),
  importoEffettivo: z.coerce.number().min(0).optional(),
  categoria: z.string().min(1, 'La categoria è obbligatoria'),
  sottocategoria: z.string().min(1, 'La sottocategoria è obbligatoria'),
  iva: z.coerce.number().min(0).max(1),
  certezza: z.enum(['Certa', 'Probabile', 'Incerta']),
  probabilita: z.coerce.number().min(0).max(1),
  stato: z.enum(['Da incassare', 'Incassato', 'Parziale', 'Annullato']),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddIncomeForecastDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onAddForecast: (forecast: Omit<PrevisioneEntrata, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onEditForecast: (forecast: PrevisioneEntrata) => Promise<void>;
  forecastToEdit?: PrevisioneEntrata | null;
  defaultCompany?: 'LNC' | 'STG';
  currentUser: AppUser;
}

export function AddIncomeForecastDialog({
  isOpen,
  setIsOpen,
  onAddForecast,
  onEditForecast,
  forecastToEdit,
  defaultCompany,
  currentUser,
}: AddIncomeForecastDialogProps) {
  const isEditMode = !!forecastToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });
  
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && forecastToEdit) {
        form.reset({
          societa: forecastToEdit.societa,
          dataPrevista: new Date(forecastToEdit.dataPrevista),
          descrizione: forecastToEdit.descrizione,
          importoLordo: forecastToEdit.importoLordo,
          importoEffettivo: forecastToEdit.importoEffettivo || 0,
          categoria: forecastToEdit.categoria,
          sottocategoria: forecastToEdit.sottocategoria,
          iva: forecastToEdit.iva,
          certezza: forecastToEdit.certezza,
          probabilita: forecastToEdit.probabilita,
          stato: forecastToEdit.stato,
          note: forecastToEdit.note || '',
        });
      } else {
        const today = new Date();
        form.reset({
          societa: defaultCompany || 'LNC',
          dataPrevista: today,
          descrizione: '',
          importoLordo: 0,
          importoEffettivo: 0,
          categoria: '',
          sottocategoria: '',
          iva: 0.22,
          certezza: 'Probabile',
          probabilita: 0.9,
          stato: 'Da incassare',
          note: '',
        });
      }
    }
  }, [isOpen, isEditMode, forecastToEdit, defaultCompany, form, currentUser]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    const commonData = {
        ...data,
        mese: format(data.dataPrevista, 'MMMM', {locale: it}),
        dataPrevista: format(data.dataPrevista, 'yyyy-MM-dd'),
        anno: data.dataPrevista.getFullYear(),
        importoEffettivo: data.importoEffettivo || 0,
    };

    if (isEditMode && forecastToEdit) {
      await onEditForecast({ ...commonData, id: forecastToEdit.id });
    } else {
        await onAddForecast(commonData);
    }
    setIsSubmitting(false);
    setIsOpen(false);
  };
  
  const selectedCategory = form.watch('categoria');
  const watchedCertainty = form.watch('certezza');

  useEffect(() => {
    if (CERTEZZA_LIVELLI[watchedCertainty]) {
        form.setValue('probabilita', CERTEZZA_LIVELLI[watchedCertainty]);
    }
  }, [watchedCertainty, form]);


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Modifica Previsione Entrata' : 'Aggiungi Previsione Entrata'}</DialogTitle>
          <DialogDescription>
             Inserisci i dettagli per la previsione di entrata.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="societa" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Società</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={currentUser?.role === 'company-editor' || currentUser?.role === 'company'}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleziona società" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="LNC">LNC</SelectItem><SelectItem value="STG">STG</SelectItem></SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="dataPrevista" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Data Prevista</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: it }) : <span>Scegli una data</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                )} />
            </div>

            <FormField control={form.control} name="descrizione" render={({ field }) => (
                <FormItem><FormLabel>Descrizione</FormLabel><FormControl><Textarea placeholder="Es: Affitto, Fattura cliente..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="importoLordo" render={({ field }) => (
                    <FormItem><FormLabel>Importo Lordo (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {isEditMode && <FormField control={form.control} name="importoEffettivo" render={({ field }) => (
                    <FormItem><FormLabel>Importo Effettivo (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="categoria" render={({ field }) => (
                    <FormItem><FormLabel>Categoria</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger></FormControl><SelectContent>{Object.keys(CATEGORIE_ENTRATE).map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="sottocategoria" render={({ field }) => (
                    <FormItem><FormLabel>Sottocategoria</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedCategory}><FormControl><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger></FormControl><SelectContent>{selectedCategory && CATEGORIE_ENTRATE[selectedCategory as keyof typeof CATEGORIE_ENTRATE]?.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="iva" render={({ field }) => (
                    <FormItem><FormLabel>% IVA</FormLabel><Select onValueChange={(val) => field.onChange(parseFloat(val))} value={String(field.value)}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{IVA_PERCENTAGES.map(iva => <SelectItem key={iva.value} value={String(iva.value)}>{iva.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="certezza" render={({ field }) => (
                    <FormItem><FormLabel>Certezza</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{Object.keys(CERTEZZA_LIVELLI).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="probabilita" render={({ field }) => (
                    <FormItem><FormLabel>Probabilità (%)</FormLabel><FormControl><Input type="number" step="0.1" min="0" max="1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
             
            {isEditMode && <FormField control={form.control} name="stato" render={({ field }) => (
                <FormItem><FormLabel>Stato</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{STATI_ENTRATE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )} />}

            <FormField control={form.control} name="note" render={({ field }) => (
                <FormItem><FormLabel>Note</FormLabel><FormControl><Textarea placeholder="Aggiungi note..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annulla</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Salva Modifiche' : 'Salva Previsione')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
