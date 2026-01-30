'use server';
/**
 * @fileOverview An AI flow to analyze historical movements and suggest recurring fiscal deadlines.
 *
 * - suggestFiscalDeadlines - The function that calls the AI flow.
 * - SuggestFiscalDeadlinesInput - The input type.
 * - SuggestFiscalDeadlinesOutput - The output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { CATEGORIE } from '@/lib/constants';

const SuggestFiscalDeadlinesInputSchema = z.object({
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to analyze. If "Tutte", analyze each company separately.'),
  movements: z.string().describe('A JSON string of all historical financial movements (Movimento[]).'),
  existingDeadlines: z.string().describe('A JSON string of all existing deadlines (Scadenza[]) to avoid creating duplicates.'),
});
export type SuggestFiscalDeadlinesInput = z.infer<typeof SuggestFiscalDeadlinesInputSchema>;

const SuggestedDeadlineSchema = z.object({
    societa: z.enum(['LNC', 'STG']),
    descrizione: z.string().describe('A clean, common description for this recurring fiscal deadline. E.g., "Pagamento IVA 1° Trimestre", "Acconto IRES".'),
    importoPrevisto: z.number().describe('The estimated amount for the deadline, based on the average or last payment.'),
    dataScadenza: z.string().describe('The calculated next due date for the deadline in YYYY-MM-DD format.'),
    ricorrenza: z.enum(['Mensile', 'Trimestrale', 'Semestrale', 'Annuale']),
    tipoTassa: z.string().describe('The specific type of tax or contribution (e.g., IVA, IRES, INPS, Ritenute).'),
    periodoRiferimento: z.string().describe('The reference period for the tax (e.g., "Q2 2025", "Giugno 2025").'),
    categoria: z.string().describe('The main category, should be "Tasse" or similar.'),
    sottocategoria: z.string().describe('The sub-category (e.g., "IVA Trimestrale", "IRES").'),
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
  prompt: `You are an expert Italian accountant AI. Your task is to identify recurring fiscal deadlines from a list of historical bank movements.
You are given all movements and all existing deadlines. You must not suggest deadlines that already exist.

Analyze the movements for {{company}} and identify patterns for the following Italian taxes:
1.  **IVA (VAT):** Look for quarterly or monthly payments. Calculate the next due date (e.g., if last payment was for Q1 on May 16, next is Aug 20). Estimate the amount based on the last payment.
2.  **IRPEF/IRES (Income Tax):** Look for 'Acconto' and 'Saldo' payments, typically described with "F24". Common due dates are June/July and November. Identify the pattern and predict the next payment.
3.  **INPS (Social Security):** Find recurring INPS payments and predict the next one.
4.  **Ritenute (Withholdings):** Find payments for "ritenute d'acconto", which are usually due on the 16th of each month.

For each distinct recurring tax payment you identify:
- Determine the recurrence (Mensile, Trimestrale, Semestrale, Annuale).
- Calculate the next legal due date based on the last payment's date and recurrence.
- Create a clean \`descrizione\`, \`tipoTassa\`, and \`periodoRiferimento\` (e.g., "Pagamento IVA 2° Trimestre 2025", tipo: "IVA", periodo: "Q2 2025").
- Check if a similar deadline (same description pattern and recurrence) already exists in 'existingDeadlines'. **If it exists, DO NOT include it in your output.**
- Use the 'Tasse' category and the most appropriate subcategory.

Historical Movements:
{{{movements}}}

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
        throw new Error('AI analysis returned no output.');
      }
      return output;
    } catch (error: any) {
        console.error("Error in suggestFiscalDeadlinesFlow:", error);
        throw new Error(
          `L'analisi AI per suggerire le scadenze non è riuscita. ${error.message || 'Riprova più tardi.'}`
        );
    }
  }
);
