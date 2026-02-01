'use server';
/**
 * @fileOverview An AI flow to analyze historical movements and suggest recurring expense patterns.
 *
 * - suggestFiscalDeadlines - The function that calls the AI flow.
 * - SuggestFiscalDeadlinesInput - The input type.
 * - RecurringExpensePattern - The output type for a single pattern.
 * - SuggestFiscalDeadlinesOutput - The full output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SuggestFiscalDeadlinesInputSchema = z.object({
  company: z.string().describe('The company to analyze.'),
  analysisCandidates: z.string().describe("A JSON string of potential recurring expenses, pre-processed by the client. Each object contains a sample description, count, an array of all 'amounts', an 'avgAmount', a list of 'dates', and the most common 'sourceCategory' and 'sourceSubcategory' from the source movements."),
});
export type SuggestFiscalDeadlinesInput = z.infer<typeof SuggestFiscalDeadlinesInputSchema>;

// This is the new, richer output schema for a single pattern
const RecurringExpensePatternSchema = z.object({
    societa: z.string().describe("The company code (e.g., 'LNC', 'STG') this pattern belongs to."),
    descrizionePulita: z.string().describe("A clean, generic description for this recurring expense. E.g., 'Canone Telefonico TIM', 'Rata Mutuo BAPR', 'Pagamento F24'."),
    importoPrevisto: z.number().describe('The estimated amount for the deadline, based on the average payment.'),
    amountType: z.enum(['fixed', 'variable']).describe("'fixed' if amounts are very similar (less than 5% deviation), otherwise 'variable'."),
    ricorrenza: z.enum(['Mensile', 'Bimestrale', 'Trimestrale', 'Quadrimestrale', 'Semestrale', 'Annuale', 'Altro']).describe("The identified recurrence pattern of the expense."),
    giornoStimato: z.number().int().min(1).max(31).describe("The estimated day of the month the payment is due (e.g., 15 for the 15th). For non-monthly, it's the day in the due month."),
    primoMese: z.number().int().min(1).max(12).optional().describe("For non-monthly recurrences, the first month of the cycle (1=Jan, 12=Dec). E.g., for quarterly payments in Mar,Jun,Sep,Dec, this would be 3."),
    categoria: z.string().describe('The most appropriate main category, e.g., "Tasse", "Gestione Generale", "Finanziamenti".'),
    sottocategoria: z.string().optional().describe('The most appropriate sub-category (e.g., "IVA Trimestrale", "Telefonia", "Rate Mutuo").'),
    metodoPagamentoTipico: z.string().optional().describe("The typical payment method if identifiable (e.g., 'Addebito Diretto (SDD)', 'Bonifico')."),
    tipoTassa: z.string().optional().describe("ONLY for fiscal expenses, the specific type of tax (e.g., 'IVA', 'IRES', 'IMU'). Must be omitted or empty for operational expenses like utilities or rent."),
    ragione: z.string().describe('A brief explanation of why this deadline was suggested, mentioning number of payments found and average amount.'),
    sourceCandidateId: z.number().describe('The original ID of the candidate group from the input JSON that this suggestion is based on.'),
});
export type RecurringExpensePattern = z.infer<typeof RecurringExpensePatternSchema>;

const SuggestFiscalDeadlinesOutputSchema = z.object({
  suggestions: z.array(RecurringExpensePatternSchema),
});
export type SuggestFiscalDeadlinesOutput = z.infer<typeof SuggestFiscalDeadlinesOutputSchema>;

export async function suggestFiscalDeadlines(input: SuggestFiscalDeadlinesInput): Promise<SuggestFiscalDeadlinesOutput> {
  return suggestFiscalDeadlinesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFiscalDeadlinesPrompt',
  input: { schema: SuggestFiscalDeadlinesInputSchema },
  output: { schema: SuggestFiscalDeadlinesOutputSchema },
  prompt: `You are an expert financial analyst AI for Italian companies. Your task is to identify recurring expense patterns from a pre-processed list of potential candidates and suggest them as future schedulable deadlines.

You are given a list of candidates for '{{company}}'.

Each candidate object in the JSON string has: 'id', 'description', 'count', 'avgAmount', 'amounts' (an array of all amounts), 'dates', 'sourceCategory', 'sourceSubcategory'.

**For each valid recurring expense you identify:**
1.  **Analyze Amounts**: Look at the \`amounts\` array.
    - If all amounts are within a 5% deviation from the \`avgAmount\`, set \`amountType\` to \`'fixed'\`. In this case, use the \`avgAmount\` for \`importoPrevisto\`.
    - If the amounts vary more significantly, you MUST set \`amountType\` to \`'variable'\`. Even in this case, still provide the average amount in \`importoPrevisto\` as a general reference.
    - If you see distinct clusters of amounts (e.g., half are ~€10 and half are ~€30), you MUST create a SEPARATE suggestion for EACH cluster.
2.  **Analyze Recurrence**: Based on the provided dates, determine the precise recurrence ('Mensile', 'Bimestrale', 'Trimestrale', 'Quadrimestrale', 'Semestrale', 'Annuale', 'Altro'). Be precise. If a pattern doesn't fit standard recurrences (e.g. quarterly payments on irregular months), classify it as 'Altro'.
3.  **Estimate Due Day**: Calculate the average day of the month ('giornoStimato') the payment occurs.
4.  **Clean Description**: Create a clean, general 'descrizionePulita' that is similar to the source description (e.g., 'Canone Telefonico TIM', 'Rata Mutuo BAPR').
5.  **Categorize**: Use the provided 'sourceCategory' and 'sourceSubcategory' from the source movements as the 'categoria' and 'sottocategoria' for the new deadline to ensure consistency. Do not invent new categories.
6.  **Fiscal vs. Operational**:
    - If it is a clear **fiscal expense** (e.g., description contains IVA, F24, IRES, INPS, IMU), you MUST determine 'tipoTassa'.
    - For all other **operational expenses** (like utilities, rent, loans), you MUST OMIT 'tipoTassa' or provide an empty string.
7.  **Provide Reasoning**: Give a brief 'ragione' explaining your suggestion (e.g., 'Trovati 12 pagamenti mensili per circa €25').
8.  **Copy Company**: Ensure the 'societa' field in your output matches the '{{company}}' from the input.
9.  **IMPORTANT: Link back to source**: For each suggestion, you MUST include the original \`id\` from the candidate object in the output field \`sourceCandidateId\`.

**Candidate Data from Client:**
{{{analysisCandidates}}}

Respond with a JSON object containing a 'suggestions' array of all the recurring patterns you have identified. If you find no patterns, return an empty array.
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
