// src/app/(app)/impostazioni/preferenze/page.tsx
'use client';

import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Moon, Sun, Laptop, Bell, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function PreferenzePage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleNotificationChange = (type: string, enabled: boolean) => {
    toast({
        title: "Preferenze aggiornate",
        description: `Notifiche per "${type}" ${enabled ? 'abilitate' : 'disabilitate'}. (Funzionalità in sviluppo)`,
    });
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Preferenze</h1>
        <p className="text-muted-foreground">
          Personalizza l'aspetto e il comportamento dell'applicazione.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tema Applicazione</CardTitle>
          <CardDescription>
            Scegli come vuoi visualizzare l'interfaccia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="grid sm:grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem value="light" id="light" className="peer sr-only" />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Sun className="mb-3 h-6 w-6" />
                Chiaro
              </Label>
            </div>
            <div>
              <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Moon className="mb-3 h-6 w-6" />
                Scuro
              </Label>
            </div>
            <div>
              <RadioGroupItem value="system" id="system" className="peer sr-only" />
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Laptop className="mb-3 h-6 w-6" />
                Sistema
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Gestione Notifiche</CardTitle>
            <CardDescription>
                Scegli quali notifiche ricevere e come. Le impostazioni verranno salvate per il tuo account.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-medium">Notifiche via Email</h3>
            </div>
            <div className="space-y-4 pl-7">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="movimenti-notifications" className="text-base">Creazione Movimenti</Label>
                        <p className="text-sm text-muted-foreground">
                           Ricevi un'email quando viene aggiunto un nuovo movimento.
                        </p>
                    </div>
                    <Switch
                        id="movimenti-notifications"
                        onCheckedChange={(checked) => handleNotificationChange("Nuovi movimenti", checked)}
                    />
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label htmlFor="scadenze-notifications" className="text-base">Scadenze Imminenti</Label>
                         <p className="text-sm text-muted-foreground">
                            Ricevi un promemoria per le scadenze in avvicinamento.
                        </p>
                    </div>
                    <Switch
                        id="scadenze-notifications"
                        onCheckedChange={(checked) => handleNotificationChange("Scadenze imminenti", checked)}
                    />
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
