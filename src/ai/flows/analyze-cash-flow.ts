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
import { formatCurrency } from '@/lib/utils';


const MonthlyBreakdownSchema = z.object({
  monthName: z.string().describe('The name of the month being analyzed (e.g., "Luglio 2025").'),
  summary: z.string().describe('A brief narrative summary for this specific month, highlighting key movements.'),
  startingBalance: z.number().describe('The cash balance at the beginning of the month.'),
  totalInflows: z.number().describe('The sum of all expected inflows for the month.'),
  totalOutflows: z.number().describe('The sum of all expected outflows for the month.'),
  endingBalance: z.number().describe('The projected cash balance at the end of the month.'),
  investmentCapacity: z.number().describe('The estimated amount of money available for new investments during this month.'),
});

const AnalyzeCashFlowInputSchema = z.object({
  financialData: z.string().describe('A JSON string containing movements, income forecasts, and expense forecasts.'),
  analysisPeriodDays: z.number().describe('The number of days into the future to analyze.'),
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to analyze.'),
});
export type AnalyzeCashFlowInput = z.infer<typeof AnalyzeCashFlowInputSchema>;

const AnalyzeCashFlowOutputSchema = z.object({
  overallSummary: z.string().describe('A high-level summary of the entire analysis period.'),
  finalInvestmentCapacity: z.string().describe('The total estimated amount available for investment at the end of the whole period, formatted as a currency string.'),
  monthlyBreakdown: z.array(MonthlyBreakdownSchema).describe('An array of objects, each representing a monthly slide in the cash flow presentation.'),
});
export type AnalyzeCashFlowOutput = z.infer<typeof AnalyzeCashFlowOutputSchema>;

export async function analyzeCashFlow(input: AnalyzeCashFlowInput): Promise<AnalyzeCashFlowOutput> {
  return analyzeCashFlowFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCashFlowPrompt',
  input: {schema: AnalyzeCashFlowInputSchema},
  output: {schema: AnalyzeCashFlowOutputSchema},
  prompt: `You are an expert financial analyst preparing a slide-based presentation for an Italian company. Your task is to perform a cash flow analysis for the next {{analysisPeriodDays}} days for '{{company}}'.

You are given financial data (past movements, future income/expense forecasts) in a JSON string.

Your analysis must be structured as a month-by-month presentation. For each month in the analysis period:
1.  **Calculate Progressive Cash Flow:** Start with the initial cash balance (from past movements). For each subsequent month, the starting balance is the previous month's ending balance.
2.  **Weighted Forecasts:** Use the 'probabilita' field to weigh future income and expenses.
3.  **Monthly Slide:** Create a JSON object for each month containing:
    - 'monthName': The name of the month (e.g., "Luglio 2025").
    - 'summary': A brief, insightful narrative for that month's financial activity.
    - 'startingBalance', 'totalInflows', 'totalOutflows', 'endingBalance': The calculated financial figures for the month.
    - 'investmentCapacity': A safe "investment capacity" for that month. A good rule of thumb is to take the projected ending balance and subtract a safety buffer (e.g., 20% of that month's total outflows). This value must be a number.
4.  **Overall Summary:**
    - 'overallSummary': A brief, high-level conclusion for the entire analysis period.
    - 'finalInvestmentCapacity': The final investment capacity at the end of the last month, formatted as a currency string (e.g., "€1.234,56").
    - 'monthlyBreakdown': An array of the monthly slide objects you created.

Financial Data:
{{{financialData}}}

Analyze the data and provide the response in the requested JSON format. Ensure all monetary values in the monthly breakdown are numbers, not strings.
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
        overallSummary: 'Mi dispiace, ma al momento non riesco a elaborare la tua richiesta. Ciò potrebbe essere dovuto a un volume elevato di domande o al superamento dei limiti di utilizzo del piano gratuito. Riprova tra qualche istante.',
        finalInvestmentCapacity: '€0,00',
        monthlyBreakdown: [],
      };
    }
  }
);
