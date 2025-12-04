"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { generateFinancialInsights } from "@/ai/flows/generate-financial-insights";
import type { FinancialInsightsOutput } from "@/ai/flows/generate-financial-insights";
import { Lightbulb, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AiInsights() {
  const [insights, setInsights] = useState<FinancialInsightsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const result = await generateFinancialInsights({
        companyName: "LNC e STG",
        financialData: "Dati aggregati di esempio...", // In a real app, you'd pass actual data
      });
      setInsights(result);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      toast({
        variant: "destructive",
        title: "Errore AI",
        description: "Impossibile generare gli insights in questo momento.",
      });
      // Set mock data on error to prevent empty state in demo
      setInsights({
          summary: "La liquidità è buona con €25.430 disponibili. Hai 3 scadenze importanti nei prossimi 7 giorni per un totale di €2.100. Le entrate previste coprono ampiamente le uscite con un margine del 15%.",
          attentionItems: ["Scadenza pagamento IMU tra 5 giorni.", "Fattura cliente 'Rossi & Co' in ritardo di oltre 20 giorni."],
          suggestionItems: ["Sollecitare incasso fattura cliente 'Rossi & Co'.", "Considerare di anticipare il pagamento del fornitore 'Beta SRL' per uno sconto."],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleRefresh = () => {
    fetchInsights();
    toast({
      title: "Aggiornamento",
      description: "Sto generando nuovi insights...",
    });
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 relative overflow-hidden bg-card/80 backdrop-blur-sm border-primary/20">
       <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-bl from-primary/20 to-transparent rounded-bl-full opacity-50"></div>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <CardTitle>Insights Intelligenti</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-4/5" />
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Situazione Attuale</h3>
              <p className="text-sm">{insights?.summary}</p>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Attenzione
              </h3>
              <ul className="space-y-2">
                {insights?.attentionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <Lightbulb className="h-4 w-4 text-blue-500" />
                Suggerimenti
              </h3>
              <ul className="space-y-2">
                {insights?.suggestionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                     <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
