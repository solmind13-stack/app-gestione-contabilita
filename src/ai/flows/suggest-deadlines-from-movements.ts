// src/ai/flows/suggest-deadlines-from-movements.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting recurring deadlines from transaction movements using AI, guided by specific business rules.
 *
 * suggestDeadlines - A function that takes transaction movements and returns potential recurring deadlines.
 * SuggestDeadlinesInput - The input type for the suggestDeadlines function.
 * SuggestDeadlinesOutput - The return type for the suggestDeadlines function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Movimento, Scadenza } from '@/lib/types';

const DeadlineSuggestionSchema = z.object({
  description: z.string().describe('The clear, normalized description for the suggested deadline.'),
  category: z.string().describe('The suggested category based on the provided mapping.'),
  subcategory: z.string().describe('The suggested subcategory based on the provided mapping.'),
  recurrence: z.enum(['Nessuna', 'Mensile', 'Trimestrale', 'Annuale']).describe('The detected recurrence pattern.'),
  amount: z.number().describe('The average amount of the recurring payment.'),
  confidence: z.enum(['Alta', 'Media', 'Bassa']).describe('The confidence level of the suggestion.'),
  reason: z.string().describe('A brief, non-technical explanation for the suggestion.'),
  movements: z.array(z.object({ id: z.string(), data: z.string(), importo: z.number() })).describe('A list of the source movements used for this suggestion.'),
  originalMovementDescription: z.string().describe('The original, un-normalized description from one of the source movements.'),
});

const SuggestDeadlinesInputSchema = z.object({
  movements: z.custom<Movimento[]>(),
  existingDeadlines: z.custom<Scadenza[]>(),
});

const SuggestDeadlinesOutputSchema = z.object({
  suggestions: z.array(DeadlineSuggestionSchema),
});

export type SuggestDeadlinesInput = z.infer<typeof SuggestDeadlinesInputSchema>;
export type SuggestDeadlinesOutput = z.infer<typeof SuggestDeadlinesOutputSchema>;

export async function suggestDeadlines(input: SuggestDeadlinesInput): Promise<SuggestDeadlinesOutput> {
    return suggestDeadlinesFlow(input);
}


const prompt = ai.definePrompt({
  name: 'suggestDeadlinesPrompt',
  input: { schema: SuggestDeadlinesInputSchema },
  output: { schema: SuggestDeadlinesOutputSchema },
  prompt: `You are an expert financial analyst. Your task is to identify potential recurring deadlines from a list of past bank movements. Follow these rules precisely:

**A) Recognition of Recurrences (from movements)**
1.  **Grouping**:
    -   Only consider outgoing movements ('uscita' > 0).
    -   First, group movements by company ('societa').
    -   Then, group them by a *normalized* counterparty/description. To normalize, convert to lowercase, remove punctuation and legal suffixes (like 'srl', 'spa'), and collapse multiple spaces.
2.  **Minimum Requirement**:
    -   A group is a candidate for a recurring deadline only if it contains at least 3 movements.
3.  **Periodicity**:
    -   Calculate the days between consecutive movements in a sorted group.
    -   **Mensile**: Average interval is 28-31 days (with a tolerance of ±3 days for individual intervals).
    -   **Trimestrale**: Average interval is 85-97 days.
    -   **Annuale**: Average interval is 350-380 days.
    -   A group has a valid periodicity if at least 2/3 of its intervals fall within the tolerance window.
4.  **Amount**:
    -   Assess if the amount is stable. A small variation (e.g., ±10%) is considered stable.
    -   For typical variable expenses like utilities or taxes, a larger variation is acceptable if other signals (periodicity, keywords) are strong.
5.  **Deduplication**:
    -   Before suggesting a new deadline, check the list of \`existingDeadlines\`. If a similar deadline already exists (same company, similar normalized description, and same recurrence), DO NOT create a duplicate suggestion.

**B) Classification of Deadline Type (use this mapping)**
-   Keywords: 'f24', 'tributi', 'imposte', 'ravvedimento' -> Category: 'Tasse', Subcategory: 'F24 Vari'
-   Keywords: 'iva', 'liquidazione iva' -> Category: 'Tasse', Subcategory: 'IVA Trimestrale'
-   Keywords: 'inps', 'contributi' -> Category: 'Tasse', Subcategory: 'F24 Vari'
-   Keywords: 'assicurazione', 'polizza', 'rca' -> Category: 'Gestione Generale', Subcategory: 'Altre Spese'
-   Keywords: 'canone', 'locazione', 'affitto' -> Category: 'Gestione Immobili', Subcategory: 'Manutenzione'
-   Keywords: 'leasing' -> Category: 'Finanziamenti', Subcategory: 'Rate Prestito'
-   Keywords: 'abbonamento', 'rinnovo', 'subscription', 'saas', 'hosting' -> Category: 'Gestione Generale', Subcategory: 'Altre Spese'
-   Keywords: 'telecom', 'tim', 'vodafone', 'wind', 'iliad', 'telefonia' -> Category: 'Gestione Generale', Subcategory: 'Telefonia'
-   Keywords: 'enel', 'servizio elettrico', 'energia', 'luce', 'gas', 'acqua' -> Category: 'Gestione Immobili', Subcategory: 'Utenze'
-   Keywords: 'rata', 'finanziamento', 'mutuo' -> Category: 'Finanziamenti', Subcategory: 'Rate Mutuo'

**C) Confidence and Action**
-   Calculate a confidence level ('Alta', 'Media', 'Bassa') for each suggestion based on: strength of periodicity, stability of amount, and presence of strong keywords.
    -   **Alta**: Strong periodicity, stable amount, clear keyword match.
    -   **Media**: Good periodicity, some amount variation OR weak/no keyword match.
    -   **Bassa**: Weak periodicity, variable amount.
-   For each valid suggestion, generate a concise, non-technical \`reason\` explaining the finding. E.g., "Rilevati 4 pagamenti mensili a 'Telecom' per un importo stabile di circa €25,00."

**Input Data:**
-   Existing Deadlines: {{{json existingDeadlines}}}
-   Movements to Analyze: {{{json movements}}}

**Your Final Output MUST be a JSON object matching the defined output schema.**`,
});


const suggestDeadlinesFlow = ai.defineFlow(
  {
    name: 'suggestDeadlinesFlow',
    inputSchema: SuggestDeadlinesInputSchema,
    outputSchema: SuggestDeadlinesOutputSchema,
  },
  async (input) => {
    try {
        const { output } = await prompt(input);
        if (!output) {
            return { suggestions: [] };
        }
        return output;
    } catch (error) {
        console.error('Error in suggestDeadlinesFlow:', error);
        // In case of AI error, return an empty list to avoid breaking the UI
        return { suggestions: [] };
    }
  }
);
