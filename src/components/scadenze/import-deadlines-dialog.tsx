// src/components/scadenze/import-deadlines-dialog.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
import { Loader2, UploadCloud, File as FileIcon, Trash2, Check } from 'lucide-react';
import type { Scadenza, AppUser, CompanyProfile } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';

type ImportStage = 'upload' | 'review';

export function ImportDeadlinesDialog({
  isOpen,
  setIsOpen,
  onImport,
  defaultCompany,
  currentUser,
  companies,
  allDeadlines,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onImport: (deadlines: Omit<Scadenza, 'id'>[]) => Promise<Scadenza[]>;
  defaultCompany?: string;
  currentUser: AppUser | null;
  companies: CompanyProfile[];
  allDeadlines: Scadenza[];
}) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [processedRows, setProcessedRows] = useState<(Omit<Scadenza, 'id'> & { isDuplicate?: boolean })[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const [isDuplicateFileAlertOpen, setIsDuplicateFileAlertOpen] = useState(false);
  
  const clearState = () => {
    setStage('upload');
    setFile(null);
    setProcessedRows([]);
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

  const validateFile = (file: File) => {
    if (!file.type.includes('spreadsheetml')) { // Temporarily only allow excel
        toast({
            variant: 'destructive',
            title: 'Formato File Non Supportato',
            description: `Per favore, carica un file Excel (.xlsx). PDF e immagini saranno supportati a breve.`,
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

  const processFileContent = async () => {
    if (!file || !currentUser) return;
    setIsProcessing(true);
    try {
        const fileData = await file.arrayBuffer();
        const workbook = XLSX.read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: { [key: string]: any }[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        if (!jsonData || jsonData.length === 0) {
            throw new Error("Il file Excel è vuoto o in un formato non leggibile.");
        }

        const findColumn = (data: {[key: string]: any}, possibleKeys: string[]): any => {
            const dataKeys = Object.keys(data).map(k => k.toLowerCase().trim());
            for (const key of possibleKeys) {
                const lowerKey = key.toLowerCase().trim();
                const dataKeyIndex = dataKeys.indexOf(lowerKey);
                if (dataKeyIndex !== -1) {
                    const originalKey = Object.keys(data)[dataKeyIndex];
                    return data[originalKey];
                }
            }
            return undefined;
        };
  
        const processed = jsonData.map(data => {
            const description = findColumn(data, ['descrizione', 'description']);
            const dateValue = findColumn(data, ['data scadenza', 'data', 'date']);
            const amountValue = findColumn(data, ['importo', 'importo previsto', 'amount']);
            
            if (!description || !dateValue || amountValue === undefined || amountValue === null) {
              return null;
            }
            
            const isDateNumber = typeof dateValue === 'number';
            const jsDate = isDateNumber ? XLSX.SSF.parse_date_code(dateValue) : new Date(dateValue);
            const dataValida = !isNaN(jsDate.getTime()) ? new Date(jsDate.getUTCFullYear(), jsDate.getUTCMonth(), jsDate.getUTCDate()).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            const anno = new Date(dataValida).getFullYear();
      
            const numericAmount = parseFloat(String(amountValue).replace(',', '.'));
            if (isNaN(numericAmount) || numericAmount <= 0) return null;
      
            return {
              societa: selectedCompany,
              anno,
              dataScadenza: dataValida,
              descrizione: String(description),
              categoria: 'Da categorizzare',
              sottocategoria: 'Da categorizzare',
              importoPrevisto: numericAmount,
              importoPagato: 0,
              stato: 'Da pagare' as const,
              ricorrenza: 'Nessuna' as const,
              note: `Importato da file: ${file?.name}`,
              createdBy: currentUser.uid,
            };
        }).filter((d): d is NonNullable<typeof d> => d !== null);

        const existingDeadlineKeys = new Set(
            (allDeadlines || []).map(d => `${d.dataScadenza}_${d.descrizione.trim().toLowerCase()}_${d.importoPrevisto}`)
        );

        const checkedRows = processed.map(row => {
            const key = `${row.dataScadenza}_${row.descrizione.trim().toLowerCase()}_${row.importoPrevisto}`;
            return {
              ...row,
              isDuplicate: existingDeadlineKeys.has(key),
            };
        });

        setProcessedRows(checkedRows);
        setStage('review');

        const duplicateCount = checkedRows.filter(r => r.isDuplicate).length;
        
        toast({
            title: 'Lettura Completata',
            description: `${processed.length} scadenze pronte per la revisione.` + (duplicateCount > 0 ? ` Attenzione: ${duplicateCount} possibili duplicati trovati.` : ''),
            duration: 7000
        });

    } catch (error: any) {
        console.error("Error reading file:", error);
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

    const wasFileImported = allDeadlines.some(d => d.note === `Importato da file: ${file.name}`);
    if (wasFileImported) {
        setIsDuplicateFileAlertOpen(true);
    } else {
        await processFileContent();
    }
  };
  
  const handleImport = async (deadlinesToImport: typeof processedRows) => {
    if (deadlinesToImport.length === 0) {
      toast({ variant: 'destructive', title: 'Nessuna scadenza da importare' });
      return;
    }
    setIsProcessing(true);
    try {
      await onImport(deadlinesToImport);
      setIsOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Importazione fallita.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const canSelectCompany = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  
  const { nonDuplicateRows } = useMemo(() => {
    return {
        nonDuplicateRows: processedRows.filter(r => !r.isDuplicate),
    }
  }, [processedRows]);

  const renderUploadStage = () => (
     <div className="py-8 space-y-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="company-select">Importa per la società</Label>
            <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v)} disabled={!canSelectCompany}>
                <SelectTrigger id="company-select"><SelectValue placeholder="Seleziona società..." /></SelectTrigger>
                <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
        </div>
         <div className="flex items-center justify-center w-full" onDragOver={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDrop={handleDrop}>
            <label htmlFor="dropzone-file" className={cn("flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80", isDragging && "border-primary bg-primary/10")}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clicca per caricare</span> o trascina il file</p>
                    <p className="text-xs text-muted-foreground">Solo file Excel (.xlsx)</p>
                </div>
                <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx" />
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
  
  const renderReviewStage = () => (
     <div className="py-4 space-y-4">
        <p className="text-sm text-muted-foreground">Controlla le scadenze estratte. Quelle già presenti nel database sono evidenziate in rosso. Scegli se importare tutto o solo le nuove.</p>
        <ScrollArea className="h-[60vh] border rounded-md">
            <Table>
                <TableHeader><TableRow>
                    <TableHead>Data Scad.</TableHead><TableHead>Descrizione</TableHead><TableHead>Importo</TableHead><TableHead>Società</TableHead><TableHead>Stato</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {processedRows.map((row, index) => (
                        <TableRow key={index} className={cn(row.isDuplicate && 'bg-red-50 dark:bg-red-900/20')}>
                            <TableCell>{formatDate(row.dataScadenza)}</TableCell>
                            <TableCell>{row.descrizione}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.importoPrevisto)}</TableCell>
                            <TableCell><Badge variant={row.societa === 'LNC' ? 'default' : 'secondary'}>{row.societa}</Badge></TableCell>
                            <TableCell>
                              {row.isDuplicate && <Badge variant="destructive">Duplicato</Badge>}
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
      <DialogContent className="max-w-4xl">
         <AlertDialog open={isDuplicateFileAlertOpen} onOpenChange={setIsDuplicateFileAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>File Già Importato?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Un file con nome "{file?.name}" sembra essere già stato importato. Importarlo di nuovo potrebbe creare scadenze duplicate. Vuoi procedere comunque?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                        setIsDuplicateFileAlertOpen(false);
                        await processFileContent();
                    }}>
                        Procedi Comunque
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <DialogHeader>
          <DialogTitle>Importa Scadenze da File</DialogTitle>
           <DialogDescription>
            {stage === 'upload' && "Carica un file Excel (.xlsx) per estrarre le scadenze."}
            {stage === 'review' && "Rivedi i dati estratti prima di salvarli nel database."}
          </DialogDescription>
        </DialogHeader>
        
        {stage === 'upload' && renderUploadStage()}
        {stage === 'review' && renderReviewStage()}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>Annulla</Button>
           
           {stage === 'upload' && (
              <Button type="button" onClick={handleStartProcessing} disabled={isProcessing || !file}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <>Procedi alla revisione</>}
              </Button>
           )}
           {stage === 'review' && (
               <>
                <Button type="button" variant="secondary" onClick={() => handleImport(nonDuplicateRows)} disabled={isProcessing || nonDuplicateRows.length === 0}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : <>Importa solo Nuove ({nonDuplicateRows.length})</>}
                </Button>
                 <Button type="button" onClick={() => handleImport(processedRows)} disabled={isProcessing || processedRows.length === 0}>
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Importa Tutti ({processedRows.length})</>}
                </Button>
               </>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
