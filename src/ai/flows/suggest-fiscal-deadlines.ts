'use server';
/**
 * @fileOverview An AI flow to analyze historical movements and suggest recurring fiscal and operational deadlines.
 *
 * - suggestFiscalDeadlines - The function that calls the AI flow.
 * - SuggestFiscalDeadlinesInput - The input type.
 * - SuggestFiscalDeadlinesOutput - The output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SuggestFiscalDeadlinesInputSchema = z.object({
  company: z.string().describe('The company to analyze. If "Tutte", analyze each company separately.'),
  analysisCandidates: z.string().describe('A JSON string of potential recurring expenses, pre-processed by the client. Each object contains a sample description, count, average amount, and a list of dates.'),
  existingDeadlines: z.string().describe('A JSON string of all existing deadlines (Scadenza[]) to avoid creating duplicates.'),
});
export type SuggestFiscalDeadlinesInput = z.infer<typeof SuggestFiscalDeadlinesInputSchema>;

const SuggestedDeadlineSchema = z.object({
    societa: z.string(),
    descrizione: z.string().describe('A clean, common description for this recurring fiscal deadline. E.g., "Pagamento IVA 1° Trimestre", "Acconto IRES", "Canone Telefonico TIM".'),
    importoPrevisto: z.number().describe('The estimated amount for the deadline, based on the average or last payment.'),
    dataScadenza: z.string().describe('The calculated next due date for the deadline in YYYY-MM-DD format.'),
    ricorrenza: z.enum(['Mensile', 'Trimestrale', 'Semestrale', 'Annuale']),
    tipoTassa: z.string().optional().describe('The specific type of tax or contribution (e.g., IVA, IRES, INPS, Ritenute). Only for fiscal expenses. Omit or leave empty for operational expenses.'),
    periodoRiferimento: z.string().optional().describe('The reference period for the tax (e.g., "Q2 2025", "Giugno 2025"). Only for fiscal expenses. Omit or leave empty for operational expenses.'),
    categoria: z.string().describe('The main category, e.g., "Tasse" for taxes or "Gestione Generale" for operational costs.'),
    sottocategoria: z.string().optional().describe('The sub-category (e.g., "IVA Trimestrale", "Telefonia").'),
    reason: z.string().describe('A brief explanation of why this deadline was suggested, mentioning number of payments found and average amount.'),
});

const SuggestFiscalDeadlinesOutputSchema = z.object({
  suggestions: z.array(SuggestedDeadlineSchema),
});
export type SuggestFiscalDeadlinesOutput = z.infer<typeof SuggestFiscalDeadlinesOutputSchema>;

export async function suggestFiscalDeadlines(input: SuggestFiscalDeadlinesInput): Promise<SuggestFiscalDeadlinesOutput> {
  return suggestFiscalDeadlinesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFiscalDeadlinesPrompt',
  input: { schema: SuggestFiscalDeadlinesInputSchema },
  output: { schema: SuggestFiscalDeadlinesOutputSchema },
  prompt: `You are an expert financial analyst AI. Your task is to identify recurring expenses from a pre-processed list of potential candidates and suggest them as future deadlines.

You are given a list of candidates for '{{company}}' and all existing deadlines. You must not suggest deadlines that already exist.

Each candidate in the list has a sample description, a count of occurrences, an average amount, and a list of dates.
Analyze this list to determine the recurrence pattern (Mensile, Trimestrale, etc.) and calculate the next due date.

**For each valid recurring expense you identify:**
-   Determine the recurrence (Mensile, Trimestrale, Semestrale, Annuale). A good recurring expense should have consistent intervals between dates.
-   Calculate the next due date based on the last payment's date and the identified recurrence.
-   Create a clean, general 'descrizione' for the deadline (e.g., 'Canone Telefonico TIM').
-   If it is a clear fiscal expense (e.g., description contains IVA, F24, IRES, INPS), try to determine 'tipoTassa' and 'periodoRiferimento'. For all other operational expenses (like utilities, rent), you MUST OMIT these fields or provide an empty string.
-   Assign the most appropriate 'categoria' and 'sottocategoria'.
-   Check if a similar deadline (same description pattern and recurrence) already exists in 'existingDeadlines'. **If it exists, DO NOT include it in your output.**
-   Provide a 'reason' explaining why you are suggesting it (e.g., 'Found 12 monthly payments for about €25').

Potential Recurring Expenses:
{{{analysisCandidates}}}

Existing Deadlines (to avoid duplicates):
{{{existingDeadlines}}}

Respond with a JSON object containing a 'suggestions' array of the new, non-existing deadlines you have identified. If you find no new recurring deadlines, return an empty array.
`,
});

const suggestFiscalDeadlinesFlow = ai.defineFlow(
  {
    name: 'suggestFiscalDeadlinesFlow',
    inputSchema: SuggestFiscalDeadlinesInputSchema,
    outputSchema: SuggestFiscalDeadlinesOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        return { suggestions: [] };
      }
      return output;
    } catch (error: any) {
        console.error("Error in suggestFiscalDeadlinesFlow:", error);
        // Instead of throwing, which can crash the server action,
        // we return a valid but empty output. The client will handle this
        // as "no suggestions found", which is a safe fallback.
        return { suggestions: [] };
    }
  }
);
