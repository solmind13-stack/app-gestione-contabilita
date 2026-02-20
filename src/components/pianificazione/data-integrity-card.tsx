'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ShieldCheck, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  Loader2, 
  Sparkles,
  ArrowRight,
  Database,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { verifyDataIntegrity } from '@/ai/flows/data-audit-trail';
import { formatCurrency, cn, parseDate } from '@/lib/utils';
import { startOfMonth, subMonths, format, endOfMonth, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita, DataAuditLog } from '@/lib/types';

interface DataIntegrityCardProps {
  societa: string;
  userId: string;
}

export function DataIntegrityCard({ societa, userId }: DataIntegrityCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Queries for reconciliation and logs
  const movementsQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'movements'), where('societa', '==', societa)) : null, 
  [firestore, societa]);
  
  const incQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'incomeForecasts'), where('societa', '==', societa)) : null, 
  [firestore, societa]);
  
  const expQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'expenseForecasts'), where('societa', '==', societa)) : null, 
  [firestore, societa]);

  const logsQuery = useMemo(() => 
    firestore ? query(
      collection(firestore, 'dataAuditLog'), 
      where('societa', '==', societa), 
      orderBy('timestamp', 'desc'), 
      limit(5)
    ) : null, 
  [firestore, societa]);

  const { data: movements } = useCollection<Movimento>(movementsQuery);
  const { data: incomeForecasts } = useCollection<PrevisioneEntrata>(incQuery);
  const { data: expenseForecasts } = useCollection<PrevisioneUscita>(expQuery);
  const { data: auditLogs } = useCollection<DataAuditLog>(logsQuery);

  // Reconciliation Table Calculation (Last 6 months)
  const reconTable = useMemo(() => {
    if (!movements || !incomeForecasts || !expenseForecasts) return [];
    
    const today = new Date();
    const rows = [];
    for (let i = 1; i <= 6; i++) {
      const date = subMonths(startOfMonth(today), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const actualIn = movements.filter(m => {
        const d = parseDate(m.data);
        return isWithinInterval(d, { start, end }) && m.entrata > 0;
      }).reduce((s, m) => s + m.entrata, 0);

      const actualOut = movements.filter(m => {
        const d = parseDate(m.data);
        return isWithinInterval(d, { start, end }) && m.uscita > 0;
      }).reduce((s, m) => s + m.uscita, 0);

      const plannedIn = incomeForecasts.filter(f => {
        const d = parseDate(f.dataPrevista);
        return isWithinInterval(d, { start, end });
      }).reduce((s, f) => s + (f.importoLordo || 0), 0);

      const plannedOut = expenseForecasts.filter(f => {
        const d = parseDate(f.dataScadenza);
        return isWithinInterval(d, { start, end });
      }).reduce((s, f) => s + (f.importoLordo || 0), 0);

      const diffIn = plannedIn === 0 ? 0 : ((actualIn - plannedIn) / plannedIn) * 100;
      const diffOut = plannedOut === 0 ? 0 : ((actualOut - plannedOut) / plannedOut) * 100;

      rows.push({
        label: format(date, 'MMMM yyyy', { locale: it }),
        plannedIn,
        actualIn,
        diffIn,
        plannedOut,
        actualOut,
        diffOut
      });
    }
    return rows;
  }, [movements, incomeForecasts, expenseForecasts]);

  const handleVerify = async () => {
    if (!userId) return;
    setIsVerifying(true);
    try {
      const result = await verifyDataIntegrity({ societa: societa === 'Tutte' ? 'LNC' : societa, userId });
      setIntegrityResult(result);
      setLastChecked(new Date());
      toast({ title: "Verifica Integrità Completata", className: "bg-green-100 dark:bg-green-900" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Errore durante la verifica" });
    } finally {
      setIsVerifying(false);
    }
  };

  const healthScore = useMemo(() => {
    if (!integrityResult) return 100;
    const errors = integrityResult.issues.filter((i: any) => i.severity === 'error').length;
    const warnings = integrityResult.issues.filter((i: any) => i.severity === 'warning').length;
    return Math.max(0, 100 - (errors * 10) - (warnings * 3));
  }, [integrityResult]);

  const scoreColor = healthScore >= 90 ? "text-green-500" : healthScore >= 70 ? "text-amber-500" : "text-red-500";

  return (
    <Card className="lg:col-span-4 shadow-xl border-primary/5 overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Salute e Integrità Dati
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monitoraggio qualità del database e riconciliazione automatica</CardDescription>
        </div>
        <Button onClick={handleVerify} disabled={isVerifying} size="sm" className="gap-2 font-bold uppercase tracking-tighter text-[10px] h-9">
          {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Avvia Health Check
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-10 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Health Score Panel */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-8 rounded-3xl bg-background border shadow-inner space-y-6">
            <div className="relative h-40 w-40 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90">
                <circle cx="80" cy="80" r="74" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-muted/20" />
                <circle 
                  cx="80" cy="80" r="74" fill="transparent" stroke="currentColor" strokeWidth="12" 
                  strokeDasharray={464.7} strokeDashoffset={464.7 - (464.7 * healthScore) / 100}
                  className={cn("transition-all duration-1000 ease-out", scoreColor)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-5xl font-black font-mono tracking-tighter", scoreColor)}>{healthScore}</span>
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Score</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <h3 className={cn("text-lg font-black uppercase tracking-tighter", scoreColor)}>
                {healthScore >= 90 ? "Dati Eccellenti" : healthScore >= 70 ? "Attenzione Richiesta" : "Intervento Urgente"}
              </h3>
              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-wide">
                Qualità complessiva del database finanziario
              </p>
            </div>
          </div>

          {/* AI Narrative Briefing */}
          <div className="lg:col-span-8 space-y-6 flex flex-col justify-center">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Diagnosi Automatica
              </div>
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 text-sm leading-relaxed text-foreground/80 font-medium italic">
                "{integrityResult?.narrative || "Esegui una verifica per analizzare la qualità dei tuoi record e individuare potenziali errori di inserimento o duplicati."}"
              </div>
            </div>
            
            {integrityResult?.issues.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-background flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase text-red-500">Errori Critici</span>
                  <span className="text-2xl font-black font-mono">{integrityResult.issues.filter((i:any) => i.severity === 'error').length}</span>
                </div>
                <div className="p-4 rounded-xl border bg-background flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase text-amber-500">Avvisi / Warning</span>
                  <span className="text-2xl font-black font-mono">{integrityResult.issues.filter((i:any) => i.severity === 'warning').length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Issues List */}
        {integrityResult?.issues.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Lista Anomalie da Risolvere</h4>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-3">
              {integrityResult.issues.map((issue: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border bg-background flex justify-between items-center shadow-sm group hover:border-primary/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-2 rounded-lg mt-0.5",
                      issue.severity === 'error' ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                    )}>
                      {issue.severity === 'error' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">{issue.description}</p>
                      <p className="text-[9px] text-muted-foreground uppercase font-black mt-1 tracking-tighter">
                        {issue.collection} • Ref: {issue.documentId}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 text-[10px] font-black uppercase gap-1 group-hover:bg-primary group-hover:text-primary-foreground">
                    Risolvi <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reconciliation Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Tabella di Riconciliazione (Ultimi 6 Mesi)</h4>
            <Badge variant="outline" className="text-[9px] font-black">PREVISTO VS EFFETTIVO</Badge>
          </div>
          <div className="rounded-2xl border overflow-hidden shadow-inner">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="text-[9px] uppercase font-black">Mese</TableHead>
                  <TableHead className="text-right text-[9px] uppercase font-black">Entrate Previste</TableHead>
                  <TableHead className="text-right text-[9px] uppercase font-black">Entrate Reali</TableHead>
                  <TableHead className="text-center text-[9px] uppercase font-black">Var %</TableHead>
                  <TableHead className="text-right text-[9px] uppercase font-black">Uscite Previste</TableHead>
                  <TableHead className="text-right text-[9px] uppercase font-black">Uscite Reali</TableHead>
                  <TableHead className="text-center text-[9px] uppercase font-black">Var %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconTable.map((row, idx) => {
                  const getStatusStyle = (diff: number) => {
                    const abs = Math.abs(diff);
                    if (abs < 10) return "text-green-600 bg-green-50/50";
                    if (abs < 25) return "text-amber-600 bg-amber-50/50";
                    return "text-red-600 bg-red-50/50";
                  };
                  return (
                    <TableRow key={idx} className="hover:bg-muted/20">
                      <TableCell className="font-bold text-xs capitalize">{row.label}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{formatCurrency(row.plannedIn)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatCurrency(row.actualIn)}</TableCell>
                      <TableCell className={cn("text-center text-xs font-black px-4", getStatusStyle(row.diffIn))}>
                        {row.diffIn > 0 ? '+' : ''}{row.diffIn.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{formatCurrency(row.plannedOut)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatCurrency(row.actualOut)}</TableCell>
                      <TableCell className={cn("text-center text-xs font-black px-4", getStatusStyle(row.diffOut))}>
                        {row.diffOut > 0 ? '+' : ''}{row.diffOut.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Audit Log Peek */}
        {auditLogs && auditLogs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Ultime Modifiche Registrate</h4>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/20 border border-transparent hover:border-border transition-colors">
                  <div className="flex items-center gap-3">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase">
                      {log.action === 'create' ? 'CREATO' : log.action === 'update' ? 'MODIFICATO' : 'ELIMINATO'}
                    </span>
                    <span className="text-xs font-medium text-foreground/70">{log.collection}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">{format(new Date(log.timestamp), 'dd MMM HH:mm')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
