// src/app/(app)/previsioni/cash-flow/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, LineChart, TrendingUp, TrendingDown, PieChart as PieChartIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Movimento, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { analyzeCashFlow, type AnalyzeCashFlowOutput } from '@/ai/flows/analyze-cash-flow';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg">
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="hsl(var(--foreground))" className="text-sm">{`${formatCurrency(value)}`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))" className="text-xs">
        {`(${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};


export default function CashFlowPage() {
  const [analysis, setAnalysis] = useState<AnalyzeCashFlowOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState('90');
  const [company, setCompany] = useState<'LNC' | 'STG' | 'Tutte'>('Tutte');
  const { toast } = useToast();
  const firestore = useFirestore();
  const [activeIndexInflow, setActiveIndexInflow] = useState(0);
  const [activeIndexOutflow, setActiveIndexOutflow] = useState(0);

  const movimentiQuery = useMemo(() => firestore ? collection(firestore, 'movements') : null, [firestore]);
  const previsioniEntrateQuery = useMemo(() => firestore ? collection(firestore, 'incomeForecasts') : null, [firestore]);
  const previsioniUsciteQuery = useMemo(() => firestore ? collection(firestore, 'expenseForecasts') : null, [firestore]);

  const { data: movimentiData } = useCollection<Movimento>(movimentiQuery);
  const { data: previsioniEntrateData } = useCollection<PrevisioneEntrata>(previsioniEntrateQuery);
  const { data: previsioniUsciteData } = useCollection<PrevisioneUscita>(previsioniUsciteQuery);

  const getFilteredData = useCallback(() => {
    const filterByCompany = (item: { societa: 'LNC' | 'STG' }) => company === 'Tutte' || item.societa === company;
    
    const movimenti = movimentiData?.filter(filterByCompany) || [];
    const entrate = previsioniEntrateData?.filter(filterByCompany) || [];
    const uscite = previsioniUsciteData?.filter(filterByCompany) || [];

    return JSON.stringify({
        movements: movimenti,
        incomeForecasts: entrate,
        expenseForecasts: uscite
    }, null, 2);

  }, [movimentiData, previsioniEntrateData, previsioniUsciteData, company]);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setAnalysis(null);
    toast({
      title: 'Analisi Cash Flow in corso...',
      description: 'L\'AI sta elaborando i dati per creare la tua presentazione. Potrebbero volerci alcuni istanti.',
    });

    try {
      const financialDataSummary = getFilteredData();
      
      const result = await analyzeCashFlow({
        financialData: financialDataSummary,
        analysisPeriodDays: parseInt(period, 10),
        company: company,
      });

      setAnalysis(result);
      toast({
        title: 'Analisi Pronta!',
        description: 'La proiezione del cash flow è stata generata.',
        className: 'bg-green-100 dark:bg-green-900',
      });
    } catch (error) {
      console.error("Error analyzing cash flow:", error);
      toast({
        variant: 'destructive',
        title: 'Errore durante l\'analisi',
        description: 'Impossibile generare la proiezione in questo momento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-6 w-6 text-primary" />
            Analisi e Previsione Cash Flow con AI
          </CardTitle>
          <CardDescription>
            Ottieni un'analisi visiva della tua liquidità futura e scopri la capacità di investimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex gap-2 items-center w-full sm:w-auto">
                <span className="text-sm font-medium">Società:</span>
                <Select value={company} onValueChange={(v) => setCompany(v as any)}>
                    <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Tutte">Tutte</SelectItem>
                        <SelectItem value="LNC">LNC</SelectItem>
                        <SelectItem value="STG">STG</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex gap-2 items-center w-full sm:w-auto">
                <span className="text-sm font-medium">Periodo:</span>
                 <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="30">Prossimi 30 giorni</SelectItem>
                        <SelectItem value="90">Prossimo trimestre</SelectItem>
                        <SelectItem value="180">Prossimo semestre</SelectItem>
                        <SelectItem value="365">Prossimo anno</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analisi in corso...</>
            ) : (
               <><Wand2 className="mr-2 h-4 w-4" />Genera Analisi</>
            )}
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
            <CardContent className="pt-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/>
                <p className="mt-2 text-muted-foreground">L'AI sta analizzando i dati...</p>
            </CardContent>
        </Card>
      )}

      {analysis && analysis.monthlyAnalysis.length > 0 && (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Riepilogo e Capacità di Investimento Totale</CardTitle>
                </CardHeader>
                <CardContent className='flex flex-col md:flex-row gap-6 items-start'>
                     <div className="prose prose-sm dark:prose-invert max-w-full flex-1">
                        <p>{analysis.overallSummary}</p>
                    </div>
                     <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 w-full md:w-auto text-center">
                        <h3 className="font-semibold text-lg text-green-800 dark:text-green-300">Capacità di Investimento Totale</h3>
                        <p className="text-4xl font-bold text-green-700 dark:text-green-400 mt-2">{formatCurrency(analysis.totalInvestmentCapacity)}</p>
                        <p className="text-sm text-muted-foreground mt-1">Liquidità extra stimata alla fine del periodo.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Andamento Mensile Entrate vs. Uscite</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analysis.monthlyAnalysis}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                            <YAxis tickFormatter={(value) => `€${Number(value) / 1000}k`} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}/>
                            <Tooltip
                                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                                labelStyle={{ color: "hsl(var(--foreground))" }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                            <Bar dataKey="inflows" fill="hsl(var(--chart-2))" name="Entrate" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="outflows" fill="hsl(var(--chart-4))" name="Uscite" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-500" />Composizione Entrate Previste</CardTitle>
                        <CardDescription>Suddivisione per categoria del totale entrate nel periodo</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie 
                                    data={analysis.inflowBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="amount"
                                    nameKey="name"
                                    activeIndex={activeIndexInflow}
                                    activeShape={renderActiveShape}
                                    onMouseEnter={(_, index) => setActiveIndexInflow(index)}
                                >
                                    {analysis.inflowBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                            </PieChart>
                         </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-500" />Composizione Uscite Previste</CardTitle>
                        <CardDescription>Suddivisione per categoria del totale uscite nel periodo</CardDescription>
                    </CardHeader>
                    <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie 
                                    data={analysis.outflowBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="amount"
                                    nameKey="name"
                                    activeIndex={activeIndexOutflow}
                                    activeShape={renderActiveShape}
                                    onMouseEnter={(_, index) => setActiveIndexOutflow(index)}
                                >
                                    {analysis.outflowBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                            </PieChart>
                         </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}
       {analysis && analysis.monthlyAnalysis.length === 0 && (
         <Card>
            <CardHeader>
                <CardTitle>Risultato Analisi</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{analysis.overallSummary}</p>
            </CardContent>
        </Card>
       )}
    </div>
  );
}

    