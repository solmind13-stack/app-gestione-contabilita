
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { generateFinancialInsights } from "@/ai/flows/generate-financial-insights";
import type { FinancialInsightsOutput } from "@/ai/flows/generate-financial-insights";
import type { Movimento, Scadenza, PrevisioneEntrata, PrevisioneUscita } from '@/lib/types';
import { Lightbulb, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AiInsightsProps {
  allData: {
    movements: Movimento[];
    deadlines: Scadenza[];
    incomeForecasts: PrevisioneEntrata[];
    expenseForecasts: PrevisioneUscita[];
  };
  company: 'LNC' | 'STG' | 'Tutte';
}

export function AiInsights({ allData, company }: AiInsightsProps) {
  const [insights, setInsights] = useState<FinancialInsightsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const financialDataString = useMemo(() => {
    // We create a summary to send to the AI, to avoid sending too much data.
    const summary = {
      totalMovements: allData.movements.length,
      totalDeadlines: allData.deadlines.length,
      totalIncomeForecasts: allData.incomeForecasts.length,
      totalExpenseForecasts: allData.expenseForecasts.length,
      // Add more aggregated data if needed by the prompt
    };
    return JSON.stringify(summary, null, 2);
  }, [allData]);


  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const result = await generateFinancialInsights({
        companyName: company,
        financialData: financialDataString,
      });
      setInsights(result);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      toast({
        variant: "destructive",
        title: "Errore AI",
        description: "Impossibile generare gli insights in questo momento.",
      });
      setInsights(null); // Clear previous insights on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchInsights();
  }, [financialDataString, company]); // Re-fetch if data or company changes

  const handleRefresh = () => {
    fetchInsights();
  };

  const displayInsights = !isLoading && insights;

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
        ) : displayInsights ? (
          <>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Situazione Attuale</h3>
              <p className="text-sm">{insights?.summary || 'Nessun riepilogo disponibile.'}</p>
            </div>

            {insights.attentionItems && insights.attentionItems.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Attenzione
                </h3>
                <ul className="space-y-2">
                  {insights.attentionItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insights.suggestionItems && insights.suggestionItems.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  Suggerimenti
                </h3>
                <ul className="space-y-2">
                  {insights.suggestionItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-8">Nessun insight da mostrare. Prova a generare nuovamente.</p>
        )}
      </CardContent>
    </Card>
  );
}
