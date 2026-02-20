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
import { 
  Loader2, 
  UploadCloud, 
  File as FileIcon, 
  Trash2, 
  Check, 
  Wand2, 
  AlertTriangle, 
  Table as TableIcon,
  FileText,
  Camera,
  Keyboard,
  Info
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, maskAccountNumber, parseDate } from '@/lib/utils';
import { validateMovement, checkDuplicate } from '@/lib/data-validation';
import { importTransactions } from '@/ai/flows/import-transactions-flow';
import { logDataChange } from '@/ai/flows/data-audit-trail';
import type { Movimento, AppUser, CompanyProfile, LinkableItem, Scadenza, PrevisioneUscita, PrevisioneEntrata } from '@/lib/types';

type ImportStage = 'upload' | 'processing' | 'review' | 'success';

interface ProcessedMovement extends Omit<Movimento, 'id'> {
    tempId: string;
    errors: string[];
    warnings: string[];
    isDuplicate: boolean;
    linkedToId?: string;
    skip?: boolean;
}

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
  allMovements: Movimento[];
  deadlines: Scadenza[];
  expenseForecasts: PrevisioneUscita[];
  incomeForecasts: PrevisioneEntrata[];
}) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [processedRows, setProcessedRows] = useState<ProcessedMovement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  
  const SUPPORTED_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ];

  const clearState = () => {
    setStage('upload');
    setFile(null);
    setProcessedRows([]);
    setIsProcessing(false);
    setIsDragging(false);
  };

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [selectedCompany, companies]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (SUPPORTED_MIME_TYPES.includes(selectedFile.type)) {
        setFile(selectedFile);
      } else {
        toast({ variant: 'destructive', title: 'Formato non supportato', description: 'Carica un file Excel, CSV, PDF o Immagine.' });
      }
    }
  };

  const handleStartProcessing = async () => {
    if (!file || !currentUser) return;
    setIsProcessing(true);
    setStage('processing');

    try {
        let result;
        const isStructured = file.type.includes('spreadsheetml') || file.type.includes('csv') || file.type.includes('excel');

        if (isStructured) {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            result = await importTransactions({
                textContent: JSON.stringify(jsonData),
                fileType: file.type,
                company: selectedCompany,
                conto: selectedAccount,
                inseritoDa: currentUser.displayName,
            });
        } else {
            const dataUri = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });

            result = await importTransactions({
                fileDataUri: dataUri,
                fileType: file.type,
                company: selectedCompany,
                conto: selectedAccount,
                inseritoDa: currentUser.displayName,
            });
        }

        const initialRows: ProcessedMovement[] = result.movements.map((m: any) => {
            const row: Omit<Movimento, 'id'> = {
                societa: selectedCompany,
                data: m.data,
                anno: new Date(m.data).getFullYear() || new Date().getFullYear(),
                descrizione: m.descrizione,
                categoria: m.categoria || 'Da categorizzare',
                sottocategoria: m.sottocategoria || 'Da categorizzare',
                entrata: m.entrata || 0,
                uscita: m.uscita || 0,
                iva: 0.22,
                conto: selectedAccount,
                operatore: currentUser.displayName,
                metodoPag: 'Importato',
                note: `Importato da: ${file.name}`,
                status: 'manual_review',
            };

            const validation = validateMovement(row, allMovements, companies);
            const duplication = checkDuplicate(allMovements, row);

            return {
                ...row,
                tempId: crypto.randomUUID(),
                errors: validation.errors,
                warnings: validation.warnings,
                isDuplicate: duplication.isDuplicate,
                skip: validation.errors.length > 0 || duplication.isDuplicate
            };
        });

        setProcessedRows(initialRows);
        setStage('review');
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Errore elaborazione', description: error.message });
        setStage('upload');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUpdateRow = (tempId: string, field: keyof ProcessedMovement, value: any) => {
    setProcessedRows(prev => prev.map(row => {
        if (row.tempId === tempId) {
            const updated = { ...row, [field]: value };
            // Re-validate
            const validation = validateMovement(updated, allMovements, companies);
            const duplication = checkDuplicate(allMovements, updated);
            return {
                ...updated,
                errors: validation.errors,
                warnings: validation.warnings,
                isDuplicate: duplication.isDuplicate,
                skip: validation.errors.length > 0 || duplication.isDuplicate
            };
        }
        return row;
    }));
  };

  const handleFinalImport = async (onlyValid: boolean) => {
    const toImport = processedRows.filter(r => !r.skip || (!onlyValid && r.errors.length === 0));
    if (toImport.length === 0) {
        toast({ title: "Nessun movimento da importare" });
        return;
    }

    setIsProcessing(true);
    try {
        await onImport(toImport.map(({ tempId, errors, warnings, isDuplicate, skip, ...rest }) => rest));
        
        // Log changes
        for (const m of toImport) {
            logDataChange({
                societa: m.societa,
                userId: currentUser?.uid || '',
                collection: 'movements',
                documentId: 'bulk-import',
                action: 'create',
                previousData: null,
                newData: m,
                source: 'import'
            });
        }

        toast({ title: "Importazione completata", description: `${toImport.length} movimenti aggiunti.` });
        setStage('success');
    } catch (error) {
        toast({ variant: 'destructive', title: "Errore importazione" });
    } finally {
        setIsProcessing(false);
    }
  };

  const stats = useMemo(() => {
    return {
        total: processedRows.length,
        valid: processedRows.filter(r => r.errors.length === 0 && r.warnings.length === 0 && !r.isDuplicate).length,
        warnings: processedRows.filter(r => r.warnings.length > 0 && r.errors.length === 0).length,
        errors: processedRows.filter(r => r.errors.length > 0).length,
        duplicates: processedRows.filter(r => r.isDuplicate).length
    };
  }, [processedRows]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("transition-all duration-500", stage === 'review' ? "max-w-7xl h-[90vh]" : "max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-primary" />
            Centro Importazione Intelligente
          </DialogTitle>
          <DialogDescription>
            Supporta Excel, CSV, PDF e Immagini. L'AI estrarrà e categorizzerà i movimenti automaticamente.
          </DialogDescription>
        </DialogHeader>

        {stage === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Società di destinazione</Label>
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {companies.map(c => <SelectItem key={c.sigla} value={c.sigla}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Conto predefinito</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {companyAccounts.map(a => <SelectItem key={a} value={a}>{maskAccountNumber(a)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div 
                className={cn(
                    "border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                onClick={() => document.getElementById('file-upload')?.click()}
            >
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept={ACCEPTED_FILES} />
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                    <UploadCloud className="h-10 w-10" />
                </div>
                <div className="text-center">
                    <p className="font-bold">{file ? file.name : "Trascina qui il documento"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Excel, CSV, PDF o Immagini (max 10MB)</p>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl border bg-muted/30 opacity-60">
                    <TableIcon className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase">Excel/CSV</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl border bg-muted/30 opacity-60">
                    <FileText className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase">PDF</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl border bg-muted/30 opacity-60">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase">Immagini</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl border bg-muted/30 opacity-60">
                    <Keyboard className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase">Manuale</span>
                </div>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
                <Sparkles className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-bold">Analisi AI in corso...</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Gemini sta analizzando il contenuto di <span className="font-bold text-foreground">{file?.name}</span> per estrarre ogni singola riga.
                </p>
            </div>
            <div className="w-full max-w-xs space-y-1">
                <Progress value={undefined} className="h-1.5" />
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">OCR & Data Extraction</p>
            </div>
          </div>
        )}

        {stage === 'review' && (
          <div className="flex flex-col h-full space-y-6 overflow-hidden">
            <div className="grid grid-cols-4 gap-4">
                <div className="p-3 rounded-xl border bg-green-50 dark:bg-green-950/20 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-green-600">Validi</span>
                    <span className="text-xl font-black">{stats.valid}</span>
                </div>
                <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/20 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-amber-600">Avvisi</span>
                    <span className="text-xl font-black">{stats.warnings}</span>
                </div>
                <div className="p-3 rounded-xl border bg-red-50 dark:bg-red-950/20 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-red-600">Errori</span>
                    <span className="text-xl font-black">{stats.errors}</span>
                </div>
                <div className="p-3 rounded-xl border bg-muted flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Duplicati</span>
                    <span className="text-xl font-black">{stats.duplicates}</span>
                </div>
            </div>

            <ScrollArea className="flex-1 border rounded-2xl bg-muted/5">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="w-32">Data</TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead className="w-32 text-right">Importo</TableHead>
                            <TableHead className="w-48">Validazione</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedRows.map((row) => (
                            <TableRow key={row.tempId} className={cn(row.skip && "opacity-60")}>
                                <TableCell>
                                    <input 
                                        type="checkbox" 
                                        checked={!row.skip} 
                                        onChange={(e) => handleUpdateRow(row.tempId, 'skip', !e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input 
                                        type="date" 
                                        value={row.data} 
                                        className="h-8 text-xs"
                                        onChange={(e) => handleUpdateRow(row.tempId, 'data', e.target.value)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input 
                                        value={row.descrizione} 
                                        className="h-8 text-xs"
                                        onChange={(e) => handleUpdateRow(row.tempId, 'descrizione', e.target.value)}
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Input 
                                        type="number" 
                                        value={row.entrata > 0 ? row.entrata : row.uscita} 
                                        className="h-8 text-xs text-right"
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            handleUpdateRow(row.tempId, row.entrata > 0 ? 'entrata' : 'uscita', val);
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {row.errors.map((e, i) => <Badge key={i} variant="destructive" className="text-[8px] px-1 py-0">{e}</Badge>)}
                                        {row.warnings.map((w, i) => <Badge key={i} variant="secondary" className="bg-amber-100 text-amber-800 text-[8px] px-1 py-0">{w}</Badge>)}
                                        {row.isDuplicate && <Badge variant="outline" className="text-red-500 border-red-500 text-[8px] px-1 py-0">Già presente</Badge>}
                                        {row.errors.length === 0 && !row.isDuplicate && <Badge className="bg-green-500 text-[8px] px-1 py-0">OK</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setProcessedRows(prev => prev.filter(r => r.tempId !== row.tempId))}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
          </div>
        )}

        {stage === 'success' && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/30">
                    <Check className="h-10 w-10 stroke-[3]" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Importazione Riuscita!</h3>
                    <p className="text-sm text-muted-foreground">I movimenti sono stati registrati e sono ora visibili nella tabella principale.</p>
                </div>
                <Button onClick={() => handleClose(false)} className="px-10">Torna ai Movimenti</Button>
            </div>
        )}

        <DialogFooter className="gap-2 p-6 border-t bg-muted/10">
          {stage === 'upload' && (
            <>
                <Button variant="outline" onClick={() => handleClose(false)}>Annulla</Button>
                <Button onClick={handleStartProcessing} disabled={!file || isProcessing} className="gap-2">
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Analizza con AI
                </Button>
            </>
          )}
          {stage === 'review' && (
            <>
                <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Info className="h-4 w-4" />
                    I movimenti con errori critici o duplicati sono esclusi per default.
                </div>
                <Button variant="outline" onClick={() => setStage('upload')}>Indietro</Button>
                <Button variant="secondary" onClick={() => handleFinalImport(true)} disabled={isProcessing}>
                    Importa solo validi ({stats.valid})
                </Button>
                <Button onClick={() => handleFinalImport(false)} disabled={isProcessing || stats.errors > 0} className="gap-2">
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Conferma e Importa ({processedRows.filter(r => !r.skip).length})
                </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACCEPTED_FILES = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp";
