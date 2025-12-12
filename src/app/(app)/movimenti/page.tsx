// src/app/(app)/movimenti/page.tsx
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, writeBatch, query, where, getDocs, doc, addDoc, updateDoc, CollectionReference } from 'firebase/firestore';

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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Pencil, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { movimentiData as initialMovimenti } from '@/lib/movimenti-data';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Movimento, Riepilogo, AppUser } from '@/lib/types';
import { AddMovementDialog } from '@/components/movimenti/add-movement-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";

const getMovimentiQuery = (firestore: any, user: AppUser | null, company: 'LNC' | 'STG' | 'Tutte') => {
    if (!firestore || !user) return null;
    
    const movimentiCollection = collection(firestore, 'movements') as CollectionReference<Movimento>;

    // Admins and editors can see all companies, but we filter client-side
    // or they can select a specific company.
    if (user.role === 'admin' || user.role === 'editor') {
        if (company !== 'Tutte') {
            return query(movimentiCollection, where('societa', '==', company));
        }
        // IMPORTANT: Firestore rules don't allow 'OR' queries easily.
        // For admins/editors seeing 'Tutte', we'll fetch both and merge,
        // or just fetch all if rules allow. Let's assume rules allow fetching all for admin.
        // The new rule will enforce filtering for non-admins.
        return query(movimentiCollection); 
    }
    
    // Company users can only see their own company data
    if (user.role === 'company' && user.company) {
        return query(movimentiCollection, where('societa', '==', user.company));
    }

    return null; // Should not happen for authorized users
}


