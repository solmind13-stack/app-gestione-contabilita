// src/app/(app)/previsioni/entrate/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, writeBatch, getDocs, doc, addDoc, updateDoc, CollectionReference } from 'firebase/firestore';
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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Percent, Wallet, CheckCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { previsioniEntrateData as initialData } from '@/lib/previsioni-entrate-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PrevisioneEntrata, RiepilogoPrevisioniEntrate, AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { YEARS } from '@/lib/constants';

const getPrevisioniQuery = (firestore: any, user: AppUser | null, company: 'LNC' | 'STG' | 'Tutte') => {
    if (!firestore || !user) return null;
    let q = collection(firestore, 'incomeForecasts') as CollectionReference<PrevisioneEntrata>;
    
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


export default function PrevisioniEntratePage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
    const [sortConfig, setSortConfig] = useState<{ key: keyof PrevisioneEntrata, direction: 'asc' | 'desc' } | null>({ key: 'dataPrevista', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isSeeding, setIsSeeding] = useState(false);

    // Filters
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
    const [selectedCertainty, setSelectedCertainty] = useState<string>('Tutti');
    const [selectedStatus, setSelectedStatus] = useState<string>('Tutti');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (!selectedYear) {
            setSelectedYear(YEARS[1].toString());
        }
    }, []);

    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const incomeForecastsQuery = useMemo(() => getPrevisioniQuery(firestore, user, selectedCompany), [firestore, user, selectedCompany]);
    const { data: previsioni, isLoading: isLoadingPrevisioni, error } = useCollection<PrevisioneEntrata>(incomeForecastsQuery);

     useEffect(() => {
        const seedDatabase = async () => {
            if (!firestore || isSeeding || (previsioni && previsioni.length > 0)) return;
            
            const q = query(collection(firestore, "incomeForecasts"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setIsSeeding(true);
                toast({ title: "Popolamento database...", description: "Caricamento dati iniziali per le previsioni di entrata." });
                const batch = writeBatch(firestore);
                initialData.forEach((previsione) => {
                    const docRef = doc(collection(firestore, "incomeForecasts"));
                    const { id, ...previsioneData } = previsione;
                    batch.set(docRef, { ...previsioneData, createdBy: user?.uid || 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                });
                try {
                    await batch.commit();
                    toast({ title: "Database popolato!", description: "I dati delle previsioni di entrata sono stati caricati." });
                } catch (error) {
                    console.error("Error seeding income forecasts:", error);
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
        } else if (user?.role === 'company-editor' && user.company) {
            setSelectedCompany(user.company);
        }
    }, [user]);

    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - calculateNetto(lordo, iva);
    const calculatePonderato = (lordo: number, probabilita: number) => lordo * probabilita;

    const { 
        filteredPrevisioni, 
        uniqueCategories,
        uniqueCertainties,
        uniqueStatuses,
        riepilogo 
    } = useMemo(() => {
      let data = previsioni || [];
      
      const categories = [...new Set(data.map(item => item.categoria))].sort();
      const certainties = [...new Set(data.map(item => item.certezza))].sort();
      const statuses = [...new Set(data.map(item => item.stato))].sort();

      let filtered = data
        .filter(p => !selectedYear || selectedYear === 'Tutti' || p.anno === Number(selectedYear))
        .filter(p => selectedCategory === 'Tutti' || p.categoria === selectedCategory)
        .filter(p => selectedCertainty === 'Tutti' || p.certezza === selectedCertainty)
        .filter(p => selectedStatus === 'Tutti' || p.stato === selectedStatus)
        .filter(p => p.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));

      if (sortConfig !== null) {
        filtered.sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }

      const riepilogoData: RiepilogoPrevisioniEntrate = {
        totaleLordo: filtered.reduce((acc, p) => acc + p.importoLordo, 0),
        totalePonderato: filtered.reduce((acc, p) => acc + calculatePonderato(p.importoLordo, p.probabilita), 0),
        totaleIncassato: filtered.filter(p => p.stato === 'Incassato').reduce((acc, p) => acc + p.importoLordo, 0),
      };
      
      return {
        filteredPrevisioni: filtered,
        uniqueCategories: categories,
        uniqueCertainties: certainties,
        uniqueStatuses: statuses,
        riepilogo: riepilogoData,
      };
    }, [previsioni, searchTerm, sortConfig, selectedYear, selectedCategory, selectedCertainty, selectedStatus]);

    const requestSort = (key: keyof PrevisioneEntrata) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof PrevisioneEntrata) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Previsioni Entrate';
        return `Previsioni Entrate - ${selectedCompany}`;
    };

  return (
    <div className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Totale Previsto (Lordo)</CardTitle>
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(riepilogo.totaleLordo)}</div>
                    <p className="text-xs text-muted-foreground">L'importo totale di tutte le previsioni</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Totale Ponderato</CardTitle>
                    <Percent className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(riepilogo.totalePonderato)}</div>
                    <p className="text-xs text-muted-foreground">Importo previsto pesato per probabilità</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Totale Già Incassato</CardTitle>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-500">{formatCurrency(riepilogo.totaleIncassato)}</div>
                    <p className="text-xs text-muted-foreground">Somma delle previsioni già incassate</p>
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
                <Button onClick={() => {}} className="flex-shrink-0" disabled>
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
                    <SelectTrigger className="w-[120px]"><SelectValue placeholder="Anno" /></SelectTrigger>
                    <SelectContent>{YEARS.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
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
                <label className="text-sm font-medium">Certezza:</label>
                <Select value={selectedCertainty} onValueChange={setSelectedCertainty}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Certezza" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutti">Tutti i Livelli</SelectItem>
                        {uniqueCertainties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
        </div>}


        <Card>
            <CardHeader>
                <CardTitle>{getPageTitle()}</CardTitle>
                <CardDescription>
                Visualizza, aggiungi e gestisci le previsioni di entrata future per l'anno {selectedYear}.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Società</TableHead>
                            <TableHead><Button variant="ghost" size="sm" onClick={() => requestSort('mese')}>Mese {getSortIcon('mese')}</Button></TableHead>
                            <TableHead><Button variant="ghost" size="sm" onClick={() => requestSort('dataPrevista')}>Data Prevista {getSortIcon('dataPrevista')}</Button></TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Importo Lordo</TableHead>
                            <TableHead className="text-center">% IVA</TableHead>
                            <TableHead className="text-right">Importo IVA</TableHead>
                            <TableHead className="text-right">Importo Netto</TableHead>
                            <TableHead className="text-center">Certezza</TableHead>
                            <TableHead className="text-center">% Prob.</TableHead>
                            <TableHead className="text-right">Importo Ponderato</TableHead>
                            <TableHead className="text-center">Stato</TableHead>
                            <TableHead>Note</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(isLoadingPrevisioni || isUserLoading || isSeeding) ? (
                             <TableRow>
                                <TableCell colSpan={14} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={14} className="h-24 text-center text-red-500">
                                    Errore nel caricamento: {error.message}
                                </TableCell>
                            </TableRow>
                        ) : filteredPrevisioni.length === 0 ? (
                             <TableRow>
                                <TableCell colSpan={14} className="h-24 text-center">Nessuna previsione trovata.</TableCell>
                            </TableRow>
                        ) : (
                        filteredPrevisioni.map((p) => {
                            const netto = calculateNetto(p.importoLordo, p.iva);
                            const iva = calculateIva(p.importoLordo, p.iva);
                            const ponderato = calculatePonderato(p.importoLordo, p.probabilita);
                            return (
                                <TableRow key={p.id}>
                                    <TableCell><Badge variant={p.societa === 'LNC' ? 'default' : 'secondary'}>{p.societa}</Badge></TableCell>
                                    <TableCell>{p.mese}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatDate(p.dataPrevista)}</TableCell>
                                    <TableCell>{p.descrizione}</TableCell>
                                    <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(p.importoLordo)}</TableCell>
                                    <TableCell className="text-center">{(p.iva * 100).toFixed(0)}%</TableCell>
                                    <TableCell className="text-right">{formatCurrency(iva)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(netto)}</TableCell>
                                    <TableCell className="text-center">
                                      <Badge className={cn("text-white", {
                                        "bg-green-600 hover:bg-green-700": p.certezza === 'Certa',
                                        "bg-orange-500 hover:bg-orange-600": p.certezza === 'Probabile',
                                        "bg-yellow-500 hover:bg-yellow-600": p.certezza === 'Incerta',
                                      })}>{p.certezza}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">{ (p.probabilita * 100).toFixed(0) }%</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(ponderato)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={cn("text-white", {
                                          "bg-green-600 hover:bg-green-700": p.stato === 'Incassato',
                                          "bg-orange-500 hover:bg-orange-600": p.stato === 'Da incassare',
                                          "bg-yellow-500 hover:bg-yellow-600": p.stato === 'Parziale',
                                          "bg-red-600 hover:bg-red-700": p.stato === 'Annullato',
                                        })}>{p.stato}</Badge>
                                    </TableCell>
                                    <TableCell>{p.note}</TableCell>
                                </TableRow>
                            )
                        }))}
                    </TableBody>
                     {filteredPrevisioni.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={5} className="font-bold">TOTALI</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totaleLordo)}</TableCell>
                                <TableCell colSpan={5}></TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePonderato)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
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
