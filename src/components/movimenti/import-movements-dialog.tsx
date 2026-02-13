// src/components/movimenti/import-movements-dialog.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useFirestore, useUser } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, File as FileIcon, Trash2, Check, Wand2 } from 'lucide-react';
import type { Movimento, AppUser, CompanyProfile, LinkableItem, Scadenza, PrevisioneUscita, PrevisioneEntrata } from '@/lib/types';
import { importTransactions } from '@/ai/flows/import-transactions-flow';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency, formatDate, maskAccountNumber, parseDate } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';
import { doc, writeBatch } from 'firebase/firestore';


type ImportStage = 'upload' | 'review' | 'ai_progress' | 'final_review';

const getJaccardIndex = (str1: string, str2: string): number => {
    const noise = new Set(['e', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'col', 'coi', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'pagamento', 'fattura', 'accredito', 'addebito', 'sdd', 'rata', 'canone', 'ft', 'rif', 'n', 'num', 'vs']);
    const clean = (s: string) => s.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s{2,}/g," ").split(' ').filter(w => w.length > 2 && !noise.has(w));
    const set1 = new Set(clean(str1));
    const set2 = new Set(clean(str2));
    if (set1.size === 0 || set2.size === 0) return 0;
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
};

const calculateSimilarity = (item: LinkableItem, movement: Omit<Movimento, 'id'>): number => {
    const { societa, descrizione, categoria, sottocategoria, data: paymentDateStr } = movement;
    const importo = movement.entrata > 0 ? movement.entrata : movement.uscita;

    if (!societa || !importo || importo === 0 || !descrizione || !paymentDateStr) return 0;
    if (item.societa !== societa) return -1;

    let score = 0;
    const OVERDUE_BASE_SCORE = 1000;
    const FUTURE_BASE_SCORE = 500;

    // 1. Date Proximity and Priority
    try {
        const paymentDate = parseDate(paymentDateStr);
        const itemDate = parseDate(item.date);
        const diffDays = (paymentDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);

        if (diffDays >= 0) { // Overdue or on the same day
            score += OVERDUE_BASE_SCORE - (diffDays / 30);
        } else { // Future item
            const futureDiff = Math.abs(diffDays);
            if (futureDiff > 90) return 0;
            score += FUTURE_BASE_SCORE - futureDiff;
        }
    } catch (e) {
        return 0;
    }
    
    // 2. Amount Similarity
    if (item.amount && importo) {
        const difference = Math.abs(item.amount - importo);
        if (difference < 0.02) { score += 100; }
        else { score += Math.max(0, 50 - (difference / item.amount) * 100); }
    }
    
    // 3. Description Similarity
    score += getJaccardIndex(descrizione, item.description) * 50;
    
    if (categoria && item.category === categoria) score += 20;
    if (sottocategoria && item.subcategory === sottocategoria) score += 10;

    return score;
  };


