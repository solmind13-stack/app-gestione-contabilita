'use server';
/**
 * @fileOverview An AI flow to analyze historical movements and suggest recurring operational expenses.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SuggestExpenseForecastsInputSchema = z.object({
  company: z.string().describe('The company to analyze.'),
  analysisCandidates: z.string().describe("A JSON string of potential recurring operational expenses, pre-processed by the client."),
});
export type SuggestExpenseForecastsInput = z.infer<typeof SuggestExpenseForecastsInputSchema>;

const ExpenseForecastPatternSchema = z.object({
    societa: z.string().describe("The company code (e.g., 'LNC', 'STG') this pattern belongs to."),
    descrizionePulita: z.string().describe("A clean, generic description for this recurring expense. E.g., 'Canone Telefonico TIM', 'Utenza ENEL Energia'. Omit fiscal terms."),
    importoPrevisto: z.number().describe('The estimated amount for the forecast, based on the average payment.'),
    amountType: z.enum(['fixed', 'variable']).describe("'fixed' if amounts are very similar (less than 5% deviation), otherwise 'variable'."),
    ricorrenza: z.enum(['Mensile', 'Bimestrale', 'Trimestrale', 'Quadrimestrale', 'Semestrale', 'Annuale', 'Altro']).describe("The identified recurrence pattern of the expense."),
    giornoStimato: z.number().int().min(1).max(31).describe("The estimated day of the month the payment is due (e.g., 15 for the 15th). For non-monthly, it's the day in the due month."),
    primoMese: z.number().int().min(1).max(12).optional().describe("For non-monthly recurrences, the first month of the cycle (1=Jan, 12=Dec)."),
    categoria: z.string().describe('The most appropriate main category for an operational expense, e.g., "Gestione Generale", "Fornitori".'),
    sottocategoria: z.string().optional().describe('The most appropriate sub-category (e.g., "Telefonia", "Servizi").'),
    metodoPagamentoTipico: z.string().optional().describe("The typical payment method if identifiable (e.g., 'Addebito Diretto (SDD)', 'Bonifico')."),
    ragione: z.string().describe('A brief explanation of why this forecast was suggested, mentioning number of payments found and average amount.'),
    sourceCandidateId: z.number().describe('The original ID of the candidate group from the input JSON that this suggestion is based on.'),
});
export type ExpenseForecastPattern = z.infer<typeof ExpenseForecastPatternSchema>;

const SuggestExpenseForecastsOutputSchema = z.object({
  suggestions: z.array(ExpenseForecastPatternSchema),
});
export type SuggestExpenseForecastsOutput = z.infer<typeof SuggestExpenseForecastsOutputSchema>;


export async function suggestExpenseForecasts(input: SuggestExpenseForecastsInput): Promise<SuggestExpenseForecastsOutput> {
  return suggestExpenseForecastsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestExpenseForecastsPrompt',
  input: { schema: SuggestExpenseForecastsInputSchema },
  output: { schema: SuggestExpenseForecastsOutputSchema },
  prompt: `You are a financial analyst AI for Italian companies. Your task is to review pre-analyzed recurring expense patterns and suggest them as future schedulable forecasts.
Focus ONLY on OPERATIONAL expenses like rent, utilities, software, etc. IGNORE fiscal expenses (taxes like F24, IMU, IVA).

You are given a list of candidates for '{{company}}'.

**For each candidate:**
1.  **Clean Description**: Create a clean, general 'descrizionePulita' (e.g., 'Canone Telefonico TIM', 'Utenza ENEL Energia').
2.  **Categorize**: Use the provided 'sourceCategory' and 'sourceSubcategory' as 'categoria' and 'sottocategoria'. Ensure they are operational categories (e.g., "Gestione Generale", "Fornitori").
3.  **Provide Reasoning**: Give a brief 'ragione' (e.g., 'Trovati 12 pagamenti mensili per circa €30').
4.  **Pass-through fields**: You MUST copy 'avgAmount', 'amountType', 'ricorrenza', 'giornoStimato', 'primoMese' directly to your output fields 'importoPrevisto', 'amountType', 'ricorrenza', 'giornoStimato', 'primoMese'.
5.  **Link back**: For each suggestion, you MUST include the original \`id\` from the candidate object in the output field \`sourceCandidateId\`.

**Candidate Data from Client:**
{{{analysisCandidates}}}

Respond with a JSON object containing a 'suggestions' array. If you find no valid operational patterns, return an empty array.`,
});

const suggestExpenseForecastsFlow = ai.defineFlow(
  {
    name: 'suggestExpenseForecastsFlow',
    inputSchema: SuggestExpenseForecastsInputSchema,
    outputSchema: SuggestExpenseForecastsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      console.error("AI returned no output for expense forecast suggestions.");
      return { suggestions: [] };
    }
    return output;
  }
);

    