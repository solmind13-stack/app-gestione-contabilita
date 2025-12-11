// src/app/(app)/scadenze/page.tsx
"use client";

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

import { scadenzeData as initialScadenzeData } from '@/lib/scadenze-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Scadenza, RiepilogoScadenze } from '@/lib/types';
import { user } from '@/lib/data';
import { AddDeadlineDialog } from '@/components/scadenze/add-deadline-dialog';
import { useToast } from '@/hooks/use-toast';

export default function ScadenzePage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState('Tutte');
    const [scadenze, setScadenze] = useState<Scadenza[]>(initialScadenzeData);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDeadline, setEditingDeadline] = useState<Scadenza | null>(null);

    const handleAddDeadline = (newDeadline: Omit<Scadenza, 'id' | 'anno' | 'importoPagato' | 'stato'>) => {
        const newEntry: Scadenza = {
            id: `new-${Date.now()}`,
            anno: new Date(newDeadline.dataScadenza).getFullYear(),
            importoPagato: 0,
            stato: 'Da pagare',
            ...newDeadline,
        };
        setScadenze(prevData => [newEntry, ...prevData]);
        toast({ title: "Scadenza Aggiunta", description: "La nuova scadenza è stata aggiunta." });
    };

    const handleEditDeadline = (updatedDeadline: Scadenza) => {
        setScadenze(prevData => prevData.map(d => d.id === updatedDeadline.id ? updatedDeadline : d));
        setEditingDeadline(null);
        toast({ title: "Scadenza Aggiornata", description: "La scadenza è stata modificata." });
    };

    const handleOpenDialog = (deadline?: Scadenza) => {
        setEditingDeadline(deadline || null);
        setIsDialogOpen(true);
    };

    const filteredScadenze = useMemo(() => scadenze
        .filter(s => selectedCompany === 'Tutte' || s.societa === selectedCompany)
        .filter(s => s.descrizione.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const dateA = new Date(a.dataScadenza).getTime();
            const dateB = new Date(b.dataScadenza).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - a.id.localeCompare(b.id);
        }), [scadenze, selectedCompany, searchTerm, sortOrder]);
    
    const riepilogo = useMemo((): RiepilogoScadenze => {
        const data = filteredScadenze;
        const totalePrevisto = data.reduce((acc, s) => acc + s.importoPrevisto, 0);
        const totalePagato = data.reduce((acc, s) => acc + s.importoPagato, 0);
        const daPagare = totalePrevisto - totalePagato;
        const percentualeCompletamento = totalePrevisto > 0 ? (totalePagato / totalePrevisto) * 100 : 0;
        return { totalePrevisto, totalePagato, daPagare, percentualeCompletamento };
    }, [filteredScadenze]);

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Scadenze - Tutte le società';
        return `Scadenze - ${selectedCompany}`;
    };

  return (
    <div className="flex flex-col gap-6">
      <AddDeadlineDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        onAddDeadline={handleAddDeadline}
        onEditDeadline={handleEditDeadline}
        deadlineToEdit={editingDeadline}
        defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : undefined}
        currentUser={user}
      />
       <Tabs value={selectedCompany} onValueChange={setSelectedCompany} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <TabsList>
                <TabsTrigger value="Tutte">Tutte</TabsTrigger>
                <TabsTrigger value="LNC">LNC</TabsTrigger>
                <TabsTrigger value="STG">STG</TabsTrigger>
            </TabsList>
            <div className="flex w-full md:w-auto items-center gap-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cerca per descrizione..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => handleOpenDialog()} className="flex-shrink-0">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Aggiungi
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-shrink-0">
                            <Upload className="mr-2 h-4 w-4" />
                            Importa
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            <span>Importa da Excel</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>{getPageTitle()}</CardTitle>
                <CardDescription>
                Visualizza, aggiungi e gestisci le tue scadenze fiscali e pagamenti.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Società</TableHead>
                            <TableHead>Anno</TableHead>
                            <TableHead>
                                <Button variant="ghost" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                    Data Scadenza
                                    {sortOrder === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUp className="ml-2 h-4 w-4" />}
                                </Button>
                            </TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Importo Previsto</TableHead>
                            <TableHead className="text-right">Importo Pagato</TableHead>
                            <TableHead className="text-center">Stato</TableHead>
                            <TableHead>Ricorrenza</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredScadenze.map((scadenza) => (
                            <TableRow key={scadenza.id}>
                                <TableCell>
                                    <Badge variant={scadenza.societa === 'LNC' ? 'default' : 'secondary'}>{scadenza.societa}</Badge>
                                </TableCell>
                                <TableCell>{scadenza.anno}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatDate(scadenza.dataScadenza)}</TableCell>
                                <TableCell>{scadenza.descrizione}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{scadenza.categoria}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(scadenza.importoPrevisto)}</TableCell>
                                <TableCell className="text-right font-medium">{scadenza.importoPagato > 0 ? formatCurrency(scadenza.importoPagato) : '-'}</TableCell>
                                <TableCell className="text-center">
                                    <Badge
                                      className={cn("text-white", {
                                        "bg-green-500 hover:bg-green-600": scadenza.stato === 'Pagato',
                                        "bg-red-500 hover:bg-red-600": scadenza.stato === 'Da pagare',
                                        "bg-yellow-500 hover:bg-yellow-600": scadenza.stato === 'Parziale',
                                      })}
                                    >{scadenza.stato}</Badge>
                                </TableCell>
                                <TableCell>{scadenza.ricorrenza}</TableCell>
                                <TableCell>{scadenza.note}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(scadenza)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="font-bold">TOTALI</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePrevisto)}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePagato)}</TableCell>
                            <TableCell colSpan={4}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            </CardContent>
        </Card>
        </Tabs>

        <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardHeader>
              <CardTitle>Riepilogo Scadenze {selectedCompany !== 'Tutte' ? selectedCompany : 'Totale'}</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Previsto:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totalePrevisto)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Pagato:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totalePagato)}</span>
                  </div>
                   <div className="flex justify-between font-bold text-base">
                      <span className="text-red-600 dark:text-red-400">Da Pagare:</span>
                      <span className="text-red-600 dark:text-red-400">{formatCurrency(riepilogo.daPagare)}</span>
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <div className="flex justify-between font-medium">
                        <span>% Completamento</span>
                        <span>{riepilogo.percentualeCompletamento.toFixed(0)}%</span>
                    </div>
                    <Progress value={riepilogo.percentualeCompletamento} />
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
