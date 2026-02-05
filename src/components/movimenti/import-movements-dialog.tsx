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
import type { Movimento, AppUser, CompanyProfile } from '@/lib/types';
import { importTransactions } from '@/ai/flows/import-transactions-flow';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency, formatDate, maskAccountNumber } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';
import { doc, writeBatch } from 'firebase/firestore';


type ImportStage = 'upload' | 'review' | 'ai_progress' | 'final_review';

export function ImportMovementsDialog({
  isOpen,
  setIsOpen,
  onImport,
  defaultCompany,
  currentUser,
  companies,
  allMovements,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onImport: (movements: Omit<Movimento, 'id'>[]) => Promise<Movimento[]>;
  defaultCompany?: string;
  currentUser: AppUser | null;
  companies: CompanyProfile[];
  categories: any;
  allMovements: Movimento[];
}) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [processedRows, setProcessedRows] = useState<(Omit<Movimento, 'id'> & { isDuplicate?: boolean })[]>([]);
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

        const existingMovementKeys = new Set(
            (allMovements || []).map(mov => `${mov.data}_${mov.descrizione.trim().toLowerCase()}_${mov.entrata}_${mov.uscita}`)
        );

        const checkedRows = processed.map(row => {
            const key = `${row.data}_${row.descrizione.trim().toLowerCase()}_${row.entrata}_${row.uscita}`;
            return {
              ...row,
              isDuplicate: existingMovementKeys.has(key),
            };
        });

        setProcessedRows(checkedRows);
        setStage('review');

        const duplicateCount = checkedRows.filter(r => r.isDuplicate).length;
        
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
            const result = await import('/ai/flows/categorize-transactions-with-ai-suggestions').then(m => m.categorizeTransaction({ description: movement.descrizione }));
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
  
  const { nonDuplicateRows, duplicateRows } = useMemo(() => {
    return {
        nonDuplicateRows: processedRows.filter(r => !r.isDuplicate),
        duplicateRows: processedRows.filter(r => r.isDuplicate),
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
  
  const renderReviewStage = (title: string, description: string, movements: (Omit<Movimento, 'id'> & { isDuplicate?: boolean })[], isFinal: boolean) => (
     <div className="py-4 space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <ScrollArea className="h-[60vh] border rounded-md">
            <Table className="table-fixed w-full">
                <TableHeader><TableRow>
                    <TableHead className="w-[10%]">Data</TableHead>
                    <TableHead className="w-[35%]">Descrizione</TableHead>
                    <TableHead className="w-[12%]">Categoria</TableHead>
                    <TableHead className="w-[10%]">Metodo Pag.</TableHead>
                    <TableHead className="w-[8%] text-right">Entrata</TableHead>
                    <TableHead className="w-[8%] text-right">Uscita</TableHead>
                    <TableHead className="w-[7%] text-center">Società</TableHead>
                    <TableHead className="w-[10%] text-center">Stato</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {movements.map((row, index) => (
                        <TableRow key={index} className={cn(
                          'text-sm',
                          row.status === 'manual_review' && !row.isDuplicate && 'bg-amber-50 dark:bg-amber-900/20',
                          row.isDuplicate && 'bg-red-50 dark:bg-red-900/20'
                        )}>
                            <TableCell className="whitespace-nowrap py-2 px-2">{formatDate(row.data)}</TableCell>
                            <TableCell className="break-words py-2 px-2">
                              {row.descrizione}
                            </TableCell>
                            <TableCell className="py-2 px-2"><Badge variant="outline" className="whitespace-nowrap">{row.categoria}</Badge></TableCell>
                            <TableCell className="py-2 px-2">{row.metodoPag}</TableCell>
                            <TableCell className="text-right text-green-600 whitespace-nowrap py-2 px-2">{row.entrata > 0 ? formatCurrency(row.entrata) : '-'}</TableCell>
                            <TableCell className="text-right text-red-600 whitespace-nowrap py-2 px-2">{row.uscita > 0 ? formatCurrency(row.uscita) : '-'}</TableCell>
                            <TableCell className="text-center py-2 px-2"><Badge variant={row.societa === 'LNC' ? 'default' : 'secondary'}>{row.societa}</Badge></TableCell>
                            <TableCell className="text-center py-2 px-2">
                              {row.isDuplicate ? (
                                <Badge variant="destructive">Duplicato</Badge>
                              ) : (
                                <Badge variant={row.status === 'manual_review' ? 'destructive' : 'default'} className={cn(row.status === 'ok' && 'bg-green-600', 'whitespace-nowrap')}>
                                    {row.status === 'manual_review' ? 'Da Revisionare' : 'OK'}
                                </Badge>
                              )}
                            </TableCell>
                        </TableRow>
                    ))}
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
