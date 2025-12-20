// src/app/(app)/previsioni/uscite/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, writeBatch, getDocs, doc, addDoc, updateDoc, CollectionReference } from 'firebase/firestore';
import { useFilter } from '@/context/filter-context';
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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Percent, Wallet, AlertCircle, Pencil, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { previsioniUsciteData as initialData } from '@/lib/previsioni-uscite-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PrevisioneUscita, RiepilogoPrevisioniUscite, AppUser } from '@/lib/types';
import { AddExpenseForecastDialog } from '@/components/previsioni/add-expense-forecast-dialog';
import { useToast } from '@/hooks/use-toast';

const getPrevisioniQuery = (firestore: any, user: AppUser | null, company: 'LNC' | 'STG' | 'Tutte', year: number | 'Tutti') => {
    if (!user || !firestore) return null;
    let q = collection(firestore, 'expenseForecasts') as CollectionReference<PrevisioneUscita>;
    let conditions: any[] = [];

    // Company filter
    if (user.role === 'admin' || user.role === 'editor') {
        if (company !== 'Tutte') {
            conditions.push(where('societa', '==', company));
        }
    } else if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        conditions.push(where('societa', '==', user.company));
    }

    // Year filter
    if (year !== 'Tutti') {
        conditions.push(where('anno', '==', year));
    }

    if (conditions.length > 0) {
        return query(q, ...conditions);
    }
    return query(q);
}

export default function PrevisioniUscitePage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
    const { selectedYear } = useFilter();
    const [sortConfig, setSortConfig] = useState<{ key: keyof PrevisioneUscita, direction: 'asc' | 'desc' } | null>({ key: 'dataScadenza', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingForecast, setEditingForecast] = useState<PrevisioneUscita | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);
    
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const expenseForecastsQuery = useMemoFirebase(() => getPrevisioniQuery(firestore, user, selectedCompany, selectedYear), [firestore, user, selectedCompany, selectedYear]);

    const { data: previsioni, isLoading: isLoadingPrevisioni, error } = useCollection<PrevisioneUscita>(expenseForecastsQuery);

     useEffect(() => {
        const seedDatabase = async () => {
            if (!firestore || isSeeding || (previsioni && previsioni.length > 0)) return;
            
            const q = query(collection(firestore, "expenseForecasts"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setIsSeeding(true);
                toast({ title: "Popolamento database...", description: "Caricamento dati iniziali per le previsioni di uscita." });
                const batch = writeBatch(firestore);
                initialData.forEach((previsione) => {
                    const docRef = doc(collection(firestore, "expenseForecasts"));
                    const { id, ...previsioneData } = previsione;
                    batch.set(docRef, { ...previsioneData, createdBy: user?.uid || 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                });
                try {
                    await batch.commit();
                    toast({ title: "Database popolato!", description: "I dati delle previsioni di uscita sono stati caricati." });
                } catch (error) {
                    console.error("Error seeding expense forecasts:", error);
                    toast({ variant: "destructive", title: "Errore nel popolamento", description: "Impossibile caricare i dati iniziali." });
                } finally {
                    setIsSeeding(false);
                }
            }
        };
        if (firestore && !isLoadingPrevisioni && user) {
          seedDatabase();
        }
    }, [firestore, toast, isSeeding, previsioni, isLoadingPrevisioni, user]);

    useEffect(() => {
        if (user?.role === 'company' && user.company) {
            setSelectedCompany(user.company);
        }
    }, [user]);

    const handleAddForecast = async (newForecastData: Omit<PrevisioneUscita, 'id'>) => {
        if (!user || !firestore) return;
        try {
            await addDoc(collection(firestore, 'expenseForecasts'), {
                ...newForecastData,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Previsione Aggiunta", description: "La nuova previsione di uscita è stata aggiunta." });
        } catch (error) {
            console.error("Error adding expense forecast: ", error);
            toast({ variant: 'destructive', title: 'Errore Salvataggio', description: 'Impossibile salvare la previsione. Riprova.' });
        }
    };

    const handleEditForecast = async (updatedForecast: PrevisioneUscita) => {
        if (!user || !firestore || !updatedForecast.id) return;
        try {
            const docRef = doc(firestore, 'expenseForecasts', updatedForecast.id);
            const { id, ...dataToUpdate } = updatedForecast;
            await updateDoc(docRef, { ...dataToUpdate, updatedAt: new Date().toISOString() });
            toast({ title: "Previsione Aggiornata", description: "La previsione è stata modificata." });
        } catch (error) {
            console.error("Error updating expense forecast: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile modificare la previsione. Riprova.' });
        }
    };

    const handleOpenDialog = (forecast?: PrevisioneUscita) => {
        setEditingForecast(forecast || null);
        setIsDialogOpen(true);
    };

    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - calculateNetto(lordo, iva);
    const calculatePonderato = (importo: number, probabilita: number) => importo * probabilita;

    const filteredPrevisioni = useMemo(() => {
        let data = previsioni || [];

        let sortableItems = [...data].filter(p => p.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));

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
    }, [previsioni, searchTerm, sortConfig]);

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
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
            currentUser={user!}
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
       <Tabs value={selectedCompany} onValueChange={(v) => setSelectedCompany(v as any)} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            {user && (user.role === 'admin' || user.role === 'editor') && (
                <TabsList>
                    <TabsTrigger value="Tutte">Tutte</TabsTrigger>
                    <TabsTrigger value="LNC">LNC</TabsTrigger>
                    <TabsTrigger value="STG">STG</TabsTrigger>
                </TabsList>
            )}
            <div className={cn("flex w-full md:w-auto items-center gap-2", (user?.role === 'admin' || user?.role === 'editor') ? '' : 'ml-auto')}>
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
                <Button onClick={() => handleOpenDialog()} className="flex-shrink-0" disabled={!user}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Aggiungi
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-shrink-0" disabled>
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
                Visualizza, aggiungi e gestisci le previsioni di spesa future per l'anno {selectedYear}.
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
                        {(isLoadingPrevisioni || isUserLoading || isSeeding) ? (
                            <TableRow><TableCell colSpan={19} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                        ) : error ? (
                            <TableRow><TableCell colSpan={19} className="h-24 text-center text-red-500">Errore nel caricamento: {error.message}</TableCell></TableRow>
                        ) : filteredPrevisioni.length === 0 ? (
                            <TableRow><TableCell colSpan={19} className="h-24 text-center">Nessuna previsione trovata.</TableCell></TableRow>
                        ) : (
                        filteredPrevisioni.map((p) => {
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
                        }))}
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
