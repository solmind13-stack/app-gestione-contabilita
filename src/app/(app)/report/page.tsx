// src/app/(app)/report/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateNarrativeReport, type GenerateNarrativeReportOutput } from '@/ai/flows/generate-report-flow';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Download } from 'lucide-react';
import { ReportChart } from '@/components/report/report-chart';

export default function ReportPage() {
  const [report, setReport] = useState<GenerateNarrativeReportOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setReport(null);
    toast({
      title: 'Generazione Report in corso...',
      description: 'L\'AI sta analizzando i dati per creare il report. Potrebbero volerci alcuni istanti.',
    });

    try {
      // In a real app, you'd pass a comprehensive summary of real data.
      const financialDataSummary = `
        - Liquidità attuale: €25,430
        - Scadenze urgenti (30gg): €2,100
        - Entrate previste (mese): €15,800
        - Uscite previste (mese): €8,500
        - Cash flow storico (ultimi 6 mesi): positivo con crescita media del 5% mese su mese.
        - Clienti principali per fatturato: Eris (€2008/mese), H&S (€793/mese).
        - Spese principali: Fornitori materiali edili, Tasse (IMU, IVA), Manutenzioni.
      `;
      const result = await generateNarrativeReport({
        companyName: 'LNC e STG',
        financialData: financialDataSummary,
      });
      setReport(result);
      toast({
        title: 'Report Generato!',
        description: 'Il report narrativo è pronto per la revisione.',
        className: 'bg-green-100 dark:bg-green-900',
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        variant: 'destructive',
        title: 'Errore durante la generazione',
        description: 'Impossibile generare il report in questo momento.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generazione Report Finanziario</CardTitle>
          <CardDescription>
            Crea report narrativi e analisi approfondite basate sui dati finanziari aggregati utilizzando l'intelligenza artificiale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Clicca sul pulsante qui sotto per avviare l'analisi AI. Il sistema elaborerà movimenti, scadenze e previsioni per generare un report completo con commenti, grafici e suggerimenti strategici.
          </p>
          <Button onClick={handleGenerateReport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
               <>
                <FileText className="mr-2 h-4 w-4" />
                Genera Report Narrativo
               </>
            )}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader className='flex-row items-center justify-between'>
            <div>
                <CardTitle>Report Finanziario Narrativo</CardTitle>
                <CardDescription>Analisi e soluzioni generate dall&apos;AI</CardDescription>
            </div>
             <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Scarica PDF
             </Button>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="prose prose-sm dark:prose-invert max-w-full">
                <p>{report.report}</p>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Andamento Entrate/Uscite (Grafico)</h3>
                <div className="h-[300px]">
                    <ReportChart />
                </div>
            </div>
            
          </CardContent>
        </Card>
      )}
    </div>
  );
}
