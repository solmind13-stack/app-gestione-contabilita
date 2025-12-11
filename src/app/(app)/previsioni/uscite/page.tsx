// src/app/(app)/previsioni/uscite/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Percent, Wallet, AlertCircle, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

import { previsioniUsciteData as initialData } from '@/lib/previsioni-uscite-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PrevisioneUscita, RiepilogoPrevisioniUscite } from '@/lib/types';
import { AddExpenseForecastDialog } from '@/components/previsioni/add-expense-forecast-dialog';
import { user } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

export default function PrevisioniUscitePage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState('Tutte');
    const [previsioni, setPrevisioni] = useState<PrevisioneUscita[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof PrevisioneUscita, direction: 'asc' | 'desc' } | null>({ key: 'dataScadenza', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingForecast, setEditingForecast] = useState<PrevisioneUscita | null>(null);

    // Load data from localStorage on initial render
    useEffect(() => {
        try {
            const storedData = localStorage.getItem('previsioniUscite');
            setPrevisioni(storedData ? JSON.parse(storedData) : initialData);
        } catch (error) {
            console.error("Failed to parse previsioniUscite from localStorage", error);
            setPrevisioni(initialData);
        }
    }, []);

    // Persist data to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('previsioniUscite', JSON.stringify(previsioni));
        } catch (error) {
            console.error("Failed to save previsioniUscite to localStorage", error);
        }
    }, [previsioni]);


    const handleAddForecast = (newForecast: Omit<PrevisioneUscita, 'id' | 'anno'>) => {
        const newEntry: PrevisioneUscita = {
            id: `new-${Date.now()}`,
            anno: new Date(newForecast.dataScadenza).getFullYear(),
            ...newForecast,
        };
        setPrevisioni(prevData => [newEntry, ...prevData]);
        toast({ title: "Previsione Aggiunta", description: "La nuova previsione di uscita è stata aggiunta." });
    };

    const handleEditForecast = (updatedForecast: PrevisioneUscita) => {
        setPrevisioni(prevData => prevData.map(p => p.id === updatedForecast.id ? updatedForecast : p));
        setEditingForecast(null);
        toast({ title: "Previsione Aggiornata", description: "La previsione è stata modificata." });
    };

    const handleOpenDialog = (forecast?: PrevisioneUscita) => {
        setEditingForecast(forecast || null);
        setIsDialogOpen(true);
    };

    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - calculateNetto(lordo, iva);
    const calculatePonderato = (importo: number, probabilita: number) => importo * probabilita;

    const filteredPrevisioni = useMemo(() => {
      let sortableItems = [...previsioni]
        .filter(p => selectedCompany === 'Tutte' || p.societa === selectedCompany)
        .filter(p => p.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));

      if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
          const valA = a[sortConfig.key];
          const valB = b[sortConfig.key];
          if (valA < valB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (valA > valB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
      return sortableItems;
    }, [previsioni, selectedCompany, searchTerm, sortConfig]);

    const riepilogo = useMemo((): RiepilogoPrevisioniUscite => {
        const data = filteredPrevisioni;
        const totalePrevisto = data.reduce((acc, p) => acc + p.importoLordo, 0);
        const totalePonderato = data.reduce((acc, p) => acc + calculatePonderato(p.importoLordo, p.probabilita), 0);
        const totaleEffettivo = data.reduce((acc, p) => acc + (p.importoEffettivo || 0), 0);
        const daPagare = totalePrevisto - totaleEffettivo;
        const percentualePagato = totalePrevisto > 0 ? (totaleEffettivo / totalePrevisto) * 100 : 0;
        return { totalePrevisto, totalePonderato, totaleEffettivo, daPagare, percentualePagato };
    }, [filteredPrevisioni]);

    const requestSort = (key: keyof PrevisioneUscita) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof PrevisioneUscita) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Previsioni Uscite - Tutte le società';
        return `Previsioni Uscite - ${selectedCompany}`;
    };

  return (
    <div className="flex flex-col gap-6">
        <AddExpenseForecastDialog
            isOpen={isDialogOpen}
            setIsOpen={setIsDialogOpen}
            onAddForecast={handleAddForecast}
            onEditForecast={handleEditForecast}
            forecastToEdit={editingForecast}
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : undefined}
            currentUser={user}
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Totale Previsto</CardTitle>
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(riepilogo.totalePrevisto)}</div>
                    <p className="text-xs text-muted-foreground">L'importo totale di tutte le previsioni di uscita</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Da Pagare</CardTitle>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-500">{formatCurrency(riepilogo.daPagare)}</div>
                    <p className="text-xs text-muted-foreground">Importo residuo da saldare</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">% Pagato</CardTitle>
                    <div className="text-2xl font-bold">{riepilogo.percentualePagato.toFixed(0)}%</div>
                </CardHeader>
                <CardContent>
                    <Progress value={riepilogo.percentualePagato} className="h-2"/>
                    <p className="text-xs text-muted-foreground mt-2">Avanzamento dei pagamenti</p>
                </CardContent>
            </Card>
        </div>
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
                Visualizza, aggiungi e gestisci le previsioni di spesa future.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Società</TableHead>
                            <TableHead><Button variant="ghost" size="sm" onClick={() => requestSort('mese')}>Mese {getSortIcon('mese')}</Button></TableHead>
                            <TableHead><Button variant="ghost" size="sm" onClick={() => requestSort('dataScadenza')}>Data Scadenza {getSortIcon('dataScadenza')}</Button></TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Sottocategoria</TableHead>
                            <TableHead className="text-right">Importo Lordo</TableHead>
                            <TableHead className="text-right">Importo Netto</TableHead>
                            <TableHead className="text-center">% IVA</TableHead>
                            <TableHead className="text-right">Importo IVA</TableHead>
                            <TableHead className="text-center">Certezza</TableHead>
                            <TableHead className="text-center">% Prob.</TableHead>
                            <TableHead className="text-right">Importo Ponderato</TableHead>
                            <TableHead>Fonte/Contratto</TableHead>
                            <TableHead className="text-center">Stato</TableHead>
                            <TableHead className="text-right">Importo Effettivo</TableHead>
                            <TableHead>Ricorrenza</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPrevisioni.map((p) => {
                            const netto = calculateNetto(p.importoLordo, p.iva);
                            const iva = calculateIva(p.importoLordo, p.iva);
                            const ponderato = calculatePonderato(p.importoLordo, p.probabilita);
                            return (
                                <TableRow key={p.id}>
                                    <TableCell><Badge variant={p.societa === 'LNC' ? 'default' : 'secondary'}>{p.societa}</Badge></TableCell>
                                    <TableCell>{p.mese}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatDate(p.dataScadenza)}</TableCell>
                                    <TableCell>{p.descrizione}</TableCell>
                                    <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                                    <TableCell>{p.sottocategoria}</TableCell>
                                    <TableCell className="text-right font-medium text-red-600">{formatCurrency(p.importoLordo)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(netto)}</TableCell>
                                    <TableCell className="text-center">{(p.iva * 100).toFixed(0)}%</TableCell>
                                    <TableCell className="text-right">{formatCurrency(iva)}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge className={cn("text-white", {
                                        "bg-green-600 hover:bg-green-700": p.certezza === 'Certa',
                                        "bg-orange-500 hover:bg-orange-600": p.certezza === 'Probabile',
                                        "bg-yellow-500 hover:bg-yellow-600": p.certezza === 'Incerta',
                                      })}>{p.certezza}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">{ (p.probabilita * 100).toFixed(0) }%</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(ponderato)}</TableCell>
                                    <TableCell>{p.fonteContratto}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={cn("text-white", {
                                            "bg-green-600 hover:bg-green-700": p.stato === 'Pagato',
                                            "bg-red-600 hover:bg-red-600": p.stato === 'Da pagare',
                                            "bg-orange-500 hover:bg-orange-600": p.stato === 'Parziale',
                                            "bg-gray-500 hover:bg-gray-600": p.stato === 'Annullato',
                                        })}>{p.stato}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{p.importoEffettivo ? formatCurrency(p.importoEffettivo) : '-'}</TableCell>
                                    <TableCell>{p.ricorrenza}</TableCell>
                                    <TableCell>{p.note}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(p)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                     <TableFooter>
                        <TableRow>
                            <TableCell colSpan={6} className="font-bold">TOTALI</TableCell>
                            <TableCell className="text-right font-bold text-red-600">{formatCurrency(riepilogo.totalePrevisto)}</TableCell>
                            <TableCell colSpan={5}></TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePonderato)}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totaleEffettivo)}</TableCell>
                            <TableCell colSpan={3}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            </CardContent>
        </Card>
        </Tabs>
    </div>
  );
}
