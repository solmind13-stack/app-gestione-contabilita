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
import { Loader2, KeyRound } from 'lucide-react';
import type { AppUser, UserRole } from '@/lib/types';
import { Separator } from '../ui/separator';

const FormSchema = z.object({
  firstName: z.string().min(2, 'Il nome è obbligatorio'),
  lastName: z.string().min(2, 'Il cognome è obbligatorio'),
  role: z.enum(['admin', 'editor', 'company', 'company-editor'], { required_error: 'Il ruolo è obbligatorio' }),
  company: z.enum(['LNC', 'STG']).optional(),
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

interface EditUserDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  user: AppUser | null;
  onUpdateUser: (user: AppUser) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

export function EditUserDialog({
  isOpen,
  setIsOpen,
  user,
  onUpdateUser,
  onResetPassword,
}: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
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
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`,
        role: data.role as UserRole,
        company: (data.role === 'company' || data.role === 'company-editor') ? data.company : undefined,
    }

    await onUpdateUser(updatedUserData);
    setIsSubmitting(false);
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setIsResetting(true);
    await onResetPassword(user.email);
    setIsResetting(false);
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
                
                 <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                                <Input {...field} />
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
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

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
                                <SelectItem value="LNC">LNC</SelectItem>
                                <SelectItem value="STG">STG</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                
                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Gestione Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Verrà inviata un'email all'utente per reimpostare la sua password.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetPassword}
                    disabled={isResetting}
                  >
                    {isResetting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    Invia Email di Reset Password
                  </Button>
                </div>


                <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annulla</Button>
                <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
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
