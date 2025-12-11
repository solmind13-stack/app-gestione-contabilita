// src/ai/flows/suggest-deadlines-from-movements.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting deadlines based on transaction movements.
 *
 * suggestDeadlines - A function that takes a list of transaction descriptions and returns potential deadlines.
 * SuggestDeadlinesInput - The input type for the suggestDeadlines function.
 * SuggestDeadlinesOutput - The return type for the suggestDeadlines function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DeadlineSuggestionSchema = z.object({
  description: z.string().describe('The suggested description for the deadline.'),
  category: z.string().describe('The suggested category for the deadline (e.g., Tasse, Finanziamenti).'),
  recurrence: z.enum(['Nessuna', 'Mensile', 'Trimestrale', 'Semestrale', 'Annuale']).describe('The suggested recurrence for the deadline.'),
  amount: z.number().describe('The amount of the transaction.'),
  originalMovementDescription: z.string().describe('The original movement description that triggered the suggestion.'),
});

export type DeadlineSuggestion = z.infer<typeof DeadlineSuggestionSchema>;

const SuggestDeadlinesInputSchema = z.object({
  movements: z.array(z.object({
    description: z.string(),
    amount: z.number(),
  })).describe('A list of transaction movements to analyze.'),
});
export type SuggestDeadlinesInput = z.infer<typeof SuggestDeadlinesInputSchema>;

const SuggestDeadlinesOutputSchema = z.object({
  suggestions: z.array(DeadlineSuggestionSchema).describe('A list of potential deadlines identified from the movements.'),
});
export type SuggestDeadlinesOutput = z.infer<typeof SuggestDeadlinesOutputSchema>;

export async function suggestDeadlines(input: SuggestDeadlinesInput): Promise<SuggestDeadlinesOutput> {
  return suggestDeadlinesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestDeadlinesPrompt',
  input: {schema: SuggestDeadlinesInputSchema},
  output: {schema: SuggestDeadlinesOutputSchema},
  prompt: `You are an expert financial assistant for Italian companies. Analyze the following list of financial movements and identify any that look like recurring payments or fiscal deadlines.

  Common deadline categories are: Tasse, Finanziamenti, Gestione Generale, Fornitori.
  Common recurrences are: Mensile, Trimestrale, Semestrale, Annuale.

  For each potential deadline you identify, provide a suggested description, category, and recurrence.

  Movements to analyze:
  {{#each movements}}
  - Description: "{{this.description}}", Amount: {{this.amount}}
  {{/each}}

  Only include suggestions for clear recurring payments like taxes (F24, IMU, IVA), loan installments (Rata mutuo), or regular supplier contracts (Canone). Ignore generic descriptions.
  Respond in JSON format.
  `,
});

const suggestDeadlinesFlow = ai.defineFlow(
  {
    name: 'suggestDeadlinesFlow',
    inputSchema: SuggestDeadlinesInputSchema,
    outputSchema: SuggestDeadlinesOutputSchema,
  },
  async input => {
    // Filter out movements that are unlikely to be deadlines
    const filteredMovements = input.movements.filter(m => {
        const lowerDesc = m.description.toLowerCase();
        return lowerDesc.includes('f24') || 
               lowerDesc.includes('imu') || 
               lowerDesc.includes('iva') ||
               lowerDesc.includes('rata') ||
               lowerDesc.includes('mutuo') ||
               lowerDesc.includes('canone') ||
               lowerDesc.includes('tari');
    });

    if (filteredMovements.length === 0) {
        return { suggestions: [] };
    }

    const {output} = await prompt({ movements: filteredMovements });
    return output!;
  }
);
