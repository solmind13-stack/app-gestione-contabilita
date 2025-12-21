// src/app/(app)/report/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, CollectionReference } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Download, Settings, Sheet, TableIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import type { Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita, AppUser } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const getQuery = (firestore: any, user: AppUser | null, collectionName: string) => {
    if (!firestore || !user) return null;
    return query(collection(firestore, collectionName) as CollectionReference);
}

export default function ReportPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Report Configuration State
  const [company, setCompany] = useState<'Tutte' | 'LNC' | 'STG'>('Tutte');
  const [includeMovements, setIncludeMovements] = useState(true);
  const [includeDeadlines, setIncludeDeadlines] = useState(true);
  const [includeIncomeForecasts, setIncludeIncomeForecasts] = useState(false);
  const [includeExpenseForecasts, setIncludeExpenseForecasts] = useState(false);
  
  const [reportData, setReportData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Data Fetching
  const movimentiQuery = useMemo(() => getQuery(firestore, user, 'movements'), [firestore, user]);
  const scadenzeQuery = useMemo(() => getQuery(firestore, user, 'deadlines'), [firestore, user]);
  const previsioniEntrateQuery = useMemo(() => getQuery(firestore, user, 'incomeForecasts'), [firestore, user]);
  const previsioniUsciteQuery = useMemo(() => getQuery(firestore, user, 'expenseForecasts'), [firestore, user]);

  const { data: allMovements, isLoading: loadingMovements } = useCollection<Movimento>(movimentiQuery);
  const { data: allDeadlines, isLoading: loadingDeadlines } = useCollection<Scadenza>(scadenzeQuery);
  const { data: allIncomeForecasts, isLoading: loadingIncome } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: allExpenseForecasts, isLoading: loadingExpenses } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);

  const isLoading = isUserLoading || loadingMovements || loadingDeadlines || loadingIncome || loadingExpenses;

  const handleGenerateReport = () => {
    setIsGenerating(true);

    const filterByCompany = (data: any[]) => {
      if (company === 'Tutte') return data;
      return data.filter(item => item.societa === company);
    };

    const dataToDisplay = {
      movements: includeMovements ? filterByCompany(allMovements || []) : null,
      deadlines: includeDeadlines ? filterByCompany(allDeadlines || []) : null,
      incomeForecasts: includeIncomeForecasts ? filterByCompany(allIncomeForecasts || []) : null,
      expenseForecasts: includeExpenseForecasts ? filterByCompany(allExpenseForecasts || []) : null,
    };
    
    setReportData(dataToDisplay);

    setTimeout(() => {
      setIsGenerating(false);
      toast({ title: "Report Visualizzato", description: "I dati selezionati sono pronti per la revisione." });
    }, 500); // Simulate generation time
  };
  
  const handleExport = () => {
    toast({
      title: "Funzionalità in sviluppo",
      description: "L'esportazione in CSV/Excel sarà disponibile a breve.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="text-primary" />
            Costruttore di Report Personalizzati
          </CardTitle>
          <CardDescription>
            Seleziona i dati che desideri analizzare, visualizzare ed esportare.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                    <Label htmlFor="company-select">Società</Label>
                    <Select value={company} onValueChange={(v) => setCompany(v as any)}>
                        <SelectTrigger id="company-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Tutte">Tutte</SelectItem>
                            <SelectItem value="LNC">LNC</SelectItem>
                            <SelectItem value="STG">STG</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Dati da Includere</Label>
                    <div className="flex flex-wrap gap-4 items-center rounded-lg bg-muted p-3">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="include-movements" checked={includeMovements} onCheckedChange={(c) => setIncludeMovements(c as boolean)} />
                            <Label htmlFor="include-movements">Movimenti</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="include-deadlines" checked={includeDeadlines} onCheckedChange={(c) => setIncludeDeadlines(c as boolean)} />
                            <Label htmlFor="include-deadlines">Scadenze</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="include-income" checked={includeIncomeForecasts} onCheckedChange={(c) => setIncludeIncomeForecasts(c as boolean)} />
                            <Label htmlFor="include-income">Prev. Entrate</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="include-expenses" checked={includeExpenseForecasts} onCheckedChange={(c) => setIncludeExpenseForecasts(c as boolean)} />
                            <Label htmlFor="include-expenses">Prev. Uscite</Label>
                        </div>
                    </div>
                </div>
                 <Button onClick={handleGenerateReport} disabled={isLoading || isGenerating} className="w-full lg:w-auto">
                    {isGenerating || isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Caricamento...
                    </>
                    ) : (
                    <>
                        <Sheet className="mr-2 h-4 w-4" />
                        Visualizza Report
                    </>
                    )}
                </Button>
            </div>
        </CardContent>
      </Card>

      {reportData && (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Dati del Report</CardTitle>
                    <CardDescription>Società: {company} | Dati aggiornati in tempo reale.</CardDescription>
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Esporta Dati
                </Button>
            </CardHeader>
            <CardContent className="space-y-8">
                {reportData.movements && (
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><TableIcon className='h-5 w-5'/> Movimenti</h3>
                        <div className='max-h-[400px] overflow-auto border rounded-lg'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead>Categoria</TableHead><TableHead className='text-right'>Entrata</TableHead><TableHead className='text-right'>Uscita</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.movements.map((m: Movimento) => (
                                        <TableRow key={m.id}><TableCell>{formatDate(m.data)}</TableCell><TableCell>{m.descrizione}</TableCell><TableCell>{m.categoria}</TableCell><TableCell className='text-right text-green-600'>{m.entrata > 0 ? formatCurrency(m.entrata) : '-'}</TableCell><TableCell className='text-right text-red-600'>{m.uscita > 0 ? formatCurrency(m.uscita) : '-'}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                 {reportData.deadlines && (
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><TableIcon className='h-5 w-5'/> Scadenze</h3>
                         <div className='max-h-[400px] overflow-auto border rounded-lg'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data Scad.</TableHead><TableHead>Descrizione</TableHead><TableHead>Stato</TableHead><TableHead className='text-right'>Importo Previsto</TableHead><TableHead className='text-right'>Importo Pagato</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.deadlines.map((d: Scadenza) => (
                                        <TableRow key={d.id}><TableCell>{formatDate(d.dataScadenza)}</TableCell><TableCell>{d.descrizione}</TableCell><TableCell>{d.stato}</TableCell><TableCell className='text-right'>{formatCurrency(d.importoPrevisto)}</TableCell><TableCell className='text-right'>{formatCurrency(d.importoPagato)}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                 {reportData.incomeForecasts && (
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><TableIcon className='h-5 w-5'/> Previsioni Entrate</h3>
                        <div className='max-h-[400px] overflow-auto border rounded-lg'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data Prev.</TableHead><TableHead>Descrizione</TableHead><TableHead>Stato</TableHead><TableHead className='text-right'>Importo Lordo</TableHead><TableHead className='text-center'>Probabilità</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.incomeForecasts.map((f: PrevisioneEntrata) => (
                                        <TableRow key={f.id}><TableCell>{formatDate(f.dataPrevista)}</TableCell><TableCell>{f.descrizione}</TableCell><TableCell>{f.stato}</TableCell><TableCell className='text-right'>{formatCurrency(f.importoLordo)}</TableCell><TableCell className='text-center'>{(f.probabilita*100).toFixed(0)}%</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                 {reportData.expenseForecasts && (
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><TableIcon className='h-5 w-5'/> Previsioni Uscite</h3>
                         <div className='max-h-[400px] overflow-auto border rounded-lg'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data Scad.</TableHead><TableHead>Descrizione</TableHead><TableHead>Stato</TableHead><TableHead className='text-right'>Importo Lordo</TableHead><TableHead className='text-center'>Probabilità</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.expenseForecasts.map((f: PrevisioneUscita) => (
                                        <TableRow key={f.id}><TableCell>{formatDate(f.dataScadenza)}</TableCell><TableCell>{f.descrizione}</TableCell><TableCell>{f.stato}</TableCell><TableCell className='text-right'>{formatCurrency(f.importoLordo)}</TableCell><TableCell className='text-center'>{(f.probabilita*100).toFixed(0)}%</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                 {!reportData.movements && !reportData.deadlines && !reportData.incomeForecasts && !reportData.expenseForecasts && (
                    <div className="text-center text-muted-foreground py-10">
                        <p>Nessun dato da visualizzare per i filtri selezionati.</p>
                    </div>
                 )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
