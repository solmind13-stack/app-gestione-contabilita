// src/app/(app)/movimenti/page.tsx
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Upload, FileText, FileCode, Image, ArrowUp, ArrowDown, Search, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { movimentiData as initialMovimenti } from '@/lib/movimenti-data';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Movimento, Riepilogo } from '@/lib/types';
import { AddMovementDialog } from '@/components/movimenti/add-movement-dialog';
import { user } from '@/lib/data';
import { Input } from '@/components/ui/input';

export default function MovimentiPage() {
    const [selectedCompany, setSelectedCompany] = useState('Tutte');
    const [movimentiData, setMovimentiData] = useState<Movimento[]>(initialMovimenti);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [searchTerm, setSearchTerm] = useState('');

    const handleAddMovement = (newMovement: Omit<Movimento, 'id' | 'anno'>) => {
        const newEntry: Movimento = {
            id: `new-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // More robust temporary ID
            anno: new Date(newMovement.data).getFullYear(),
            ...newMovement,
        };
        setMovimentiData(prevData => [newEntry, ...prevData]);
    };

    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - (lordo / (1 + iva));

    const filteredMovimenti = useMemo(() => movimentiData
        .filter(m => selectedCompany === 'Tutte' || m.societa === selectedCompany)
        .filter(m => m.descrizione.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const dateA = new Date(a.data).getTime();
            const dateB = new Date(b.data).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - a.id.localeCompare(b.id);
        }), [movimentiData, selectedCompany, searchTerm, sortOrder]);

    const riepilogo = useMemo((): Riepilogo => {
        const data = filteredMovimenti;
        const totaleEntrate = data.reduce((acc, m) => acc + m.entrata, 0);
        const totaleUscite = data.reduce((acc, m) => acc + m.uscita, 0);
        const ivaEntrate = data.reduce((acc, m) => acc + (m.entrata > 0 ? calculateIva(m.entrata, m.iva) : 0), 0);
        const ivaUscite = data.reduce((acc, m) => acc + (m.uscita > 0 ? calculateIva(m.uscita, m.iva) : 0), 0);
        const saldo = totaleEntrate - totaleUscite;
        const ivaNetta = ivaEntrate - ivaUscite;

        return { totaleEntrate, totaleUscite, saldo, ivaEntrate, ivaUscite, ivaNetta };
    }, [filteredMovimenti]);
    
    const totalEntrateNette = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.entrata > 0 ? calculateNetto(m.entrata, m.iva) : 0), 0), [filteredMovimenti]);
    const totalIvaEntrate = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.entrata > 0 ? calculateIva(m.entrata, m.iva) : 0), 0), [filteredMovimenti]);
    const totalUsciteNette = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.uscita > 0 ? calculateNetto(m.uscita, m.iva) : 0), 0), [filteredMovimenti]);
    const totalIvaUscite = useMemo(() => filteredMovimenti.reduce((acc, m) => acc + (m.uscita > 0 ? calculateIva(m.uscita, m.iva) : 0), 0), [filteredMovimenti]);

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Movimenti - Tutte le società';
        return `Movimenti - ${selectedCompany}`;
    }

  return (
    <div className="flex flex-col gap-6">
       <AddMovementDialog
            isOpen={isDialogOpen}
            setIsOpen={setIsDialogOpen}
            onAddMovement={handleAddMovement}
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
                <Button onClick={() => setIsDialogOpen(true)} className="flex-shrink-0">
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
                        <DropdownMenuItem>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Importa da PDF</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                        <FileCode className="mr-2 h-4 w-4" />
                        <span>Importa da Word</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                        <Image className="mr-2 h-4 w-4" />
                        <span>Importa da Immagine</span>
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
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredMovimenti.map((movimento) => {
                        const entrataNetta = movimento.entrata > 0 ? calculateNetto(movimento.entrata, movimento.iva) : 0;
                        const ivaEntrata = movimento.entrata > 0 ? calculateIva(movimento.entrata, movimento.iva) : 0;
                        const uscitaNetta = movimento.uscita > 0 ? calculateNetto(movimento.uscita, movimento.iva) : 0;
                        const ivaUscita = movimento.uscita > 0 ? calculateIva(movimento.uscita, movimento.iva) : 0;

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
                        <TableCell className={cn("text-right font-medium", movimento.entrata > 0 && "text-green-600")}>
                        {movimento.entrata > 0 ? formatCurrency(movimento.entrata) : '-'}
                        </TableCell>
                        <TableCell className={cn("text-right font-medium", movimento.uscita > 0 && "text-red-600")}>
                        {movimento.uscita > 0 ? formatCurrency(movimento.uscita) : '-'}
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
                    </TableRow>
                    )})}
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
              <CardTitle>Riepilogo Movimenti {selectedCompany !== 'Tutte' ? selectedCompany : 'Totale'}</CardTitle>
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
