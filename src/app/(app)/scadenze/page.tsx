// src/app/(app)/scadenze/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, writeBatch, getDocs, doc, addDoc, updateDoc, query, where, CollectionReference } from 'firebase/firestore';
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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Pencil, CalendarClock, AlertTriangle, History, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { scadenzeData as initialScadenzeData } from '@/lib/scadenze-data';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Scadenza, AppUser } from '@/lib/types';
import { AddDeadlineDialog } from '@/components/scadenze/add-deadline-dialog';
import { useToast } from '@/hooks/use-toast';
import { YEARS, CATEGORIE_SCADENZE, RICORRENZE, STATI_SCADENZE } from '@/lib/constants';

const getScadenzeQuery = (firestore: any, user: AppUser | null, company: 'LNC' | 'STG' | 'Tutte') => {
    if (!firestore || !user) return null;
    
    let q = collection(firestore, 'deadlines') as CollectionReference<Scadenza>;

    if (user.role === 'admin' || user.role === 'editor') {
        if (company !== 'Tutte') {
            return query(q, where('societa', '==', company));
        }
    } else if (user.role === 'company' || user.role === 'company-editor') {
        if (!user.company) return null;
        return query(q, where('societa', '==', user.company));
    }

    return query(q);
}

export default function ScadenzePage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDeadline, setEditingDeadline] = useState<Scadenza | null>(null);
    const [isSeeding, setIsSeeding] = useState(false);

    // Filters
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
    const [selectedStatus, setSelectedStatus] = useState<string>('Tutti');
    const [selectedRecurrence, setSelectedRecurrence] = useState<string>('Tutti');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (!selectedYear) {
            setSelectedYear(YEARS[1].toString());
        }
    }, []);

    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const deadlinesQuery = useMemo(() => getScadenzeQuery(firestore, user, selectedCompany), [firestore, user, selectedCompany]);
    
    const { data: scadenze, isLoading: isLoadingScadenze, error } = useCollection<Scadenza>(deadlinesQuery);

    useEffect(() => {
        const seedDatabase = async () => {
            if (!firestore || isSeeding || (scadenze && scadenze.length > 0)) return;
            
            const q = query(collection(firestore, "deadlines"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setIsSeeding(true);
                toast({ title: "Popolamento database...", description: "Caricamento dati iniziali per le scadenze." });
                const batch = writeBatch(firestore);
                initialScadenzeData.forEach((scadenza) => {
                    const docRef = doc(collection(firestore, "deadlines"));
                    const { id, ...scadenzaData } = scadenza; // Exclude our static ID
                    batch.set(docRef, { ...scadenzaData, createdBy: user?.uid || 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                });
                try {
                    await batch.commit();
                    toast({ title: "Database popolato!", description: "I dati delle scadenze sono stati caricati." });
                } catch (error) {
                    console.error("Error seeding deadlines:", error);
                    toast({ variant: "destructive", title: "Errore nel popolamento", description: "Impossibile caricare i dati iniziali delle scadenze." });
                } finally {
                    setIsSeeding(false);
                }
            }
        };
        if (firestore && !isLoadingScadenze && user) {
          seedDatabase();
        }
    }, [firestore, toast, isSeeding, scadenze, isLoadingScadenze, user]);

    useEffect(() => {
        if (user?.role === 'company' && user.company) {
            setSelectedCompany(user.company);
        }
         else if (user?.role === 'company-editor' && user.company) {
            setSelectedCompany(user.company);
        }
    }, [user]);

    const handleAddDeadline = async (newDeadlineData: Omit<Scadenza, 'id'>) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Utente non autenticato o database non disponibile.' });
            return;
        }
        try {
            await addDoc(collection(firestore, 'deadlines'), {
                ...newDeadlineData,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Scadenza Aggiunta", description: "La nuova scadenza è stata salvata." });
        } catch (error) {
            console.error("Error adding deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Salvataggio', description: 'Impossibile salvare la scadenza. Riprova.' });
        }
    };

    const handleEditDeadline = async (updatedDeadline: Scadenza) => {
         if (!user || !firestore || !updatedDeadline.id) {
            toast({ variant: 'destructive', title: 'Errore', description: 'Dati non validi per l\'aggiornamento.' });
            return;
        }
        try {
            const docRef = doc(firestore, 'deadlines', updatedDeadline.id);
            const { id, ...dataToUpdate } = updatedDeadline;
            await updateDoc(docRef, {
                ...dataToUpdate,
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Scadenza Aggiornata", description: "La scadenza è stata modificata." });
        } catch (error) {
             console.error("Error updating deadline: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile modificare la scadenza. Riprova.' });
        }
    };

    const handleOpenDialog = (deadline?: Scadenza) => {
        setEditingDeadline(deadline || null);
        setIsDialogOpen(true);
    };

    const { 
        filteredScadenze,
        uniqueCategories,
        uniqueStatuses,
        uniqueRecurrences,
        riepilogo, 
        scadenzeMese, 
        scadenzeUrgenti, 
        scadenzeScadute 
    } = useMemo(() => {
        let data = scadenze || [];
        
        const categories = [...new Set(data.map(item => item.categoria))].sort();
        const statuses = [...new Set(data.map(item => item.stato))].sort();
        const recurrences = [...new Set(data.map(item => item.ricorrenza))].sort();
        
        let filtered = data
            .filter(s => !selectedYear || selectedYear === 'Tutti' || s.anno === Number(selectedYear))
            .filter(s => selectedCategory === 'Tutti' || s.categoria === selectedCategory)
            .filter(s => selectedStatus === 'Tutti' || s.stato === selectedStatus)
            .filter(s => selectedRecurrence === 'Tutti' || s.ricorrenza === selectedRecurrence)
            .filter(s => s.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));
        
        filtered = filtered.sort((a, b) => {
                const dateA = new Date(a.dataScadenza).getTime();
                const dateB = new Date(b.dataScadenza).getTime();
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });

        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const setteGiorni = new Date(oggi);
        setteGiorni.setDate(oggi.getDate() + 7);

        const scadenzeNelMese = filtered.filter(s => {
            const dataScadenza = new Date(s.dataScadenza);
            return dataScadenza.getMonth() === oggi.getMonth() && dataScadenza.getFullYear() === oggi.getFullYear() && s.stato !== 'Pagato';
        });

        const scadenzeUrg = filtered.filter(s => {
            const dataScadenza = new Date(s.dataScadenza);
            return dataScadenza >= oggi && dataScadenza <= setteGiorni && s.stato !== 'Pagato';
        });

        const scadenzeOverdue = filtered.filter(s => new Date(s.dataScadenza) < oggi && s.stato !== 'Pagato');

        const totalePrevisto = filtered.reduce((acc, s) => acc + s.importoPrevisto, 0);
        const totalePagato = filtered.reduce((acc, s) => acc + s.importoPagato, 0);
        const daPagare = totalePrevisto - totalePagato;
        const percentualeCompletamento = totalePrevisto > 0 ? (totalePagato / totalePrevisto) * 100 : 0;
        
        return {
            filteredScadenze: filtered,
            uniqueCategories: categories,
            uniqueStatuses: statuses,
            uniqueRecurrences: recurrences,
            riepilogo: { totalePrevisto, totalePagato, daPagare, percentualeCompletamento },
            scadenzeMese: {
                importo: scadenzeNelMese.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0),
                conteggio: scadenzeNelMese.length
            },
            scadenzeUrgenti: {
                importo: scadenzeUrg.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0),
                conteggio: scadenzeUrg.length
            },
            scadenzeScadute: {
                importo: scadenzeOverdue.reduce((acc, s) => acc + (s.importoPrevisto - s.importoPagato), 0),
                conteggio: scadenzeOverdue.length
            }
        };
    }, [scadenze, searchTerm, sortOrder, selectedYear, selectedCategory, selectedStatus, selectedRecurrence]);

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Scadenze';
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
        defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
        currentUser={user!}
      />

    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scadenze nel Mese</CardTitle>
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(scadenzeMese.importo)}</div>
                <p className="text-xs text-muted-foreground">{scadenzeMese.conteggio} scadenze questo mese</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scadenze Urgenti</CardTitle>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-orange-500">{formatCurrency(scadenzeUrgenti.importo)}</div>
                <p className="text-xs text-muted-foreground">{scadenzeUrgenti.conteggio} scadenze nei prossimi 7 giorni</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scadute</CardTitle>
                <History className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-500">{formatCurrency(scadenzeScadute.importo)}</div>
                <p className="text-xs text-muted-foreground">{scadenzeScadute.conteggio} scadenze non pagate</p>
            </CardContent>
        </Card>
        <Card>
             <CardHeader>
              <CardTitle className="text-sm font-medium">Riepilogo Generale</CardTitle>
          </CardHeader>
          <CardContent>
                <div className="space-y-2">
                    <div className="flex justify-between font-medium text-sm">
                        <span>% Pagato</span>
                        <span>{riepilogo.percentualeCompletamento.toFixed(0)}%</span>
                    </div>
                    <Progress value={riepilogo.percentualeCompletamento} />
                </div>
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

        {isClient && <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Anno:</label>
                <Select value={selectedYear || ''} onValueChange={(value) => setSelectedYear(value)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Anno" />
                    </SelectTrigger>
                    <SelectContent>
                        {YEARS.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Categoria:</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutte le Categorie</SelectItem>
                        {uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Stato:</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stato" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutti gli Stati</SelectItem>
                        {uniqueStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Ricorrenza:</label>
                <Select value={selectedRecurrence} onValueChange={setSelectedRecurrence}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Ricorrenza" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutte le Ricorrenze</SelectItem>
                        {uniqueRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>}

        <Card>
            <CardHeader>
                <CardTitle>{getPageTitle()}</CardTitle>
                <CardDescription>
                Visualizza, aggiungi e gestisci le tue scadenze fiscali e pagamenti per l'anno {selectedYear}.
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
                        {(isLoadingScadenze || isUserLoading || isSeeding) ? (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center text-red-500">
                                    Errore nel caricamento: {error.message}
                                </TableCell>
                            </TableRow>
                        ) : filteredScadenze.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="h-24 text-center">Nessuna scadenza trovata.</TableCell>
                            </TableRow>
                        ) : (
                            filteredScadenze.map((scadenza) => (
                            <TableRow key={scadenza.id} className={cn(new Date(scadenza.dataScadenza) < new Date() && scadenza.stato !== 'Pagato' && 'bg-red-50 dark:bg-red-900/20')}>
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
                                      className={cn({
                                        "bg-green-600 hover:bg-green-700 text-white": scadenza.stato === 'Pagato',
                                        "bg-red-600 hover:bg-red-700 text-white": scadenza.stato === 'Da pagare',
                                        "bg-yellow-500 hover:bg-yellow-600 text-white": scadenza.stato === 'Parziale',
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
                        )))}
                    </TableBody>
                    {filteredScadenze.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={5} className="font-bold">TOTALI</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePrevisto)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePagato)}</TableCell>
                                <TableCell colSpan={4}></TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </div>
            </CardContent>
        </Card>
        </Tabs>
    </div>
  );
}
