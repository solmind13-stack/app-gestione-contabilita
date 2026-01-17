// src/components/impostazioni/add-user-dialog.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { AppUser, UserRole, CompanyProfile } from '@/lib/types';

const FormSchema = z.object({
  firstName: z.string().min(2, 'Il nome è obbligatorio'),
  lastName: z.string().min(2, 'Il cognome è obbligatorio'),
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'La password deve essere di almeno 6 caratteri'),
  role: z.enum(['admin', 'editor', 'company', 'company-editor'], { required_error: 'Il ruolo è obbligatorio' }),
  company: z.string().optional(),
}).refine(data => {
    if((data.role === 'company' || data.role === 'company-editor') && !data.company) {
        return false;
    }
    return true;
}, {
    message: "La società è obbligatoria per questo ruolo",
    path: ["company"],
});

type FormValues = z.infer<typeof FormSchema>;

interface AddUserDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onAddUser: (data: FormValues) => Promise<any>;
  companies: CompanyProfile[];
}

export function AddUserDialog({
  isOpen,
  setIsOpen,
  onAddUser,
  companies
}: AddUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'company',
        company: companies[0]?.sigla || '',
    }
  });
  
  const watchedRole = form.watch('role');

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
        await onAddUser(data);
        setIsOpen(false);
        form.reset();
    } catch(error) {
      // Error is handled in the parent component via toast
      console.error("Add user failed", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuovo Utente</DialogTitle>
          <DialogDescription>
            Crea un nuovo utente e assegna ruolo e permessi.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
             <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Mario" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Cognome</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Rossi" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input type="email" {...field} placeholder="m.rossi@example.com"/>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />


            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Ruolo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleziona un ruolo" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="admin">Admin (Tutto)</SelectItem>
                            <SelectItem value="editor">Editor (Tutto, no utenti)</SelectItem>
                            <SelectItem value="company-editor">Company Editor (Modifica solo sua società)</SelectItem>
                            <SelectItem value="company">Company (Solo lettura sua società)</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />

            {(watchedRole === 'company' || watchedRole === 'company-editor') && (
                <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Società</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona una società" />
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
            )}

            <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annulla</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Crea Utente'}
            </Button>
            </DialogFooter>
        </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
