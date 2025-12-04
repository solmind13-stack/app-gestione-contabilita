"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle } from "lucide-react";

const notifications = [
    {
        id: '1',
        title: 'Scadenza IMU',
        description: 'Il pagamento per la rata IMU scade tra 3 giorni.',
        type: 'warning'
    },
    {
        id: '2',
        title: 'Fattura in ritardo',
        description: 'La fattura #123 del cliente Rossi & Co è scaduta.',
        type: 'warning'
    },
     {
        id: '3',
        title: 'Liquidità bassa',
        description: 'La liquidità prevista per il prossimo mese è sotto la soglia critica.',
        type: 'error'
    }
];

export function Notifications() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifiche</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length > 0 ? (
            notifications.map((notification) => (
                <DropdownMenuItem key={notification.id} className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-1 text-orange-500" />
                    <div className="flex flex-col">
                        <p className="font-semibold text-sm">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">{notification.description}</p>
                    </div>
                </DropdownMenuItem>
            ))
        ) : (
            <DropdownMenuItem disabled>Nessuna nuova notifica</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
