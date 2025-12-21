// src/ai/flows/analyze-cash-flow.ts
'use server';

/**
 * @fileOverview An AI flow to analyze cash flow, providing a rich, structured output for dashboard visualization.
 *
 * - analyzeCashFlow - A function that handles the cash flow analysis.
 * - AnalyzeCashFlowInput - The input type for the analyzeCashFlow function.
 * - AnalyzeCashFlowOutput - The return type for the analyzeCashFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MonthlyDataSchema = z.object({
  month: z.string().describe('The month being analyzed (e.g., "Luglio 2025").'),
  inflows: z.number().describe('Total inflows for the month.'),
  outflows: z.number().describe('Total outflows for the month.'),
  endBalance: z.number().describe('Projected ending balance for the month.'),
  investmentCapacity: z.number().describe('Estimated amount available for new investments this month.'),
});

const CategoryBreakdownSchema = z.object({
  name: z.string().describe('The category name.'),
  amount: z.number().describe('The total amount for this category.'),
});

const AnalyzeCashFlowInputSchema = z.object({
  financialData: z.string().describe('A JSON string containing movements, income forecasts, and expense forecasts.'),
  analysisPeriodDays: z.number().describe('The number of days into the future to analyze.'),
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to analyze.'),
});
export type AnalyzeCashFlowInput = z.infer<typeof AnalyzeCashFlowInputSchema>;

const AnalyzeCashFlowOutputSchema = z.object({
  overallSummary: z.string().describe('A high-level summary of the entire analysis period.'),
  totalInvestmentCapacity: z.number().describe('The total estimated amount available for investment at the end of the whole period.'),
  monthlyAnalysis: z.array(MonthlyDataSchema).describe('An array of objects, each representing a month in the cash flow analysis.'),
  inflowBreakdown: z.array(CategoryBreakdownSchema).describe('A breakdown of total expected inflows by category for the entire period.'),
  outflowBreakdown: z.array(CategoryBreakdownSchema).describe('A breakdown of total expected outflows by category for the entire period.'),
});
export type AnalyzeCashFlowOutput = z.infer<typeof AnalyzeCashFlowOutputSchema>;

export async function analyzeCashFlow(input: AnalyzeCashFlowInput): Promise<AnalyzeCashFlowOutput> {
  return analyzeCashFlowFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCashFlowPrompt',
  input: {schema: AnalyzeCashFlowInputSchema},
  output: {schema: AnalyzeCashFlowOutputSchema},
  prompt: `You are an expert financial analyst for an Italian company. Your task is to perform a detailed cash flow analysis for the next {{analysisPeriodDays}} days for '{{company}}'.

You are given financial data (past movements, future income/expense forecasts) in a JSON string.

Your analysis must include:
1.  **Month-by-Month Calculation:**
    - For each month in the analysis period, calculate the progressive cash flow. The starting balance for the first month is derived from past movements. Subsequent months start with the previous month's ending balance.
    - Use the 'probabilita' field to weigh future income and expenses for a realistic projection.
    - For each month, determine: 'month' (e.g., "Luglio 2025"), 'inflows', 'outflows', 'endBalance', and a prudent 'investmentCapacity'. A good rule for 'investmentCapacity' is the ending balance minus a safety buffer (e.g., 20% of that month's total outflows).

2.  **Category Breakdown for the Entire Period:**
    - Aggregate all weighted inflows for the entire period and group them by 'categoria'. This will be the 'inflowBreakdown'.
    - Aggregate all weighted outflows for the entire period and group them by 'categoria'. This will be the 'outflowBreakdown'.

3.  **Overall Summary:**
    - 'overallSummary': A brief, insightful conclusion for the entire analysis period. Focus on the final liquidity situation and key trends.
    - 'totalInvestmentCapacity': The final investment capacity at the end of the last month of the analysis.

Financial Data:
{{{financialData}}}

Provide the response in the requested JSON format. Ensure all monetary values are numbers, not strings.
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
        totalInvestmentCapacity: 0,
        monthlyAnalysis: [],
        inflowBreakdown: [],
        outflowBreakdown: [],
      };
    }
  }
);