export function ImportMovementsDialog({
  isOpen,
  setIsOpen,
  onImport,
  defaultCompany,
  currentUser,
  companies,
  allMovements,
  deadlines,
  expenseForecasts,
  incomeForecasts,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onImport: (movements: Omit<Movimento, 'id'>[]) => Promise<Movimento[]>;
  defaultCompany?: string;
  currentUser: AppUser | null;
  companies: CompanyProfile[];
  categories: any;
  allMovements: Movimento[];
  deadlines: Scadenza[];
  expenseForecasts: PrevisioneUscita[];
  incomeForecasts: PrevisioneEntrata[];
}) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [processedRows, setProcessedRows] = useState<(Omit<Movimento, 'id'> & { isDuplicate?: boolean, linkedTo?: string })[]>([]);
  const [importedMovements, setImportedMovements] = useState<Movimento[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isDuplicateFileAlertOpen, setIsDuplicateFileAlertOpen] = useState(false);

  const SUPPORTED_MIME_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'image/png', 'image/jpeg'];
  const ACCEPTED_FILES = ".xlsx,.pdf,.png,.jpg,.jpeg";
  
  const clearState = () => {
    setStage('upload');
    setFile(null);
    setProcessedRows([]);
    setImportedMovements([]);
    setIsProcessing(false);
    setIsDragging(false);
    setIsDuplicateFileAlertOpen(false);
  };
  
  const handleClose = (open: boolean) => {
    if (!open) {
      clearState();
    }
    setIsOpen(open);
  }

  useEffect(() => {
    if(isOpen) {
        if (currentUser?.role === 'company' || currentUser?.role === 'company-editor') {
            setSelectedCompany(currentUser.company!);
        } else if (defaultCompany && defaultCompany !== 'Tutte') {
            setSelectedCompany(defaultCompany);
        } else if (companies && companies.length > 0) {
            setSelectedCompany(companies[0].sigla);
        }
    } else {
        clearState();
    }
  }, [isOpen, currentUser, defaultCompany, companies]);

  useEffect(() => {
    const company = companies.find(c => c.sigla === selectedCompany);
    if (company) {
        const accounts = company.conti || [];
        setSelectedAccount(accounts.length > 0 ? accounts[0] : '');
    } else {
        setSelectedAccount('');
    }
  }, [selectedCompany, companies]);
  
  const validateFile = (file: File) => {
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
        toast({
            variant: 'destructive',
            title: 'Formato File Non Supportato',
            description: `Per favore, carica un file Excel (.xlsx), PDF o immagine (.png, .jpg).`,
        });
        return false;
    }
    return true;
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isOver: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(isOver);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile && validateFile(droppedFile)) {
          setFile(droppedFile);
      }
  };

  const linkableItems = useMemo((): LinkableItem[] => {
      const items: LinkableItem[] = [];
      (deadlines || []).filter(d => d.stato !== 'Pagato' && d.stato !== 'Annullato').forEach(d => items.push({ id: d.id, type: 'deadlines', description: d.descrizione, date: d.dataScadenza, amount: d.importoPrevisto - d.importoPagato, societa: d.societa, category: d.categoria, subcategory: d.sottocategoria || '' }));
      (expenseForecasts || []).filter(f => f.stato !== 'Pagato' && f.stato !== 'Annullato').forEach(f => items.push({ id: f.id, type: 'expenseForecasts', description: f.descrizione, date: f.dataScadenza, amount: f.importoLordo - (f.importoEffettivo || 0), societa: f.societa, category: f.categoria, subcategory: f.sottocategoria }));
      (incomeForecasts || []).filter(f => f.stato !== 'Incassato' && f.stato !== 'Annullato').forEach(f => items.push({ id: f.id, type: 'incomeForecasts', description: f.descrizione, date: f.dataPrevista, amount: f.importoLordo - (f.importoEffettivo || 0), societa: f.societa, category: f.categoria, subcategory: f.sottocategoria }));
      return items;
  }, [deadlines, expenseForecasts, incomeForecasts]);

  const processFile = async () => {
    if (!file || !currentUser) return;
    setIsProcessing(true);
    try {
        let result: { movements: (Omit<Movimento, 'id'>)[] };

        if (file.type.includes('spreadsheetml')) {
            const fileData = await file.arrayBuffer();
            const workbook = XLSX.read(fileData, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error("Il file Excel è vuoto o in un formato non leggibile.");
            }

            result = await importTransactions({
                textContent: JSON.stringify(jsonData),
                fileType: file.type,
                company: selectedCompany,
                conto: selectedAccount,
                inseritoDa: currentUser.displayName!,
            });
        } else { // PDF or Image
            const fileDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target?.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });

            result = await importTransactions({
                fileDataUri: fileDataUri,
                fileType: file.type,
                company: selectedCompany,
                conto: selectedAccount,
                inseritoDa: currentUser.displayName!,
            });
        }
        
        const processed = result.movements;

        const existingMovementKeys = new Set((allMovements || []).map(mov => `${mov.data}_${mov.descrizione.trim().toLowerCase()}_${mov.entrata}_${mov.uscita}`));
        const processedKeys = new Set();
        
        const checkedAndLinkedRows = processed.map(row => {
            const key = `${row.data}_${row.descrizione.trim().toLowerCase()}_${row.entrata}_${row.uscita}`;
            const isDbDuplicate = existingMovementKeys.has(key);
            const isBatchDuplicate = processedKeys.has(key);
            if (!isBatchDuplicate) {
                processedKeys.add(key);
            }

            let bestMatch: { item: LinkableItem, score: number } | null = null;
            if (!isDbDuplicate && !isBatchDuplicate) {
                const itemsForCompany = linkableItems.filter(item => item.societa === row.societa && ((row.uscita > 0 && (item.type === 'deadlines' || item.type === 'expenseForecasts')) || (row.entrata > 0 && item.type === 'incomeForecasts')));
                
                if (itemsForCompany.length > 0) {
                    const scoredItems = itemsForCompany
                        .map(item => ({ item, score: calculateSimilarity(item, row) }))
                        .sort((a, b) => {
                            if (a.score > b.score) return -1;
                            if (a.score < b.score) return 1;
                            try {
                                return parseDate(a.item.date).getTime() - parseDate(b.item.date).getTime();
                            } catch {
                                return 0;
                            }
                        });

                    if (scoredItems.length > 0 && scoredItems[0].score > 80) { // Similarity threshold
                        bestMatch = scoredItems[0];
                    }
                }
            }

            return {
              ...row,
              isDuplicate: isDbDuplicate || isBatchDuplicate,
              linkedTo: bestMatch ? `${bestMatch.item.type}/${bestMatch.id}` : undefined,
            };
        });

        setProcessedRows(checkedAndLinkedRows);
        setStage('review');

        const duplicateCount = checkedAndLinkedRows.filter(r => r.isDuplicate).length;
        
        toast({
            title: 'Lettura Completata',
            description: `${processed.length} movimenti pronti per la revisione.` + (duplicateCount > 0 ? ` Attenzione: ${duplicateCount} possibili duplicati trovati.` : ''),
            duration: 7000
        });

    } catch (error: any) {
        console.error("Error processing file:", error);
        toast({ variant: 'destructive', title: 'Errore Lettura File', description: error.message || 'Impossibile leggere il file.' });
    } finally {
        setIsProcessing(false);
    }
  }

  const handleStartProcessing = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Nessun file selezionato' });
      return;
    }

    const wasFileImported = allMovements.some(mov => mov.note === `Importato da file: ${file.name}`);
    if (wasFileImported) {
        setIsDuplicateFileAlertOpen(true);
    } else {
        await processFile();
    }
  };
  
  const handleImport = async (movementsToImport: typeof processedRows) => {
    if (movementsToImport.length === 0) {
      toast({ variant: 'destructive', title: 'Nessun movimento da importare' });
      return;
    }
    setIsProcessing(true);
    try {
      const newMovements = await onImport(movementsToImport);
      setImportedMovements(newMovements);
      setStage('ai_progress');
      toast({ title: "Importazione Riuscita", description: "Ora puoi avviare l'analisi AI per la categorizzazione." });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Importazione fallita.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartAiAnalysis = async () => {
    if (!firestore || importedMovements.length === 0) return;
    
    setIsProcessing(true);
    toast({ title: 'Analisi AI in corso...', description: `Analizzo ${importedMovements.length} movimenti.` });

    const updatedMovements = [...importedMovements];
    const batch = writeBatch(firestore);

    for (let i = 0; i < importedMovements.length; i++) {
        const movement = importedMovements[i];
        try {
            const result = await import('@/ai/flows/categorize-transactions-with-ai-suggestions').then(m => m.categorizeTransaction({ description: movement.descrizione }));
            if (result && result.category && result.category !== 'Da categorizzare') {
                const updatedMov = { 
                    ...movement, 
                    categoria: result.category, 
                    sottocategoria: result.subcategory,
                    iva: result.ivaPercentage,
                    metodoPag: result.metodoPag,
                    status: 'ok' as const 
                };
                updatedMovements[i] = updatedMov;
                
                const movRef = doc(firestore, 'movements', movement.id);
                batch.update(movRef, {
                    categoria: result.category,
                    sottocategoria: result.subcategory,
                    iva: result.ivaPercentage,
                    metodoPag: result.metodoPag,
                    status: 'ok'
                });
            }
        } catch (error) {
            console.error(`Error categorizing movement ${movement.id}:`, error);
        }
    }

    try {
        await batch.commit();
        setImportedMovements(updatedMovements);
        setStage('final_review');
        toast({ title: 'Analisi Completata!', description: 'Le categorie sono state aggiornate.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile salvare le categorie aggiornate.' });
    } finally {
        setIsProcessing(false);
    }
};

  
  const canSelectCompany = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const currentCompanyDetails = companies.find(c => c.sigla === selectedCompany);
  const companyAccounts = currentCompanyDetails?.conti || [];
  
  const { nonDuplicateRows } = useMemo(() => {
    return {
        nonDuplicateRows: processedRows.filter(r => !r.isDuplicate),
    }
  }, [processedRows]);

  const renderUploadStage = () => (
     <div className="py-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="company-select">Importa per la società</Label>
                <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)} disabled={!canSelectCompany}>
                    <SelectTrigger id="company-select"><SelectValue placeholder="Seleziona società..." /></SelectTrigger>
                    <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="account-select">Associa al conto (Opzionale)</Label>
                {companyAccounts.length > 1 ? (
                    <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={!selectedCompany}>
                        <SelectTrigger id="account-select"><SelectValue placeholder="Seleziona conto..." /></SelectTrigger>
                        <SelectContent>{companyAccounts.map(acc => <SelectItem key={acc} value={acc}>{maskAccountNumber(acc)}</SelectItem>)}</SelectContent>
                    </Select>
                ) : ( <Input id="account-select" value={companyAccounts.length === 1 ? maskAccountNumber(companyAccounts[0]) : "Nessun conto definito"} disabled />)}
            </div>
        </div>
         <div className="flex items-center justify-center w-full" onDragOver={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDrop={handleDrop}>
            <label htmlFor="dropzone-file" className={cn("flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80", isDragging && "border-primary bg-primary/10")}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clicca per caricare</span> o trascina il file</p>
                    <p className="text-xs text-muted-foreground">XLSX, PDF, PNG, JPG</p>
                </div>
                <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept={ACCEPTED_FILES} />
            </label>
        </div> 
        {file && (
            <div className="mt-4 flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div className='flex items-center gap-2'><FileIcon className="h-5 w-5 text-muted-foreground" /><span className="text-sm font-medium">{file.name}</span></div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
        )}
    </div>
  );
  
  const renderReviewStage = (title: string, description: string, movements: (Omit<Movimento, 'id'> & { isDuplicate?: boolean, linkedTo?: string })[], isFinal: boolean) => (
     <div className="py-4 space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <ScrollArea className="h-[60vh] border rounded-md">
            <Table className="table-fixed w-full">
                <TableHeader><TableRow>
                    <TableHead className="w-[10%]">Data</TableHead>
                    <TableHead className="w-[25%]">Descrizione</TableHead>
                    <TableHead className="w-[20%]">Collegamento Suggerito</TableHead>
                    <TableHead className="w-[8%] text-right">Entrata</TableHead>
                    <TableHead className="w-[8%] text-right">Uscita</TableHead>
                    <TableHead className="w-[7%] text-center">Società</TableHead>
                    <TableHead className="w-[10%] text-center">Stato</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {movements.map((row, index) => {
                        const linkedItem = row.linkedTo ? linkableItems.find(item => `${item.type}/${item.id}` === row.linkedTo) : null;
                        return (
                        <TableRow key={index} className={cn('text-sm', row.isDuplicate && 'bg-red-50 dark:bg-red-900/20')}>
                            <TableCell className="whitespace-nowrap py-2 px-2">{formatDate(row.data)}</TableCell>
                            <TableCell className="break-words py-2 px-2">{row.descrizione}</TableCell>
                            <TableCell className="py-2 px-2">
                                {linkedItem ? <Badge variant="secondary" className="bg-green-100 text-green-800 whitespace-normal">{linkedItem.description}</Badge> : 'Nessuno'}
                            </TableCell>
                            <TableCell className="text-right text-green-600 whitespace-nowrap py-2 px-2">{row.entrata > 0 ? formatCurrency(row.entrata) : '-'}</TableCell>
                            <TableCell className="text-right text-red-600 whitespace-nowrap py-2 px-2">{row.uscita > 0 ? formatCurrency(row.uscita) : '-'}</TableCell>
                            <TableCell className="text-center py-2 px-2"><Badge variant={row.societa === 'LNC' ? 'default' : 'secondary'}>{row.societa}</Badge></TableCell>
                            <TableCell className="text-center py-2 px-2">
                              {row.isDuplicate ? <Badge variant="destructive">Duplicato</Badge> : <Badge variant="outline">Nuovo</Badge>}
                            </TableCell>
                        </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl">
         <AlertDialog open={isDuplicateFileAlertOpen} onOpenChange={setIsDuplicateFileAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>File Già Importato?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Un file con nome "{file?.name}" sembra essere già stato importato. Importarlo di nuovo potrebbe creare movimenti duplicati. Vuoi procedere comunque?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                        setIsDuplicateFileAlertOpen(false);
                        await processFile();
                    }}>
                        Procedi Comunque
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <DialogHeader>
          <DialogTitle>Importa Movimenti da File</DialogTitle>
           <DialogDescription>
            {stage === 'upload' && "Carica un file (Excel, PDF, immagine) per estrarre i movimenti."}
            {stage === 'review' && "Rivedi i dati estratti prima di salvarli nel database."}
            {stage === 'ai_progress' && "I movimenti sono stati importati. Ora puoi avviare l'analisi AI per la categorizzazione."}
            {stage === 'final_review' && "Analisi AI completata. Rivedi i risultati finali."}
          </DialogDescription>
        </DialogHeader>
        
        {stage === 'upload' && renderUploadStage()}
        {stage === 'review' && renderReviewStage("Dati Estratti - Verifica e Conferma", "Controlla i movimenti estratti. I duplicati sono evidenziati in rosso. Scegli se importare tutto o solo i nuovi movimenti.", processedRows, false)}
        {stage === 'ai_progress' && renderReviewStage("Analisi AI", "I movimenti sono stati importati. Ora puoi avviare l'analisi AI.", importedMovements, false)}
        {stage === 'final_review' && renderReviewStage("Risultati Analisi", "L'AI ha aggiornato le categorie. I movimenti non classificati restano 'Da Revisionare'.", importedMovements, true)}

        <DialogFooter className="gap-2">
          {stage !== 'final_review' && <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>Annulla</Button>}
           
           {stage === 'upload' && (
              <Button type="button" onClick={handleStartProcessing} disabled={isProcessing || !file}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <>Procedi alla revisione</>}
              </Button>
           )}
           {stage === 'review' && (
               <>
                <Button type="button" variant="secondary" onClick={() => handleImport(nonDuplicateRows)} disabled={isProcessing || nonDuplicateRows.length === 0}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : <>Importa solo Nuovi ({nonDuplicateRows.length})</>}
                </Button>
                 <Button type="button" onClick={() => handleImport(processedRows)} disabled={isProcessing || processedRows.length === 0}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Importa Tutti ({processedRows.length})</>}
                </Button>
               </>
           )}
           {stage === 'ai_progress' && (
               <Button type="button" onClick={handleStartAiAnalysis} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <><Wand2 className="mr-2 h-4 w-4" />Avvia Analisi AI</>}
              </Button>
           )}
            {stage === 'final_review' && (
               <Button type="button" onClick={() => handleClose(false)}>
                <Check className="mr-2 h-4 w-4" />
                Chiudi
              </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
