
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Sparkles, 
  Loader2, 
  Target, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  CalendarClock,
  History,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Users2,
  ExternalLink,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateDecisionReport } from '@/ai/flows/generate-decision-report';
import { findSimilarCases } from '@/ai/flows/find-similar-cases';
import { formatCurrency, cn } from '@/lib/utils';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

const FormSchema = z.object({
  decisionType: z.enum(['acquisto', 'assunzione', 'investimento', 'cambio_fornitore', 'altro']),
  description: z.string().min(10, "Inserisci una descrizione più dettagliata per l'AI"),
  amount: z.coerce.number().positive("L'importo deve essere maggiore di zero"),
  isRecurring: z.boolean().default(false),
  frequency: z.enum(['mensile', 'trimestrale', 'annuale']).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface DecisionReportDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  societa: string;
  userId: string;
}

export function DecisionReportDialog({ isOpen, setIsOpen, societa, userId }: DecisionReportDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCases, setIsGeneratingCases] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [similarCases, setSimilarCases] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      decisionType: 'acquisto',
      description: '',
      amount: 0,
      isRecurring: false,
      frequency: 'mensile',
    },
  });

  const watchedIsRecurring = form.watch('isRecurring');

  const onSubmit = async (data: FormValues) => {
    setIsGenerating(true);
    setReport(null);
    setSimilarCases(null);
    try {
      // Step 1: Financial Report (Fast)
      const result = await generateDecisionReport({
        ...data,
        societa,
        userId,
      });
      setReport(result);
      toast({ title: "Analisi Finanziaria Completata" });

      // Step 2: External Intelligence / Similar Cases (Slower, async)
      setIsGeneratingCases(true);
      try {
        const casesResult = await findSimilarCases({
          societa,
          userId,
          decisionDescription: data.description,
          decisionAmount: data.amount,
          currentBalance: result.simulatedBalance.month1,
        });
        setSimilarCases(casesResult);
      } catch (err) {
        console.error("Find similar cases flow failed:", err);
      } finally {
        setIsGeneratingCases(false);
      }

    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!firestore || !report) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'decisionReports'), {
        ...report,
        similarCases: similarCases || null,
        decisionInput: form.getValues(),
        societa,
        userId,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Report salvato con successo" });
      setIsOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Errore salvataggio" });
    } finally {
      setIsSaving(false);
    }
  };

  const renderReportContent = () => {
    if (!report) return null;

    const { financialImpact, riskLevel, bestTiming, historicalContext, recommendation, successProbability } = report.report;
    const { month1, month3, month6 } = report.simulatedBalance;

    return (
      <div className="mt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border bg-muted/30 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Success Probability</p>
            <p className={cn("text-3xl font-black font-mono", successProbability > 70 ? "text-green-600" : successProbability > 40 ? "text-amber-600" : "text-red-600")}>
              {successProbability}%
            </p>
            <Progress value={successProbability} className="h-1 mt-2 w-full" indicatorClassName={successProbability > 70 ? "bg-green-500" : successProbability > 40 ? "bg-amber-500" : "bg-red-500"} />
          </div>
          <div className="p-4 rounded-xl border bg-muted/30 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Risk Level</p>
            <Badge variant="outline" className={cn(
              "px-4 py-1 text-xs font-black uppercase tracking-widest",
              riskLevel === 'low' ? "border-green-500 text-green-600 bg-green-50" : 
              riskLevel === 'medium' ? "border-amber-500 text-amber-600 bg-amber-50" : 
              "border-red-500 text-red-600 bg-red-50"
            )}>
              {riskLevel}
            </Badge>
          </div>
          <div className="p-4 rounded-xl border bg-primary text-primary-foreground flex flex-col items-center justify-center text-center shadow-lg">
            <p className="text-[10px] font-black uppercase opacity-70 tracking-widest mb-1">Balance 6 Mesi</p>
            <p className="text-xl font-black font-mono tracking-tighter">{formatCurrency(month6)}</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <TrendingUp className="h-3 w-3" />
              Impatto Finanziario
            </div>
            <p className="text-sm leading-relaxed text-foreground/80">{financialImpact}</p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <CalendarClock className="h-3 w-3" />
              Timing Consigliato
            </div>
            <p className="text-sm leading-relaxed text-foreground/80">{bestTiming}</p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
              <History className="h-3 w-3" />
              Precedenti Storici
            </div>
            <p className="text-sm leading-relaxed text-foreground/80">{historicalContext}</p>
          </section>

          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h4 className="text-sm font-black uppercase tracking-widest text-primary">Raccomandazione Finale</h4>
            </div>
            <p className="text-base font-bold leading-relaxed text-foreground italic">
              "{recommendation}"
            </p>
          </div>
        </div>

        {/* Similar Cases Section */}
        <Separator className="my-8" />
        
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-widest text-primary">Esperienze e Casi Simili</h3>
          </div>

          {isGeneratingCases ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </div>
          ) : similarCases ? (
            <div className="space-y-6">
              <div className="grid gap-4">
                {similarCases.cases.map((c: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl border bg-background shadow-sm hover:border-primary/20 transition-colors group">
                    <div className="flex justify-between items-start mb-3">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase tracking-tighter px-1.5 h-5",
                        c.applicability === 'high' ? "text-green-600 border-green-200 bg-green-50" :
                        c.applicability === 'medium' ? "text-amber-600 border-amber-200 bg-amber-50" :
                        "text-muted-foreground"
                      )}>
                        Applicabilità {c.applicability}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        {c.result.toLowerCase().includes('success') || c.result.toLowerCase().includes('positivo') ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : c.result.toLowerCase().includes('fallimento') || c.result.toLowerCase().includes('negativo') ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">{c.result}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-tight text-foreground/80">{c.who}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-muted pl-3 py-1 group-hover:border-primary/30 transition-colors">
                        "{c.action}"
                      </p>
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Lightbulb className="h-3 w-3 text-primary" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary">Lezione Chiave</span>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed text-foreground/90">
                          {c.lesson}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {similarCases.resources && similarCases.resources.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/70 tracking-[0.2em]">
                    <Globe className="h-3 w-3" />
                    Risorse e Community Consigliate
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {similarCases.resources.map((r: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] gap-1.5 py-1 px-2.5 font-bold cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors group">
                        {r} <ExternalLink className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border/50">
                <p className="text-[9px] text-muted-foreground italic leading-tight flex items-start gap-2">
                  <Info className="h-3 w-3 shrink-0" />
                  {similarCases.disclaimer}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl sm:max-w-3xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Decision Intelligence
          </DialogTitle>
          <DialogDescription>
            Valuta l'impatto strategico di una nuova operazione finanziaria
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh] px-6 pb-6">
          {!report ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="decisionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase">Tipo Decisione</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="acquisto">Nuovo Acquisto</SelectItem>
                            <SelectItem value="assunzione">Nuova Assunzione</SelectItem>
                            <SelectItem value="investimento">Investimento Strategico</SelectItem>
                            <SelectItem value="cambio_fornitore">Cambio Fornitore</SelectItem>
                            <SelectItem value="altro">Altro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-black uppercase">Importo Lordo (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase">Dettagli Operazione</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Spiega all'AI cosa vuoi fare. Più dettagli fornisci, più precisa sarà l'analisi." 
                          className="min-h-[100px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row gap-6 p-4 rounded-xl border bg-muted/30">
                  <FormField
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-bold">Spesa Ricorrente</FormLabel>
                      </FormItem>
                    )}
                  />

                  {watchedIsRecurring && (
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mensile">Mensile</SelectItem>
                              <SelectItem value="trimestrale">Trimestrale</SelectItem>
                              <SelectItem value="annuale">Annuale</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Button type="submit" className="w-full h-12 gap-2 shadow-lg" disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  Genera Report Decisionale AI
                </Button>
              </form>
            </Form>
          ) : (
            renderReportContent()
          )}
        </ScrollArea>

        {report && (
          <DialogFooter className="p-6 pt-0 gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setReport(null); setSimilarCases(null); }}>
              Nuova Analisi
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salva Report
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
