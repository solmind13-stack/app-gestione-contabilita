// src/components/impostazioni/add-category-dialog.tsx
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const FormSchema = z.object({
  type: z.enum(['category', 'subcategory'], { required_error: 'Devi scegliere un tipo.' }),
  name: z.string().min(1, 'Il nome è obbligatorio.'),
  parentCategory: z.string().optional(),
}).refine(data => {
    if (data.type === 'subcategory' && !data.parentCategory) {
        return false;
    }
    return true;
}, {
    message: 'Devi selezionare una categoria genitore.',
    path: ['parentCategory'],
});

type FormValues = z.infer<typeof FormSchema>;

interface AddCategoryDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (type: 'category' | 'subcategory', name: string, parent?: string) => void;
  existingCategories: string[];
}

export function AddCategoryDialog({
  isOpen,
  setIsOpen,
  onSave,
  existingCategories
}: AddCategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      type: 'category',
      name: '',
    },
  });

  const watchedType = form.watch('type');

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    onSave(data.type, data.name, data.parentCategory);
    setIsSubmitting(false);
    setIsOpen(false);
    form.reset();
  };

   useEffect(() => {
    if (!isOpen) {
      form.reset({ type: 'category', name: '' });
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Categoria o Sottocategoria</DialogTitle>
          <DialogDescription>
            Espandi le tue opzioni di classificazione per i movimenti.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Cosa vuoi creare?</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                            >
                            <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                <RadioGroupItem value="category" />
                                </FormControl>
                                <FormLabel className="font-normal">Nuova Categoria</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                <RadioGroupItem value="subcategory" />
                                </FormControl>
                                <FormLabel className="font-normal">Nuova Sottocategoria</FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            {watchedType === 'subcategory' && (
                 <FormField
                    control={form.control}
                    name="parentCategory"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Categoria Genitore</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona la categoria..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {existingCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                        <Input {...field} placeholder={watchedType === 'category' ? 'Es: Consulenze' : 'Es: Avvocato'} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annulla</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Salva'}
            </Button>
            </DialogFooter>
        </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
