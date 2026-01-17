// src/components/movimenti/import-movements-dialog.tsx
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import type { Movimento, AppUser, CompanyProfile } from '@/lib/types';
import { importTransactions } from '@/ai/flows/import-transactions-flow';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';

interface ImportMovementsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onImport: (movements: Omit<Movimento, 'id'>[]) => Promise<void>;
  defaultCompany?: string;
  currentUser: AppUser | null;
  companies: CompanyProfile[];
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
  const { toast } = useToast();

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
  }, [isOpen, currentUser, defaultCompany, companies])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleProcessFile = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Nessun file selezionato' });
      return;
    }
    setIsProcessing(true);
    setExtractedMovements([]);

    try {
      const fileDataUri = await fileToBase64(file);
      const result = await importTransactions({
        fileDataUri: fileDataUri,
        fileType: file.type,
        company: selectedCompany,
      });
      
      setExtractedMovements(result.movements);
      toast({ title: 'Analisi completata', description: `${result.movements.length} movimenti estratti dal file.` });

    } catch (error) {
      console.error("Error processing file with AI:", error);
      toast({ variant: 'destructive', title: 'Errore durante l\'analisi', description: 'Impossibile estrarre i movimenti dal file.' });
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
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      clearState();
    }
    setIsOpen(open);
  }

  const canSelectCompany = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importa Movimenti da File</DialogTitle>
          <DialogDescription>
            Carica un file Excel, PDF o un'immagine di un estratto conto. L'AI analizzerà il contenuto ed estrarrà i movimenti.
          </DialogDescription>
        </DialogHeader>
        
        {!extractedMovements.length ? (
            <div className="py-8 space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
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
                <div className="flex items-center justify-center w-full">
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clicca per caricare</span> o trascina il file</p>
                            <p className="text-xs text-muted-foreground">XLSX, PDF, PNG, JPG</p>
                        </div>
                        <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.pdf,.png,.jpg,.jpeg" />
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
                                <TableHead>Entrata</TableHead>
                                <TableHead>Uscita</TableHead>
                                <TableHead>Società</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {extractedMovements.map((mov, index) => (
                                <TableRow key={index}>
                                    <TableCell>{formatDate(mov.data)}</TableCell>
                                    <TableCell>{mov.descrizione}</TableCell>
                                    <TableCell className="text-green-600">{mov.entrata > 0 ? formatCurrency(mov.entrata) : '-'}</TableCell>
                                    <TableCell className="text-red-600">{mov.uscita > 0 ? formatCurrency(mov.uscita) : '-'}</TableCell>
                                    <TableCell><Badge variant={mov.societa === 'LNC' ? 'default' : 'secondary'}>{mov.societa}</Badge></TableCell>
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
