'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { 
  Building2, 
  ArrowLeftRight, 
  Zap, 
  TrendingUp, 
  Users2,
  Info,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { CompanyProfile, CashFlowProjection, Movimento } from '@/lib/types';

interface CrossCompanyPatternsProps {
  userId: string;
}

export function CrossCompanyPatterns({ userId }: CrossCompanyPatternsProps) {
  const firestore = useFirestore();

  // 1. Fetch all companies
  const companiesQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'companies')) : null, 
  [firestore]);
  const { data: companies, isLoading: isLoadingCompanies } = useCollection<CompanyProfile>(companiesQuery);

  // 2. Fetch all recent projections
  const projectionsQuery = useMemo(() => 
    firestore ? query(
      collection(firestore, 'cashFlowProjections'),
      where('scenarioType', '==', 'realistic'),
      orderBy('generatedAt', 'desc')
    ) : null, 
  [firestore]);
  const { data: allProjections } = useCollection<CashFlowProjection>(projectionsQuery);

  // 3. Fetch recent movements to find shared suppliers
  const movementsQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'movements'), orderBy('data', 'desc')) : null, 
  [firestore]);
  const { data: allMovements } = useCollection<Movimento>(movementsQuery);

  const analysis = useMemo(() => {
    if (!companies || companies.length < 2 || !allProjections) return null;

    // Prendi solo l'ultima proiezione per ogni società
    const latestProjectionsMap: Record<string, CashFlowProjection> = {};
    allProjections.forEach(p => {
      if (!latestProjectionsMap[p.societa]) latestProjectionsMap[p.societa] = p;
    });

    const activeCompanies = Object.values(latestProjectionsMap);
    if (activeCompanies.length < 2) return null;

    // -- Tabella Consolidamento --
    const months: Record<string, { [sigla: string]: number, total: number }> = {};
    activeCompanies.forEach(proj => {
      proj.monthlyProjections.forEach(m => {
        const key = `${m.month}/${m.year}`;
        if (!months[key]) months[key] = { total: 0 };
        months[key][proj.societa] = m.cumulativeBalance;
        months[key].total += m.cumulativeBalance;
      });
    });

    // -- Intelligence: Shared Suppliers --
    const suppliersByCompany: Record<string, Set<string>> = {};
    (allMovements || []).forEach(m => {
      if (m.uscita > 0 && m.categoria === 'Fornitori') {
        if (!suppliersByCompany[m.societa]) suppliersByCompany[m.societa] = new Set();
        // Normalizzazione minima del nome
        const name = m.descrizione.split(' ')[0].toUpperCase();
        if (name.length > 3) suppliersByCompany[m.societa].add(name);
      }
    });

    const sharedSuppliers: string[] = [];
    const sigle = Object.keys(suppliersByCompany);
    if (sigle.length >= 2) {
      const first = suppliersByCompany[sigle[0]];
      const second = suppliersByCompany[sigle[1]];
      first.forEach(s => {
        if (second.has(s)) sharedSuppliers.push(s);
      });
    }

    // -- Intelligence: Intercompany Liquidity --
    const intercompanyInsights: string[] = [];
    Object.keys(months).slice(0, 3).forEach(monthKey => {
      const data = months[monthKey];
      const keys = Object.keys(data).filter(k => k !== 'total');
      
      const surplus = keys.find(k => data[k] > 20000);
      const deficit = keys.find(k => data[k] < 5000);

      if (surplus && deficit) {
        intercompanyInsights.push(
          `Nel mese di ${monthKey}, ${surplus} avrà un surplus significativo (${formatCurrency(data[surplus])}) mentre ${deficit} sarà sotto soglia. Valutare un finanziamento intercompany.`
        );
      }
    });

    if (sharedSuppliers.length > 0) {
      intercompanyInsights.push(
        `Il fornitore "${sharedSuppliers[0]}" è utilizzato da più società. Possibile negoziare uno sconto di gruppo basato sul volume totale.`
      );
    }

    return {
      months: Object.entries(months).slice(0, 6),
      insights: intercompanyInsights,
      companyData: activeCompanies.map(proj => ({
        sigla: proj.societa,
        name: companies.find(c => c.sigla === proj.societa)?.name || proj.societa,
        balance: proj.baseBalance,
        sparkline: proj.weeklyProjections.map(w => ({ val: w.cumulativeBalance }))
      }))
    };
  }, [companies, allProjections, allMovements]);

  if (isLoadingCompanies) return null;

  if (!analysis) {
    return (
      <Card className="lg:col-span-4 border-dashed border-2">
        <CardContent className="h-40 flex flex-col items-center justify-center text-center">
          <Users2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            L'Intelligence Cross-Azienda richiede almeno 2 società attive con proiezioni generate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-4 shadow-xl border-primary/10 overflow-hidden">
      <CardHeader className="bg-primary/5 pb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">Intelligence Cross-Azienda</CardTitle>
            <CardDescription>Visione consolidata e sinergie tra tutte le tue attività</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Row 1: Sparklines */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b">
          {analysis.companyData.map((c) => (
            <div key={c.sigla} className="p-6 border-r last:border-r-0 hover:bg-muted/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Badge variant="secondary" className="mb-1">{c.sigla}</Badge>
                  <p className="text-xs font-bold text-muted-foreground truncate max-w-[120px]">{c.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tracking-tighter">{formatCurrency(c.balance)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo Attuale</p>
                </div>
              </div>
              <div className="h-12 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={c.sparkline}>
                    <Line 
                      type="monotone" 
                      dataKey="val" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2} 
                      dot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Column 1 & 2: Consolidation Table */}
          <div className="lg:col-span-2 p-6 border-r">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-black uppercase tracking-widest">Tabella di Consolidamento Mensile</h4>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">Mese</TableHead>
                  {analysis.companyData.map(c => (
                    <TableHead key={c.sigla} className="text-right">{c.sigla}</TableHead>
                  ))}
                  <TableHead className="text-right font-black bg-primary/5">Totale Gruppo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.months.map(([month, data]) => (
                  <TableRow key={month}>
                    <TableCell className="font-bold text-xs">{month}</TableCell>
                    {analysis.companyData.map(c => (
                      <TableCell key={c.sigla} className={cn(
                        "text-right text-xs font-mono",
                        data[c.sigla] < 5000 ? "text-red-500" : "text-foreground"
                      )}>
                        {formatCurrency(data[c.sigla])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-black text-xs bg-primary/5">
                      {formatCurrency(data.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Column 3: AI Insights */}
          <div className="p-6 bg-muted/20">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-black uppercase tracking-widest">Insight di Gruppo</h4>
            </div>
            <div className="space-y-4">
              {analysis.insights.length > 0 ? (
                analysis.insights.map((insight, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-background border shadow-sm flex gap-3 relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    <ArrowLeftRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed font-medium">
                      {insight}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-xl space-y-2">
                  <Info className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Nessuna sinergia rilevata</p>
                </div>
              )}
              
              <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex gap-2 items-center mb-2">
                  <AlertCircle className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Nota Strategica</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  L'analisi cross-azienda aggrega i dati di tutte le società per le quali disponi dei permessi di accesso. I saldi totali non tengono conto di eventuali partite di debito/credito infra-gruppo non registrate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
