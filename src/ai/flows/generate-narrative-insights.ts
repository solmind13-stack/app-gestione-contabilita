'use server';

/**
 * @fileOverview Generates a comprehensive narrative briefing of a company's financial situation.
 *
 * - generateNarrativeInsights - The main function to call the AI flow.
 * - GenerateNarrativeInsightsInput - The input type for the flow.
 * - GenerateNarrativeInsightsOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateNarrativeInsightsInputSchema = z.object({
  societa: z.string().describe("The company for which to generate the insights."),
  userId: z.string().describe("The user requesting the insights."),
  cashFlowSummary: z.string().describe("A JSON string containing the 'realistic' cash flow projection summary."),
  seasonalPatterns: z.string().describe("A JSON string of identified seasonal financial patterns."),
  upcomingDeadlines: z.string().describe("A JSON string of upcoming fiscal and operational deadlines."),
  liquidityStatus: z.string().describe("A JSON string representing the current liquidity alert status (e.g., green, yellow, red) and its message."),
});
export type GenerateNarrativeInsightsInput = z.infer<typeof GenerateNarrativeInsightsInputSchema>;

const GenerateNarrativeInsightsOutputSchema = z.object({
  currentSituation: z.string().describe("A 1-2 sentence overview of the general financial state."),
  challenges: z.array(z.string()).describe("A list of 2-3 bullet points on imminent critical issues."),
  opportunities: z.array(z.string()).describe("A list of 1-2 bullet points on favorable windows for spending or investment."),
  monthlyAdvice: z.string().describe("A single, primary recommendation for the month."),
  fullNarrative: z.string().describe("The complete, integrated financial briefing in natural language."),
});
export type GenerateNarrativeInsightsOutput = z.infer<typeof GenerateNarrativeInsightsOutputSchema>;

export async function generateNarrativeInsights(input: GenerateNarrativeInsightsInput): Promise<GenerateNarrativeInsightsOutput> {
  return generateNarrativeInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNarrativeInsightsPrompt',
  input: { schema: GenerateNarrativeInsightsInputSchema },
  output: { schema: GenerateNarrativeInsightsOutputSchema },
  prompt: `
    Sei un consulente finanziario d'élite per un imprenditore italiano. Il tuo compito è tradurre dati finanziari complessi in un briefing chiaro, conciso e strategico. Usa un tono professionale ma accessibile.

    Analizza i seguenti dati per la società '{{societa}}':
    - Proiezione di cassa: {{{cashFlowSummary}}}
    - Pattern stagionali: {{{seasonalPatterns}}}
    - Scadenze imminenti: {{{upcomingDeadlines}}}
    - Stato di liquidità attuale: {{{liquidityStatus}}}

    Genera un briefing finanziario in italiano strutturato come segue:
    1.  **Situazione attuale**: Un riassunto di 1-2 frasi sullo stato di salute finanziaria generale.
    2.  **Prossime sfide**: Un elenco di 2-3 punti elenco che evidenziano le criticità più immediate (es. pagamenti importanti, cali di liquidità).
    3.  **Opportunità**: Un elenco di 1-2 punti elenco che indicano finestre temporali favorevoli per investimenti o spese.
    4.  **Consiglio del mese**: Una singola frase con il suggerimento più importante per il mese corrente.
    5.  **Full Narrative**: Un paragrafo completo che integra tutti i punti precedenti in una narrazione fluida e comprensibile.

    Sii specifico, basandoti sui dati forniti. Per esempio, se vedi un alert di liquidità rosso, la tua analisi deve riflettere quell'urgenza.
  `,
});

const generateNarrativeInsightsFlow = ai.defineFlow(
  {
    name: 'generateNarrativeInsightsFlow',
    inputSchema: GenerateNarrativeInsightsInputSchema,
    outputSchema: GenerateNarrativeInsightsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error("Il modello AI non ha restituito un'analisi narrativa valida.");
      }
      return output;
    } catch (error) {
      console.error("Errore nel flow 'generateNarrativeInsightsFlow':", error);
      throw new Error(
        "L'analisi narrativa non è riuscita. Potrebbe esserci un problema con i dati forniti o con il servizio AI."
      );
    }
  }
);
