// src/components/impostazioni/edit-user-dialog.tsx
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
import type { AppUser, UserRole } from '@/lib/types';

const FormSchema = z.object({
  displayName: z.string().min(3, 'Il nome è obbligatorio'),
  role: z.enum(['admin', 'editor', 'company'], { required_error: 'Il ruolo è obbligatorio' }),
  company: z.enum(['LNC', 'STG']).optional(),
}).refine(data => {
    if(data.role === 'company' && !data.company) {
        return false;
    }
    return true;
}, {
    message: "La società è obbligatoria per il ruolo 'company'",
    path: ["company"],
});

type FormValues = z.infer<typeof FormSchema>;

interface EditUserDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  user: AppUser | null;
  onUpdateUser: (user: AppUser) => Promise<void>;
}

export function EditUserDialog({
  isOpen,
  setIsOpen,
  user,
  onUpdateUser,
}: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        role: user.role,
        company: user.company,
      });
    }
  }, [user, form]);
  
  const watchedRole = form.watch('role');

  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    
    const updatedUserData: AppUser = {
        ...user,
        displayName: data.displayName,
        role: data.role as UserRole,
        company: data.role === 'company' ? data.company : undefined,
    }

    await onUpdateUser(updatedUserData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifica Utente</DialogTitle>
          <DialogDescription>
            Aggiorna i dettagli e i permessi dell'utente.
          </DialogDescription>
        </DialogHeader>
        {user && (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                 <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nome Visualizzato</FormLabel>
                        <FormControl>
                            <Input {...field} />
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
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="company">Company</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                {watchedRole === 'company' && (
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
                                <SelectItem value="LNC">LNC</SelectItem>
                                <SelectItem value="STG">STG</SelectItem>
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
                    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Salva Modifiche'}
                </Button>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
