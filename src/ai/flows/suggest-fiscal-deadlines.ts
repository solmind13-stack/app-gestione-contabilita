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
  company: z.enum(['LNC', 'STG', 'Tutte']).describe('The company to analyze. If "Tutte", analyze each company separately.'),
  movements: z.string().describe('A JSON string of all historical financial movements (Movimento[]).'),
  existingDeadlines: z.string().describe('A JSON string of all existing deadlines (Scadenza[]) to avoid creating duplicates.'),
});
export type SuggestFiscalDeadlinesInput = z.infer<typeof SuggestFiscalDeadlinesInputSchema>;

const SuggestedDeadlineSchema = z.object({
    societa: z.enum(['LNC', 'STG']),
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
  prompt: `You are an expert financial analyst AI. Your task is to identify ALL recurring expenses from a list of historical bank movements and suggest them as future deadlines.

You are given all movements for '{{company}}' and all existing deadlines. You must not suggest deadlines that already exist.

Analyze the movements and identify recurring patterns for both fiscal and operational expenses.

**1. Fiscal Expenses:**
-   **IVA (VAT):** Quarterly or monthly payments.
-   **IRPEF/IRES (Income Tax):** 'Acconto' and 'Saldo' payments, often in F24.
-   **INPS (Social Security):** Recurring contributions.
-   **Ritenute (Withholdings):** Withholding tax payments, usually monthly.

**2. Operational Expenses:**
-   **Utenze:** Look for recurring payments to utility providers (electricity, gas, water).
-   **Telefonia:** Identify recurring phone and internet bills.
-   **Canoni:** Find regular rent payments (affitto), leasing installments, or other fees.
-   **Finanziamenti:** Look for loan (prestito) or mortgage (mutuo) installments.
-   **Spese Condominiali:** Identify regular condominium fees.

**For each distinct recurring payment you identify:**
-   Determine the recurrence (Mensile, Trimestrale, Semestrale, Annuale).
-   Calculate the next due date based on the last payment's date and recurrence.
-   Create a clean 'descrizione' for the deadline.
-   For fiscal items, fill 'tipoTassa' and 'periodoRiferimento'. For operational items, you should either omit these fields or provide an empty string.
-   Assign the most appropriate 'categoria' and 'sottocategoria' (e.g., 'Gestione Generale' -> 'Telefonia' for a phone bill, 'Tasse' -> 'IMU' for a tax).
-   Check if a similar deadline (same description pattern and recurrence) already exists in 'existingDeadlines'. **If it exists, DO NOT include it in your output.**

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
