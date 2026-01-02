// src/app/(app)/impostazioni/preferenze/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTheme } from 'next-themes';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Moon, Sun, Laptop, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';

const preferencesFormSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  notificationPreferences: z.object({
    notifyOnNewMovement: z.boolean().default(false),
    notifyOnDeadline: z.boolean().default(false),
  }),
});

type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

export default function PreferenzePage() {
  const { theme, setTheme } = useTheme();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      theme: 'system',
      notificationPreferences: {
        notifyOnNewMovement: false,
        notifyOnDeadline: false,
      },
    },
  });

  useEffect(() => {
    if (theme) {
      form.setValue('theme', theme as 'light' | 'dark' | 'system');
    }
    if (user?.notificationPreferences) {
      form.setValue('notificationPreferences', user.notificationPreferences);
    }
  }, [theme, user, form]);

  const onSubmit = async (data: PreferencesFormValues) => {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Utente non autenticato.' });
        return;
    }
    
    setIsSaving(true);
    setTheme(data.theme); // Update theme immediately

    try {
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, {
            notificationPreferences: data.notificationPreferences,
        });
        toast({ title: 'Preferenze Salvate', description: 'Le tue impostazioni sono state aggiornate.' });
    } catch (error) {
        console.error('Error saving preferences:', error);
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare le preferenze.' });
    } finally {
        setIsSaving(false);
    }
  };


  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Preferenze</h1>
        <p className="text-muted-foreground">
          Personalizza l'aspetto e il comportamento dell'applicazione.
        </p>
      </div>

    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Tema Applicazione</CardTitle>
          <CardDescription>
            Scegli come vuoi visualizzare l'interfaccia.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="grid sm:grid-cols-3 gap-4"
                  >
                    <FormItem>
                      <RadioGroupItem value="light" id="light" className="peer sr-only" />
                      <Label
                        htmlFor="light"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Sun className="mb-3 h-6 w-6" />
                        Chiaro
                      </Label>
                    </FormItem>
                    <FormItem>
                      <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                      <Label
                        htmlFor="dark"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Moon className="mb-3 h-6 w-6" />
                        Scuro
                      </Label>
                    </FormItem>
                    <FormItem>
                      <RadioGroupItem value="system" id="system" className="peer sr-only" />
                      <Label
                        htmlFor="system"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Laptop className="mb-3 h-6 w-6" />
                        Sistema
                      </Label>
                    </FormItem>
                  </RadioGroup>
                </FormItem>
              )}
            />
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
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvataggio...</> : 'Salva Preferenze'}
            </Button>
        </div>
      </form>
    </Form>
    </div>
  );
}
