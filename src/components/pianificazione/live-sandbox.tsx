
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { 
  FlaskConical, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Save, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Lightbulb,
  Loader2,
  Sparkles,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, parseDate, cn } from '@/lib/utils';
import type { CashFlowProjection, SimulatedAction, LiquidityAlert } from '@/lib/types';
import { generateSandboxInsight } from '@/ai/flows/generate-sandbox-insight';
import { isAfter, startOfMonth, addMonths, getMonth, getYear } from 'date-fns';

const SAFETY_THRESHOLD = 5000;

interface LiveSandboxProps {
  societa: string;
}

export function LiveSandbox({ societa }: LiveSandboxProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [actions, setActions] = useState<SimulatedAction[]>([]);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [newAction, setNewAction] = useState<Omit<SimulatedAction, 'id'>>({
    type: 'expense',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    recurrence: 'once'
  });

  // Fetch baseline projection
  const projQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'cashFlowProjections'),
      where('societa', '==', societa),
      where('scenarioType', '==', 'realistic'),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
  }, [firestore, societa]);

  const alertQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'liquidityAlerts'),
      where('societa', '==', societa),
      orderBy('triggeredAt', 'desc'),
      limit(1)
    );
  }, [firestore, societa]);

  const { data: projections, isLoading: isLoadingProj } = useCollection<CashFlowProjection>(projQuery);
  const { data: alerts } = useCollection<LiquidityAlert>(alertQuery);

  const baseline = projections?.[0];

  // Simulation Logic
  const simulatedResults = useMemo(() => {
    if (!baseline) return { chartData: [], impact: 0, monthsUnder: 0 };

    const dataPoints = baseline.monthlyProjections.map(p => ({ ...p }));
    
    actions.forEach(action => {
      const actionDate = parseDate(action.date);
      const amount = (action.type === 'income' || action.type === 'advance') ? action.amount : -action.amount;

      dataPoints.forEach(p => {
        const pointDate = new Date(p.year, p.month - 1, 1);
        let shouldApply = false;

        if (action.recurrence === 'once') {
          shouldApply = getMonth(pointDate) === getMonth(actionDate) && getYear(pointDate) === getYear(actionDate);
        } else if (action.recurrence === 'monthly') {
          shouldApply = !isAfter(startOfMonth(actionDate), startOfMonth(pointDate));
        } else if (action.recurrence === 'quarterly') {
          const diff = (getMonth(pointDate) - getMonth(actionDate)) + 12 * (getYear(pointDate) - getYear(actionDate));
          shouldApply = diff >= 0 && diff % 3 === 0;
        } else if (action.recurrence === 'annual') {
          shouldApply = getMonth(pointDate) === getMonth(actionDate) && getYear(pointDate) >= getYear(actionDate);
        }

        if (shouldApply) {
          p.netFlow += amount;
        }
      });
    });

    // Ricalcolo cumulative balance
    let currentBalance = baseline.baseBalance;
    const chartData = dataPoints.map(p => {
      currentBalance += p.netFlow;
      p.cumulativeBalance = currentBalance;
      
      const original = baseline.monthlyProjections.find(op => op.month === p.month && op.year === p.year);
      
      return {
        name: new Date(p.year, p.month - 1).toLocaleString('it-IT', { month: 'short' }),
        original: original?.cumulativeBalance || 0,
        simulated: p.cumulativeBalance,
        diff: p.cumulativeBalance - (original?.cumulativeBalance || 0)
      };
    });

    const finalImpact = chartData[chartData.length - 1].simulated - chartData[chartData.length - 1].original;
    const monthsUnder = chartData.filter(d => d.simulated < SAFETY_THRESHOLD).length;

    return { chartData, impact: finalImpact, monthsUnder };
  }, [baseline, actions]);

  // AI Insight Trigger
  useEffect(() => {
    if (actions.length === 0) {
      setInsight(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeneratingInsight(true);
      try {
        const result = await generateSandboxInsight({
          societa,
          impactAmount: simulatedResults.impact,
          monthsUnderThreshold: simulatedResults.monthsUnder,
          actions: JSON.stringify(actions.map(a => `${a.type}: ${a.description} (${a.amount}€)`)),
          currentStatus: alerts?.[0]?.status || 'green'
        });
        setInsight(result.insight);
      } catch (e) {
        console.error("Sandbox insight failed", e);
      } finally {
        setIsGeneratingInsight(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [actions, simulatedResults.impact, simulatedResults.monthsUnder, societa, alerts]);

  const handleAddAction = () => {
    if (!newAction.description || newAction.amount <= 0) return;
    
    setActions(prev => [...prev, { ...newAction, id: crypto.randomUUID() }]);
    setNewAction(prev => ({ ...prev, description: '', amount: 0 }));
    toast({ title: "Azione aggiunta alla simulazione" });
  };

  const handleRemoveAction = (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const handleSaveScenario = async () => {
    if (!user || !firestore || actions.length === 0) return;
    
    const scenarioName = prompt("Inserisci un nome per questo scenario:");
    if (!scenarioName) return;

    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'sandboxSessions'), {
        name: scenarioName,
        societa,
        userId: user.uid,
        actions,
        createdAt: serverTimestamp()
      });
      toast({ title: "Scenario salvato correttamente" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Errore durante il salvataggio" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingProj) {
    return <div className="h-96 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!baseline) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-20 text-center">
          <Info className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="font-bold">Nessuna proiezione reale trovata</p>
          <p className="text-sm text-muted-foreground">Genera prima una proiezione nella dashboard per poter usare la sandbox.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Simulation Control Panel */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="shadow-lg border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Motore di Simulazione
            </CardTitle>
            <CardDescription>Aggiungi eventi ipotetici per testare la tenuta della cassa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Tipo Azione</Label>
              <Select 
                value={newAction.type} 
                onValueChange={(v: any) => setNewAction(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Nuova Spesa</SelectItem>
                  <SelectItem value="income">Nuova Entrata</SelectItem>
                  <SelectItem value="delay">Ritardo Incasso</SelectItem>
                  <SelectItem value="advance">Anticipo Pagamento</SelectItem>
                  <SelectItem value="hiring">Nuova Assunzione</SelectItem>
                  <SelectItem value="equipment">Acquisto Attrezzatura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Descrizione</Label>
              <Input 
                placeholder="Es: Nuovo macchinario, Assunzione Junior..." 
                className="h-9"
                value={newAction.description}
                onChange={e => setNewAction(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Importo (€)</Label>
                <Input 
                  type="number" 
                  className="h-9" 
                  value={newAction.amount || ''}
                  onChange={e => setNewAction(prev => ({ ...prev, amount: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Data Inizio</Label>
                <Input 
                  type="date" 
                  className="h-9" 
                  value={newAction.date}
                  onChange={e => setNewAction(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Ricorrenza</Label>
              <Select 
                value={newAction.recurrence} 
                onValueChange={(v: any) => setNewAction(prev => ({ ...prev, recurrence: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Una tantum</SelectItem>
                  <SelectItem value="monthly">Mensile</SelectItem>
                  <SelectItem value="quarterly">Trimestrale</SelectItem>
                  <SelectItem value="annual">Annuale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleAddAction} className="w-full gap-2 shadow-sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Aggiungi alla Simulazione
            </Button>
          </CardContent>
        </Card>

        {/* List of actions */}
        <Card className="h-[400px] flex flex-col">
          <CardHeader className="py-4">
            <CardTitle className="text-sm uppercase tracking-widest font-black text-muted-foreground">Azioni in Corso</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-6 pb-6">
              {actions.length > 0 ? (
                <div className="space-y-3">
                  {actions.map(a => (
                    <div key={a.id} className="p-3 rounded-lg border bg-muted/30 group relative flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-xs font-black truncate max-w-[180px]">{a.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase h-4 px-1">{a.recurrence}</Badge>
                          <span className={cn(
                            "text-[10px] font-bold font-mono",
                            (a.type === 'income' || a.type === 'advance') ? "text-green-600" : "text-red-600"
                          )}>
                            {(a.type === 'income' || a.type === 'advance') ? '+' : '-'}{formatCurrency(a.amount)}
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveAction(a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-10">
                  < flask-conical className="h-10 w-10 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-tighter">Nessuna azione simulata</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t p-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-2 text-[10px] font-black uppercase"
              onClick={() => setActions([])}
              disabled={actions.length === 0}
            >
              <RotateCcw className="h-3 w-3" />
              Reset Sandbox
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Results and Comparison Panel */}
      <div className="lg:col-span-8 space-y-6">
        <Card className="shadow-xl border-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div>
              <CardTitle className="text-xl font-bold">Impatto sulla Liquidità</CardTitle>
              <CardDescription>Confronto proiezione reale vs simulazione sandbox</CardDescription>
            </div>
            <Button 
              size="sm" 
              onClick={handleSaveScenario} 
              disabled={actions.length === 0 || isSaving}
              className="gap-2 font-bold uppercase tracking-widest text-[10px]"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salva Scenario
            </Button>
          </CardHeader>
          <CardContent className="space-y-10">
            {/* Simulation Graph */}
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={simulatedResults.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `€${value / 1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" fontSize={12} />
                  
                  <Line 
                    type="monotone" 
                    dataKey="original" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2} 
                    dot={false}
                    name="Proiezione Reale"
                  />
                  
                  <Line 
                    type="monotone" 
                    dataKey="simulated" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={3} 
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: "hsl(var(--chart-3))" }}
                    name="Simulazione Sandbox"
                  />

                  <ReferenceLine 
                    y={SAFETY_THRESHOLD} 
                    stroke="hsl(var(--destructive))" 
                    strokeDasharray="3 3" 
                    label={{ value: 'SICUREZZA', position: 'insideBottomRight', fontSize: 9, fill: 'hsl(var(--destructive))' }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Impact Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-background flex flex-col gap-1 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Impatto a 3 Mesi</p>
                <div className="flex items-center gap-2">
                  {simulatedResults.impact > 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <p className={cn(
                    "text-xl font-black font-mono tracking-tighter",
                    simulatedResults.impact > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(simulatedResults.impact)}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-background flex flex-col gap-1 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mesi sotto soglia</p>
                <div className="flex items-center gap-2">
                  {simulatedResults.monthsUnder > 0 ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                  <p className={cn(
                    "text-xl font-black font-mono tracking-tighter",
                    simulatedResults.monthsUnder > 0 ? "text-amber-600" : "text-green-600"
                  )}>
                    {simulatedResults.monthsUnder} / 12
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-background flex flex-col gap-1 shadow-sm">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Stato Semaforo</p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-3 w-3 rounded-full animate-pulse",
                    simulatedResults.monthsUnder > 2 ? "bg-red-500" : simulatedResults.monthsUnder > 0 ? "bg-amber-500" : "bg-green-500"
                  )} />
                  <p className="text-sm font-black uppercase tracking-tighter">
                    {simulatedResults.monthsUnder > 2 ? "Critico" : simulatedResults.monthsUnder > 0 ? "Attenzione" : "Ottimale"}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Analysis of the Sandbox */}
            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-primary" />
                <h4 className="text-sm font-black uppercase tracking-widest text-primary">Insight del Digital Twin</h4>
              </div>
              
              {isGeneratingInsight ? (
                <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-xs font-medium">L'AI sta analizzando gli scenari...</p>
                </div>
              ) : insight ? (
                <p className="text-sm leading-relaxed font-medium text-foreground/80 animate-in fade-in slide-in-from-left-4 duration-500">
                  {insight}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Aggiungi delle azioni simulate per ricevere un consiglio strategico dall'intelligenza artificiale.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
