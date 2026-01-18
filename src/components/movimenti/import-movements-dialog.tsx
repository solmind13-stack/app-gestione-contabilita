// src/components/movimenti/import-movements-dialog.tsx
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Loader2, UploadCloud, File, Trash2, Wand2 } from 'lucide-react';
import type { Movimento, AppUser, CompanyProfile, CategoryData } from '@/lib/types';
import { importTransactions } from '@/ai/flows/import-transactions-flow';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency, formatDate, maskAccountNumber } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';

interface ImportMovementsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onImport: (movements: Omit<Movimento, 'id'>[]) => Promise<void>;
  defaultCompany?: string;
  currentUser: AppUser | null;
  companies: CompanyProfile[];
  categories: CategoryData;
}

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
}: ImportMovementsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedMovements, setExtractedMovements] = useState<Omit<Movimento, 'id'>[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const ACCEPTED_FILES = ".xlsx, .pdf, .png, .jpg, .jpeg";


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

  useEffect(() => {
    if(isOpen) {
        if (currentUser?.role === 'company' || currentUser?.role === 'company-editor') {
            setSelectedCompany(currentUser.company!);
        } else if (defaultCompany && defaultCompany !== 'Tutte') {
            setSelectedCompany(defaultCompany);
        } else if (companies && companies.length > 0) {
            setSelectedCompany(companies[0].sigla);
        }
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

  const handleProcessFile = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Nessun file selezionato' });
      return;
    }
    if (!selectedCompany) {
        toast({ variant: 'destructive', title: 'Nessuna società selezionata' });
        return;
    }
     if (!currentUser) {
        toast({ variant: 'destructive', title: 'Utente non autenticato' });
        return;
    }
    setIsProcessing(true);
    setExtractedMovements([]);

    try {
        let result;
        const basePayload = {
            fileType: file.type,
            company: selectedCompany,
            conto: selectedAccount,
            inseritoDa: currentUser.displayName,
        };

        const isExcel = file.type.includes('spreadsheetml');

        if (isExcel) {
            const fileData = await file.arrayBuffer();
            const workbook = XLSX.read(fileData);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet); 
            const textContent = JSON.stringify(json, null, 2);
            
            result = await importTransactions({
                ...basePayload,
                textContent: textContent,
            });
        } else {
            const fileDataUri = await fileToBase64(file);
            result = await importTransactions({
                ...basePayload,
                fileDataUri: fileDataUri,
            });
        }

      setExtractedMovements(result.movements);
      toast({ title: 'Analisi completata', description: `${result.movements.length} movimenti estratti dal file.` });

    } catch (error: any) {
      console.error("Error processing file with AI:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Errore durante l\'analisi', 
        description: error.message || 'Impossibile estrarre i movimenti dal file.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (extractedMovements.length === 0) {
      toast({ variant: 'destructive', title: 'Nessun movimento da importare' });
      return;
    }
    setIsProcessing(true);
    await onImport(extractedMovements);
    setIsProcessing(false);
    setIsOpen(false);
    setFile(null);
    setExtractedMovements([]);
  };

  const clearState = () => {
    setFile(null);
    setExtractedMovements([]);
    setIsProcessing(false);
    setIsDragging(false);
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      clearState();
    }
    setIsOpen(open);
  }

  const canSelectCompany = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  
  const currentCompanyDetails = companies.find(c => c.sigla === selectedCompany);
  const companyAccounts = currentCompanyDetails?.conti || [];
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importa Movimenti da File</DialogTitle>
          <DialogDescription>
            Carica un file Excel, PDF o immagine. L'AI analizzerà il contenuto ed estrarrà i movimenti.
          </DialogDescription>
        </DialogHeader>
        
        {!extractedMovements.length ? (
            <div className="py-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="company-select">Importa per la società</Label>
                        <Select 
                            value={selectedCompany} 
                            onValueChange={(v) => setSelectedCompany(v)}
                            disabled={!canSelectCompany}
                        >
                            <SelectTrigger id="company-select">
                                <SelectValue placeholder="Seleziona società..." />
                            </SelectTrigger>
                            <SelectContent>
                                {companies?.map(c => <SelectItem key={c.id} value={c.sigla}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="account-select">Associa al conto</Label>
                        {companyAccounts.length > 1 ? (
                            <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={!selectedCompany}>
                                <SelectTrigger id="account-select"><SelectValue placeholder="Seleziona conto..." /></SelectTrigger>
                                <SelectContent>
                                    {companyAccounts.map(acc => <SelectItem key={acc} value={acc}>{maskAccountNumber(acc)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : (
                             <Input id="account-select" value={companyAccounts.length === 1 ? maskAccountNumber(companyAccounts[0]) : "Nessun conto definito"} disabled />
                        )}
                    </div>
                </div>
                 <div
                    className={cn(
                        "flex items-center justify-center w-full"
                    )}
                    onDragOver={(e) => handleDragEvents(e, true)}
                    onDragLeave={(e) => handleDragEvents(e, false)}
                    onDrop={handleDrop}
                >
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
                        <div className='flex items-center gap-2'>
                            <File className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                )}
            </div>
        ) : (
            <div className="py-4">
                <h3 className="mb-4 text-lg font-medium">Movimenti Estratti - Verifica e Conferma</h3>
                <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Descrizione</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Sottocat.</TableHead>
                                <TableHead>Entrata</TableHead>
                                <TableHead>Uscita</TableHead>
                                <TableHead>IVA</TableHead>
                                <TableHead>Società</TableHead>
                                <TableHead>Stato</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {extractedMovements.map((mov, index) => (
                                <TableRow key={index} className={cn(mov.status === 'manual_review' && 'bg-amber-50 dark:bg-amber-900/20')}>
                                    <TableCell>{formatDate(mov.data)}</TableCell>
                                    <TableCell>{mov.descrizione}</TableCell>
                                    <TableCell><Badge variant="outline">{mov.categoria}</Badge></TableCell>
                                    <TableCell>{mov.sottocategoria}</TableCell>
                                    <TableCell className="text-green-600">{mov.entrata > 0 ? formatCurrency(mov.entrata) : '-'}</TableCell>
                                    <TableCell className="text-red-600">{mov.uscita > 0 ? formatCurrency(mov.uscita) : '-'}</TableCell>
                                    <TableCell>{(mov.iva * 100).toFixed(0)}%</TableCell>
                                    <TableCell><Badge variant={mov.societa === 'LNC' ? 'default' : 'secondary'}>{mov.societa}</Badge></TableCell>
                                     <TableCell>
                                        <Badge variant={mov.status === 'manual_review' ? 'destructive' : 'secondary'}>
                                            {mov.status === 'manual_review' ? 'Da Revisionare' : 'OK'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>Annulla</Button>
           {extractedMovements.length > 0 ? (
               <Button type="button" onClick={handleConfirmImport} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin" /> : 'Conferma e Importa'}
              </Button>
           ): (
              <Button type="button" onClick={handleProcessFile} disabled={isProcessing || !file}>
                {isProcessing ? <Loader2 className="animate-spin" /> : <><Wand2 className="mr-2 h-4 w-4"/> Analizza File</>}
              </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
