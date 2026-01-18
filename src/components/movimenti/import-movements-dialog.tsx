// src/components/movimenti/import-movements-dialog.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, File as FileIcon, Trash2, Check } from 'lucide-react';
import type { Movimento, AppUser, CompanyProfile } from '@/lib/types';
import { importTransactions } from '@/ai/flows/import-transactions-flow';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency, formatDate, maskAccountNumber } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';

type RawRow = { id: number; data: { [key: string]: any } };
type ProcessedRow = { rawId: number; movement: Omit<Movimento, 'id'>; isProcessed: boolean };
type ImportStage = 'upload' | 'review';


const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export function ImportMovementsDialog({
  isOpen,
  setIsOpen,
  onImport,
  defaultCompany,
  currentUser,
  companies,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onImport: (movements: Omit<Movimento, 'id'>[]) => Promise<void>;
  defaultCompany?: string;
  currentUser: AppUser | null;
  companies: CompanyProfile[];
}) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const ACCEPTED_FILES = ".xlsx, .pdf, .png, .jpg, .jpeg";
  
  const clearState = () => {
    setStage('upload');
    setFile(null);
    setProcessedRows([]);
    setIsProcessing(false);
    setIsDragging(false);
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
            description: `Per favore, carica un file PDF, PNG, JPG o Excel.`,
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

  const processExcelDataClientSide = (rows: { [key: string]: any }[]): Omit<Movimento, 'id'>[] => {
    if (!currentUser) return [];

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

    return rows.map(data => {
      const description = findColumn(data, ['Descrizione operazione', 'descrizione', 'description']);
      const dateValue = findColumn(data, ['Data movimento', 'data', 'date']);
      const amountValue = findColumn(data, ['Importo', 'importo', 'amount']);
      
      if (!description || !dateValue || amountValue === undefined || amountValue === null) {
        return null;
      }
      
      // Handle Excel dates (can be numbers or strings)
      const isDateNumber = typeof dateValue === 'number';
      const jsDate = isDateNumber ? XLSX.SSF.parse_date_code(dateValue) : new Date(dateValue);
      const dataValida = !isNaN(jsDate.getTime()) ? new Date(jsDate.getUTCFullYear(), jsDate.getUTCMonth(), jsDate.getUTCDate()).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const anno = new Date(dataValida).getFullYear();

      const numericAmount = parseFloat(String(amountValue).replace(',', '.'));
      if (isNaN(numericAmount)) return null;

      const entrata = numericAmount > 0 ? numericAmount : 0;
      const uscita = numericAmount < 0 ? Math.abs(numericAmount) : 0;
      
      return {
        societa: selectedCompany,
        anno: anno,
        data: dataValida,
        descrizione: String(description),
        categoria: 'Da categorizzare',
        sottocategoria: 'Da categorizzare',
        entrata: entrata,
        uscita: uscita,
        iva: 0.22,
        conto: selectedAccount || '',
        inseritoDa: currentUser.displayName,
        operatore: `Acquisizione da ${currentUser.displayName}`,
        metodoPag: 'Importato',
        note: `Importato da file: ${file?.name}`,
        status: 'manual_review' as const,
      };
    }).filter((mov): mov is NonNullable<typeof mov> => mov !== null);
  };
  
  const handleProceed = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Nessun file selezionato' });
      return;
    }
    setIsProcessing(true);

    try {
        const isExcel = file.type.includes('spreadsheetml');

        if (isExcel) {
            const fileData = await file.arrayBuffer();
            const workbook = XLSX.read(fileData, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: { [key: string]: any }[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error("Il file Excel è vuoto o in un formato non leggibile.");
            }

            const processedMovements = processExcelDataClientSide(jsonData);
            
            const finalProcessedRows: ProcessedRow[] = processedMovements.map((mov, index) => ({
                rawId: index, 
                movement: mov,
                isProcessed: true,
            }));

            setProcessedRows(finalProcessedRows);
            setStage('review');
            toast({ title: 'Lettura Completata', description: `${processedMovements.length} movimenti pronti per la revisione.` });
        } else {
            await handleAnalyzeWithAI();
        }

    } catch (error: any) {
        console.error("Error reading file:", error);
        toast({ variant: 'destructive', title: 'Errore Lettura File', description: error.message || 'Impossibile leggere il file.' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!file || !currentUser) {
       toast({ variant: 'destructive', title: 'Errore', description: 'File o utente mancante.' });
       return;
   }
   setIsProcessing(true);
   toast({ title: 'Analisi AI in corso...', description: 'Estrazione dei dati dal documento in corso. Potrebbe richiedere un momento.'});

   try {
        const fileDataUri = await fileToBase64(file);
        const result = await importTransactions({
            fileDataUri: fileDataUri,
            fileType: file.type,
            company: selectedCompany,
            conto: selectedAccount,
            inseritoDa: currentUser.displayName,
        });

       const newProcessedRows: ProcessedRow[] = result.movements.map((mov, index) => ({
           rawId: index,
           movement: mov,
           isProcessed: true,
       }));

       setProcessedRows(newProcessedRows);
       setStage('review');
       toast({ title: 'Analisi File Completata', description: `${result.movements.length} movimenti estratti.` });

   } catch (error: any) {
       console.error("Error processing file with AI:", error);
       toast({ variant: 'destructive', title: 'Errore Analisi AI', description: error.message });
   } finally {
       setIsProcessing(false);
   }
 };

  const handleConfirmImport = async () => {
    const finalMovements = processedRows.map(pr => pr.movement);
    if (finalMovements.length === 0) {
      toast({ variant: 'destructive', title: 'Nessun movimento da importare' });
      return;
    }
    setIsProcessing(true);
    await onImport(finalMovements);
    handleClose(false);
  };
  
  const canSelectCompany = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const currentCompanyDetails = companies.find(c => c.sigla === selectedCompany);
  const companyAccounts = currentCompanyDetails?.conti || [];
  
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
  
  const renderReviewStage = () => (
     <div className="py-4 space-y-4">
        <h3 className="text-lg font-medium">Dati Estratti - Verifica e Conferma</h3>
        <p className="text-sm text-muted-foreground">
            Controlla i movimenti estratti. Verranno tutti importati e potranno essere modificati in seguito nella pagina "Da Revisionare".
        </p>
        <ScrollArea className="h-[400px] border rounded-md">
            <Table>
                <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead>Categoria</TableHead><TableHead>Entrata</TableHead><TableHead>Uscita</TableHead><TableHead>Società</TableHead><TableHead>Stato</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {processedRows.map((row, index) => (
                        <TableRow key={index} className={cn(row.movement.status === 'manual_review' && 'bg-amber-50 dark:bg-amber-900/20')}>
                            <TableCell>{formatDate(row.movement.data)}</TableCell>
                            <TableCell>{row.movement.descrizione}</TableCell>
                            <TableCell><Badge variant="outline">{row.movement.categoria}</Badge></TableCell>
                            <TableCell className="text-green-600">{row.movement.entrata > 0 ? formatCurrency(row.movement.entrata) : '-'}</TableCell>
                            <TableCell className="text-red-600">{row.movement.uscita > 0 ? formatCurrency(row.movement.uscita) : '-'}</TableCell>
                            <TableCell><Badge variant={row.movement.societa === 'LNC' ? 'default' : 'secondary'}>{row.movement.societa}</Badge></TableCell>
                             <TableCell><Badge variant={row.movement.status === 'manual_review' ? 'destructive' : 'secondary'}>{row.movement.status === 'manual_review' ? 'Da Revisionare' : 'OK'}</Badge></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Importa Movimenti da File</DialogTitle>
          <DialogDescription>
            {stage === 'upload' && "Carica un file Excel, PDF o immagine per estrarre i movimenti."}
            {stage === 'review' && "Rivedi i dati finali prima di importarli nel database."}
          </DialogDescription>
        </DialogHeader>
        
        {stage === 'upload' && renderUploadStage()}
        {stage === 'review' && renderReviewStage()}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>Annulla</Button>
           {stage === 'upload' && (
              <Button type="button" onClick={handleProceed} disabled={isProcessing || !file}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <>Procedi alla revisione</>}
              </Button>
           )}
           {stage === 'review' && (
               <Button type="button" onClick={handleConfirmImport} disabled={isProcessing || processedRows.length === 0}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Conferma e Importa ({processedRows.length})</>}
              </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
