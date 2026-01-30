'use server';

/**
 * @fileOverview An AI flow to analyze cash flow, providing a rich, structured output for dashboard visualization and trend analysis.
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
});

const AnalyzeCashFlowInputSchema = z.object({
  financialData: z.string().describe('A JSON string containing movements, income forecasts, and expense forecasts for the company.'),
  analysisPeriodDays: z.number().describe('The number of days into the future to analyze.'),
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to analyze.'),
});
export type AnalyzeCashFlowInput = z.infer<typeof AnalyzeCashFlowInputSchema>;

const AnalyzeCashFlowOutputSchema = z.object({
  overallSummary: z.string().describe('A high-level summary of the entire analysis period.'),
  alerts: z.array(z.string()).describe('A list of critical alerts or warnings based on trend analysis compared to the previous year or significant deviations.'),
  monthlyAnalysis: z.array(MonthlyDataSchema).describe('An array of objects, each representing a month in the cash flow analysis.'),
  totalInvestmentCapacity: z.number().describe('The total estimated amount available for investment at the end of the whole period. Calculated as the final ending balance minus a prudent safety buffer (e.g., 20% of the last month\'s total outflows).'),
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
You are given financial data (past movements, future income/expense forecasts) in a JSON string. The data includes the current year's data and also the previous year's for comparison.

Your analysis must produce a "Scenario Reale" that includes:
1.  **Month-by-Month Calculation:**
    - For each month in the analysis period, calculate the progressive cash flow. The starting balance for the first month is derived from past movements. Subsequent months start with the previous month's ending balance.
    - Use the 'probabilita' field to weigh future income and expenses for a realistic projection.
    - **Dynamic Tax Provisioning:** Do not use a fixed percentage. You MUST estimate future tax payments based on the provided data:
        - **IVA (VAT):** Based on projected revenues and costs for the quarter, estimate the next quarterly VAT payment (as an outflow).
        - **IRES/IRPEF (Income Tax):** Based on the projected profit (entrate - uscite) for the relevant period (e.g., 6 months for 'acconto'), calculate and provision the income tax payments (typically in June and November). Assume a standard 24% IRES rate on profits if not specified otherwise.
    - For each month, determine: 'month' (e.g., "Luglio 2025"), 'inflows', 'outflows' (including your dynamic tax provisions), and 'endBalance'.

2.  **Overall Summary & Investment Capacity:**
    - 'overallSummary': A brief, insightful conclusion for the entire analysis period. Focus on the final liquidity situation and key trends.
    - 'totalInvestmentCapacity': The final investment capacity at the end of the last month of the analysis. Calculate it as the final ending balance minus a prudent safety buffer (e.g., 20% of that last month's total outflows).

3.  **Alerts & Quality Analysis:**
    - Compare the projected inflows and outflows of each month with the actuals from the same month in the previous year (provided in the financial data).
    - If you detect a significant negative trend (e.g., spending up >20% YoY, income down >20% YoY for a specific month), you MUST generate a concise alert in the 'alerts' array. Example: "Attenzione: le uscite per Luglio 2025 sono previste in aumento del 25% rispetto a Luglio 2024."

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
      return {
        overallSummary: 'Mi dispiace, ma al momento non riesco a elaborare la tua richiesta. Ciò potrebbe essere dovuto a un volume elevato di domande o al superamento dei limiti di utilizzo del piano gratuito. Riprova tra qualche istante.',
        totalInvestmentCapacity: 0,
        monthlyAnalysis: [],
        alerts: ["Analisi AI non disponibile al momento."],
      };
    }
  }
);
