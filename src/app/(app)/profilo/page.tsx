// src/app/(app)/profilo/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const profileFormSchema = z.object({
  firstName: z.string().min(2, 'Il nome è obbligatorio.'),
  lastName: z.string().min(2, 'Il cognome è obbligatorio.'),
  email: z.string().email(),
  notificationPreferences: z.object({
    notifyOnNewMovement: z.boolean().default(false),
    notifyOnDeadline: z.boolean().default(false),
  }).optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfiloPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      notificationPreferences: {
        notifyOnNewMovement: false,
        notifyOnDeadline: false,
      }
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        notificationPreferences: user.notificationPreferences || {
            notifyOnNewMovement: false,
            notifyOnDeadline: false,
        }
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Utente non autenticato o servizio non disponibile.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`,
        notificationPreferences: data.notificationPreferences,
      });
      toast({
        title: 'Profilo Aggiornato',
        description: 'Le tue informazioni sono state salvate con successo.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile aggiornare il profilo. Riprova.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isUserLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-80" />
        <Card>
           <CardHeader>
             <Skeleton className="h-8 w-48" />
             <Skeleton className="h-4 w-72" />
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="space-y-2">
               <Skeleton className="h-4 w-24" />
               <Skeleton className="h-10 w-full" />
             </div>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Mio Profilo</h1>
      <p className="text-muted-foreground mb-8">
        Visualizza e aggiorna le tue informazioni personali e le preferenze.
      </p>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Dettagli Utente</CardTitle>
              <CardDescription>
                Queste informazioni saranno visibili agli altri amministratori.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    {...form.register('firstName')}
                    disabled={isSaving}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input
                    id="lastName"
                    {...form.register('lastName')}
                    disabled={isSaving}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  L'indirizzo email non può essere modificato.
                </p>
              </div>
               <div className="space-y-2">
                  <Label>Ruolo</Label>
                  <Input
                      value={user?.role}
                      disabled
                  />
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Preferenze di Notifica</CardTitle>
                <CardDescription>
                    Scegli quali notifiche ricevere via email. La funzionalità di invio è in sviluppo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="notificationPreferences.notifyOnNewMovement"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Nuovi Movimenti</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                   Ricevi un'email quando viene aggiunto un nuovo movimento.
                                </p>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="notificationPreferences.notifyOnDeadline"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Scadenze Imminenti</FormLabel>
                                 <p className="text-sm text-muted-foreground">
                                    Ricevi un promemoria per le scadenze in avvicinamento.
                                </p>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </CardContent>
          </Card>
          
          <div className="flex justify-start">
            <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                'Salva Modifiche'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
