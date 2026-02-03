'use server';
/**
 * @fileOverview An AI flow to analyze historical movements and suggest recurring income.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SuggestIncomeForecastsInputSchema = z.object({
  company: z.string().describe('The company to analyze.'),
  analysisCandidates: z.string().describe("A JSON string of potential recurring income, pre-processed by the client."),
});
export type SuggestIncomeForecastsInput = z.infer<typeof SuggestIncomeForecastsInputSchema>;

const IncomeForecastPatternSchema = z.object({
    societa: z.string().describe("The company code (e.g., 'LNC', 'STG') this pattern belongs to."),
    descrizionePulita: z.string().describe("A clean, generic description for this recurring income. E.g., 'Affitto Eris', 'Incentivi GSE'."),
    importoPrevisto: z.number().describe('The estimated amount for the forecast, based on the average payment.'),
    amountType: z.enum(['fixed', 'variable']).describe("'fixed' if amounts are very similar, otherwise 'variable'."),
    ricorrenza: z.enum(['Mensile', 'Bimestrale', 'Trimestrale', 'Quadrimestrale', 'Semestrale', 'Annuale', 'Altro']).describe("The identified recurrence pattern of the income."),
    giornoStimato: z.number().int().min(1).max(31).describe("The estimated day of the month the income is received."),
    primoMese: z.number().int().min(1).max(12).optional().describe("For non-monthly recurrences, the first month of the cycle (1=Jan, 12=Dec)."),
    categoria: z.string().describe('The most appropriate main category for the income, e.g., "Immobiliare", "Energia".'),
    sottocategoria: z.string().optional().describe('The most appropriate sub-category (e.g., "Affitti", "Incentivi GSE").'),
    ragione: z.string().describe('A brief explanation of why this forecast was suggested, mentioning number of payments found and average amount.'),
    sourceCandidateId: z.number().describe('The original ID of the candidate group from the input JSON that this suggestion is based on.'),
});
export type IncomeForecastPattern = z.infer<typeof IncomeForecastPatternSchema>;

const SuggestIncomeForecastsOutputSchema = z.object({
  suggestions: z.array(IncomeForecastPatternSchema),
});
export type SuggestIncomeForecastsOutput = z.infer<typeof SuggestIncomeForecastsOutputSchema>;


export async function suggestIncomeForecasts(input: SuggestIncomeForecastsInput): Promise<SuggestIncomeForecastsOutput> {
  return suggestIncomeForecastsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestIncomeForecastsPrompt',
  input: { schema: SuggestIncomeForecastsInputSchema },
  output: { schema: SuggestIncomeForecastsOutputSchema },
  prompt: `You are a financial analyst AI for Italian companies. Your task is to review pre-analyzed recurring income patterns and suggest them as future forecasts.

You are given a list of candidates for '{{company}}'.

**For each candidate:**
1.  **Clean Description**: Create a clean, general 'descrizionePulita' (e.g., 'Affitto H&S', 'Incentivi GSE').
2.  **Categorize**: Use the provided 'sourceCategory' and 'sourceSubcategory' as 'categoria' and 'sottocategoria'.
3.  **Provide Reasoning**: Give a brief 'ragione' (e.g., 'Trovati 12 incassi mensili per circa €800').
4.  **Pass-through fields**: You MUST copy 'avgAmount', 'amountType', 'ricorrenza', 'giornoStimato', 'primoMese' directly to your output fields 'importoPrevisto', 'amountType', 'ricorrenza', 'giornoStimato', 'primoMese'.
5.  **Link back**: For each suggestion, you MUST include the original \`id\` from the candidate object in the output field \`sourceCandidateId\`.

**Candidate Data from Client:**
{{{analysisCandidates}}}

Respond with a JSON object containing a 'suggestions' array. If you find no patterns, return an empty array.`,
});

const suggestIncomeForecastsFlow = ai.defineFlow(
  {
    name: 'suggestIncomeForecastsFlow',
    inputSchema: SuggestIncomeForecastsInputSchema,
    outputSchema: SuggestIncomeForecastsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      console.error("AI returned no output for income forecast suggestions.");
      return { suggestions: [] };
    }
    return output;
  }
);

    