export default function MovimentiPage() {
    const { toast } = useToast();
    const [selectedCompany, setSelectedCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
    
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    
    const movimentiQuery = useMemoFirebase(() => getMovimentiQuery(firestore, user, selectedCompany), [firestore, user, selectedCompany]);

    const { data: movimentiData, isLoading: isLoadingMovimenti, error } = useCollection<Movimento>(movimentiQuery);

    const [isSeeding, setIsSeeding] = useState(false);

     useEffect(() => {
        const seedDatabase = async () => {
            if (!firestore || isSeeding) return;

            // Check if seeding is necessary by checking one collection
            const q = query(collection(firestore, "movements"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setIsSeeding(true);
                toast({ title: "Popolamento database...", description: "Caricamento dati iniziali in corso. Potrebbe richiedere un istante." });
                
                try {
                    const batch = writeBatch(firestore);
                    
                    // Seed movements
                    initialMovimenti.forEach((movimento) => {
                        const docRef = doc(collection(firestore, "movements"));
                        const { id, ...movimentoData } = movimento;
                        batch.set(docRef, { ...movimentoData, createdBy: user?.uid || 'system', createdAt: new Date().toISOString() });
                    });
                    
                    await batch.commit();
                    toast({ title: "Database popolato!", description: "I dati iniziali sono stati caricati con successo." });
                } catch (error) {
                    console.error("Error seeding database:", error);
                    toast({ variant: "destructive", title: "Errore nel popolamento", description: "Impossibile caricare i dati iniziali." });
                } finally {
                    setIsSeeding(false);
                }
            }
        };
        if (firestore && user && !isLoadingMovimenti) {
            seedDatabase();
        }
    }, [firestore, toast, isSeeding, isLoadingMovimenti, user]);


    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingMovement, setEditingMovement] = useState<Movimento | null>(null);

    // Set the default selected company based on user role
    useEffect(() => {
        if (user?.role === 'company' && user.company) {
            setSelectedCompany(user.company);
        }
    }, [user]);

    const handleOpenDialog = (movement?: Movimento) => {
        setEditingMovement(movement || null);
        setIsDialogOpen(true);
    }
    
    const handleAddMovement = async (newMovementData: Omit<Movimento, 'id'>) => {
        if (!user || !firestore) return;
        try {
            await addDoc(collection(firestore, 'movements'), {
                ...newMovementData,
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            toast({ title: "Movimento Aggiunto", description: "Il nuovo movimento è stato salvato." });
        } catch (error) {
            console.error("Error adding movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Salvataggio', description: 'Impossibile salvare il movimento. Controlla i permessi.' });
        }
    };

    const handleEditMovement = async (updatedMovement: Movimento) => {
         if (!user || !firestore || !updatedMovement.id) return;
        try {
            const docRef = doc(firestore, 'movements', updatedMovement.id);
            const { id, ...dataToUpdate } = updatedMovement;
            await updateDoc(docRef, { ...dataToUpdate, updatedAt: new Date().toISOString() });
            toast({ title: "Movimento Aggiornato", description: "Il movimento è stato modificato." });
        } catch (error) {
             console.error("Error updating movement: ", error);
            toast({ variant: 'destructive', title: 'Errore Aggiornamento', description: 'Impossibile modificare il movimento. Controlla i permessi.' });
        }
    };


    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - (lordo / (1 + iva));

    const filteredMovimenti = useMemo(() => {
        let data = movimentiData || [];
        
        return data
            .filter(m => m.descrizione.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const dateA = new Date(a.data).getTime();
                const dateB = new Date(b.data).getTime();
                 if (sortOrder === 'asc') {
                    return dateA - dateB;
                } else {
                    return dateB - dateA;
                }
            });
    }, [movimentiData, searchTerm, sortOrder]);

    const riepilogo = useMemo((): Riepilogo => {
        const data = filteredMovimenti;
        const totaleEntrate = data.reduce((acc, m) => acc + (m.entrata || 0), 0);
        const totaleUscite = data.reduce((acc, m) => acc + (m.uscita || 0), 0);
        const ivaEntrate = data.reduce((acc, m) => acc + (m.entrata && m.entrata > 0 ? calculateIva(m.entrata, m.iva) : 0), 0);
        const ivaUscite = data.reduce((acc, m) => acc + (m.uscita && m.uscita > 0 ? calculateIva(m.uscita, m.iva) : 0), 0);
        const saldo = totaleEntrate - totaleUscite;
        const ivaNetta = ivaEntrate - ivaUscite;

        return { totaleEntrate, totaleUscite, saldo, ivaEntrate, ivaUscite, ivaNetta };
    }, [filteredMovimenti]);
    
    const totalEntrateNette = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.entrata && m.entrata > 0 ? calculateNetto(m.entrata, m.iva) : 0), 0), [filteredMovimenti]);
    const totalIvaEntrate = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.entrata && m.entrata > 0 ? calculateIva(m.entrata, m.iva) : 0), 0), [filteredMovimenti]);
    const totalUsciteNette = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.uscita && m.uscita > 0 ? calculateNetto(m.uscita, m.iva) : 0), 0), [filteredMovimenti]);
    const totalIvaUscite = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.uscita && m.uscita > 0 ? calculateIva(m.uscita, m.iva) : 0), 0), [filteredMovimenti]);

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Movimenti';
        return `Movimenti - ${selectedCompany}`;
    }

  return (
    <div className="flex flex-col gap-6">
       <AddMovementDialog
            isOpen={isDialogOpen}
            setIsOpen={setIsDialogOpen}
            onAddMovement={handleAddMovement}
            onEditMovement={handleEditMovement}
            movementToEdit={editingMovement}
            defaultCompany={selectedCompany !== 'Tutte' ? selectedCompany : user?.company}
            currentUser={user!}
        />
       <Tabs value={selectedCompany} onValueChange={(value) => setSelectedCompany(value as 'LNC' | 'STG' | 'Tutte')} className="w-full">
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
                 <Button variant="outline" onClick={() => {}} disabled>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Suggerisci Scadenze
                </Button>
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
                Visualizza, aggiungi e importa i tuoi movimenti finanziari.
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
                            Data
                            {sortOrder === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUp className="ml-2 h-4 w-4" />}
                        </Button>
                    </TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Sottocategoria</TableHead>
                    <TableHead className="text-right">Entrate Lorde</TableHead>
                    <TableHead className="text-right">Uscite Lorde</TableHead>
                    <TableHead className="text-center">% IVA</TableHead>
                    <TableHead className="text-right">Entrate Nette</TableHead>
                    <TableHead className="text-right">IVA Entrate</TableHead>
                    <TableHead className="text-right">Uscite Nette</TableHead>
                    <TableHead className="text-right">IVA Uscite</TableHead>
                    <TableHead>Conto</TableHead>
                    <TableHead>Operatore</TableHead>
                    <TableHead>Metodo Pag.</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(isLoadingMovimenti || isUserLoading || isSeeding) ? (
                        <TableRow>
                            <TableCell colSpan={17} className="h-24 text-center">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                            </TableCell>
                        </TableRow>
                    ) : error ? (
                         <TableRow>
                            <TableCell colSpan={17} className="h-24 text-center text-red-500">
                                Errore nel caricamento dei dati: {error.message}
                            </TableCell>
                        </TableRow>
                    ) : filteredMovimenti.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={17} className="h-24 text-center">Nessun movimento trovato.</TableCell>
                        </TableRow>
                    ) : (
                        filteredMovimenti.map((movimento) => {
                            const entrataLorda = movimento.entrata || 0;
                            const uscitaLorda = movimento.uscita || 0;
                            const entrataNetta = entrataLorda > 0 ? calculateNetto(entrataLorda, movimento.iva) : 0;
                            const ivaEntrata = entrataLorda > 0 ? calculateIva(entrataLorda, movimento.iva) : 0;
                            const uscitaNetta = uscitaLorda > 0 ? calculateNetto(uscitaLorda, movimento.iva) : 0;
                            const ivaUscita = uscitaLorda > 0 ? calculateIva(uscitaLorda, movimento.iva) : 0;

                        return (
                        <TableRow key={movimento.id}>
                            <TableCell>
                                <Badge variant={movimento.societa === 'LNC' ? 'default' : 'secondary'}>{movimento.societa}</Badge>
                            </TableCell>
                            <TableCell>{movimento.anno}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(movimento.data)}</TableCell>
                            <TableCell>{movimento.descrizione}</TableCell>
                            <TableCell>
                            <Badge variant="secondary">{movimento.categoria}</Badge>
                            </TableCell>
                            <TableCell>{movimento.sottocategoria}</TableCell>
                            <TableCell className={cn("text-right font-medium", entrataLorda > 0 && "text-green-600")}>
                            {entrataLorda > 0 ? formatCurrency(entrataLorda) : '-'}
                            </TableCell>
                            <TableCell className={cn("text-right font-medium", uscitaLorda > 0 && "text-red-600")}>
                            {uscitaLorda > 0 ? formatCurrency(uscitaLorda) : '-'}
                            </TableCell>
                            <TableCell className="text-center">{movimento.iva > 0 ? `${movimento.iva * 100}%` : '0%'}</TableCell>
                            <TableCell className="text-right">{entrataNetta > 0 ? formatCurrency(entrataNetta) : '-'}</TableCell>
                            <TableCell className="text-right">{ivaEntrata > 0 ? formatCurrency(ivaEntrata) : '-'}</TableCell>
                            <TableCell className="text-right">{uscitaNetta > 0 ? formatCurrency(uscitaNetta) : '-'}</TableCell>
                            <TableCell className="text-right">{ivaUscita > 0 ? formatCurrency(ivaUscita) : '-'}</TableCell>
                            <TableCell>{movimento.conto}</TableCell>
                            <TableCell>{movimento.operatore}</TableCell>
                            <TableCell>{movimento.metodoPag}</TableCell>
                            <TableCell>{movimento.note}</TableCell>
                            <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(movimento)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            </TableCell>
                        </TableRow>
                        );
                    }))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                    <TableCell colSpan={6} className="font-bold">TOTALI</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{formatCurrency(riepilogo.totaleEntrate)}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">{formatCurrency(riepilogo.totaleUscite)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">{formatCurrency(totalEntrateNette)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalIvaEntrate)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalUsciteNette)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalIvaUscite)}</TableCell>
                    <TableCell colSpan={5}></TableCell>
                    </TableRow>
                </TableFooter>
                </Table>
            </div>
            </CardContent>
        </Card>
        </Tabs>


      <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardHeader>
              <CardTitle>Riepilogo Movimenti {selectedCompany !== 'Tutte' && (user?.role === 'admin' || user?.role === 'editor') ? selectedCompany : ''}</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Entrate:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totaleEntrate)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Uscite:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totaleUscite)}</span>
                  </div>
                   <div className="flex justify-between font-bold">
                      <span>Saldo:</span>
                      <span>{formatCurrency(riepilogo.saldo)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Entrate:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.ivaEntrate)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Uscite:</span>
                      <span className="font-medium">{formatCurrency(riepilogo.ivaUscite)}</span>
                  </div>
                   <div className="flex justify-between font-bold">
                      <span>IVA Netta:</span>
                      <span>{formatCurrency(riepilogo.ivaNetta)}</span>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
