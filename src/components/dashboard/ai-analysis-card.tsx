// src/components/dashboard/ai-analysis-card.tsx

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";

interface AiAnalysisCardProps {
    alerts: string[];
}

export function AiAnalysisCard({ alerts }: AiAnalysisCardProps) {
  if (!alerts || alerts.length === 0) {
    return null; // Don't render the card if there are no alerts
  }

  return (
    <Card className="col-span-1 lg:col-span-3 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-5 w-5" />
            Analisi e Alert dall'IA
        </CardTitle>
        <CardDescription className="text-amber-800 dark:text-amber-400">
            L'intelligenza artificiale ha rilevato i seguenti punti di attenzione analizzando i tuoi dati.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 list-disc pl-5">
            {alerts.map((alert, index) => (
                <li key={index} className="text-sm font-medium text-amber-900 dark:text-amber-300">
                    {alert}
                </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
