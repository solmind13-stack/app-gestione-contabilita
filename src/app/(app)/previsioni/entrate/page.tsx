// src/app/(app)/previsioni/entrate/page.tsx
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
import { PlusCircle, Upload, FileSpreadsheet, Search, ArrowUp, ArrowDown, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

import { previsioniEntrateData as initialData } from '@/lib/previsioni-entrate-data';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PrevisioneEntrata, RiepilogoPrevisioniEntrate } from '@/lib/types';

export default function PrevisioniEntratePage() {
    const [selectedCompany, setSelectedCompany] = useState('Tutte');
    const [previsioni, setPrevisioni] = useState<PrevisioneEntrata[]>(initialData);
    const [sortConfig, setSortConfig] = useState<{ key: keyof PrevisioneEntrata, direction: 'asc' | 'desc' } | null>({ key: 'dataPrevista', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');

    const calculateNetto = (lordo: number, iva: number) => lordo / (1 + iva);
    const calculateIva = (lordo: number, iva: number) => lordo - calculateNetto(lordo, iva);
    const calculatePonderato = (lordo: number, probabilita: number) => lordo * probabilita;

    const filteredPrevisioni = useMemo(() => {
      let sortableItems = [...previsioni]
        .filter(p => selectedCompany === 'Tutte' || p.societa === selectedCompany)
        .filter(p => p.descrizione.toLowerCase().includes(searchTerm.toLowerCase()));

      if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
      return sortableItems;
    }, [previsioni, selectedCompany, searchTerm, sortConfig]);

    const riepilogo = useMemo((): RiepilogoPrevisioniEntrate => {
        const data = filteredPrevisioni;
        const totaleLordo = data.reduce((acc, p) => acc + p.importoLordo, 0);
        const totalePonderato = data.reduce((acc, p) => acc + calculatePonderato(p.importoLordo, p.probabilita), 0);
        const totaleIncassato = data.filter(p => p.stato === 'Incassato').reduce((acc, p) => acc + p.importoLordo, 0);
        return { totaleLordo, totalePonderato, totaleIncassato };
    }, [filteredPrevisioni]);

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

    const getStatusVariant = (status: PrevisioneEntrata['stato']): 'default' | 'secondary' | 'destructive' | 'outline' => {
        switch (status) {
            case 'Incassato': return 'default';
            case 'Da incassare': return 'secondary';
            case 'Annullato': return 'destructive';
            case 'Parziale': return 'outline';
            default: return 'secondary';
        }
    };
    
    const getCertezzaVariant = (certezza: PrevisioneEntrata['certezza']): 'default' | 'secondary' | 'outline' => {
        switch (certezza) {
            case 'Certa': return 'default';
            case 'Probabile': return 'secondary';
            case 'Incerta': return 'outline';
            default: return 'secondary';
        }
    };

    const getPageTitle = () => {
        if (selectedCompany === 'Tutte') return 'Previsioni Entrate - Tutte le società';
        return `Previsioni Entrate - ${selectedCompany}`;
    };

  return (
    <div className="flex flex-col gap-6">
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
                <Button onClick={() => {}} className="flex-shrink-0">
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
                Visualizza, aggiungi e gestisci le previsioni di entrata future.
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
                            <TableHead className="text-right">IVA</TableHead>
                            <TableHead className="text-right">Importo Netto</TableHead>
                            <TableHead className="text-center">Certezza</TableHead>
                            <TableHead className="text-center">% Prob.</TableHead>
                            <TableHead className="text-right">Importo Ponderato</TableHead>
                            <TableHead className="text-center">Stato</TableHead>
                            <TableHead>Note</TableHead>
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
                                    <TableCell className="whitespace-nowrap">{formatDate(p.dataPrevista)}</TableCell>
                                    <TableCell>{p.descrizione}</TableCell>
                                    <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(p.importoLordo)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(iva)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(netto)}</TableCell>
                                    <TableCell className="text-center"><Badge variant={getCertezzaVariant(p.certezza)}>{p.certezza}</Badge></TableCell>
                                    <TableCell className="text-center">{ (p.probabilita * 100).toFixed(0) }%</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(ponderato)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={getStatusVariant(p.stato)}>{p.stato}</Badge>
                                    </TableCell>
                                    <TableCell>{p.note}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                     <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="font-bold">TOTALI</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totaleLordo)}</TableCell>
                            <TableCell colSpan={4}></TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(riepilogo.totalePonderato)}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            </CardContent>
        </Card>
        </Tabs>

         <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardHeader>
              <CardTitle>Riepilogo Previsioni {selectedCompany !== 'Tutte' ? selectedCompany : 'Totale'}</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Previsto (Lordo):</span>
                      <span className="font-medium">{formatCurrency(riepilogo.totaleLordo)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Incassato:</span>
                      <span className="font-medium text-green-600">{formatCurrency(riepilogo.totaleIncassato)}</span>
                  </div>
                  <Separator />
                   <div className="flex justify-between font-bold text-base">
                      <span className="flex items-center gap-1"><Percent className="h-4 w-4"/> Totale Ponderato:</span>
                      <span>{formatCurrency(riepilogo.totalePonderato)}</span>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
