// src/ai/flows/analyze-cash-flow.ts
'use server';

/**
 * @fileOverview An AI flow to analyze cash flow based on financial data and provide investment capacity.
 *
 * - analyzeCashFlow - A function that handles the cash flow analysis.
 * - AnalyzeCashFlowInput - The input type for the analyzeCashFlow function.
 * - AnalyzeCashFlowOutput - The return type for the analyzeCashFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCashFlowInputSchema = z.object({
  financialData: z.string().describe('A JSON string containing movements, income forecasts, and expense forecasts.'),
  analysisPeriodDays: z.number().describe('The number of days into the future to analyze.'),
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to analyze.'),
});
export type AnalyzeCashFlowInput = z.infer<typeof AnalyzeCashFlowInputSchema>;

const AnalyzeCashFlowOutputSchema = z.object({
  narrativeSummary: z.string().describe('A narrative summary of the cash flow analysis, explaining key inflows, outflows, and the final balance projection.'),
  investmentCapacity: z.string().describe('The estimated amount of money available for new investments, formatted as a currency string (e.g., "€10,000.00").'),
});
export type AnalyzeCashFlowOutput = z.infer<typeof AnalyzeCashFlowOutputSchema>;

export async function analyzeCashFlow(input: AnalyzeCashFlowInput): Promise<AnalyzeCashFlowOutput> {
  return analyzeCashFlowFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCashFlowPrompt',
  input: {schema: AnalyzeCashFlowInputSchema},
  output: {schema: AnalyzeCashFlowOutputSchema},
  prompt: `You are an expert financial analyst for Italian companies. Your task is to perform a cash flow analysis for the next {{analysisPeriodDays}} days for the company '{{company}}'.

You are given the following financial data in a JSON string:
- Past movements (to calculate the starting cash balance).
- Future income forecasts with their probability.
- Future expense forecasts with their probability.

Your analysis must:
1.  Calculate the starting cash balance by summing all past 'entrata' and subtracting all past 'uscita' from the movements.
2.  Project the cash flow over the specified period by considering all scheduled income and expenses from the forecasts. Use the 'probabilita' field to create a weighted forecast. For example, an income of €1000 with 90% probability should be considered as €900.
3.  Generate a clear, narrative summary in Italian. This summary should explain the starting balance, the most significant expected inflows and outflows, and the projected final balance at the end of the period.
4.  Based on the projected final balance, estimate a safe "investment capacity". This is the amount of money the company could likely invest without compromising its operational liquidity. A good rule of thumb is to take the projected final balance and subtract a safety buffer (e.g., 20% of total expected expenses for the period). Format this as a currency string like "€1.234,56".

Financial Data:
{{{financialData}}}

Analyze the data and provide the response in the requested JSON format.
`,
});

const analyzeCashFlowFlow = ai.defineFlow(
  {
    name: 'analyzeCashFlowFlow',
    inputSchema: AnalyzeCashFlowInputSchema,
    outputSchema: AnalyzeCashFlowOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        throw new Error('AI analysis returned no output.');
      }
      return output;
    } catch (error) {
      console.error('Error in analyzeCashFlowFlow:', error);
      // Return a controlled error response.
      return {
        narrativeSummary: 'Mi dispiace, ma al momento non riesco a elaborare la tua richiesta. Ciò potrebbe essere dovuto a un volume elevato di domande o al superamento dei limiti di utilizzo del piano gratuito. Riprova tra qualche istante.',
        investmentCapacity: '€0,00',
      };
    }
  }
);
