'use server';
/**
 * @fileOverview An AI flow to classify a group of transaction descriptions into a single, recurring expense type.
 *
 * - classifyRecurringExpense - The function that calls the AI flow.
 * - ClassifyRecurringExpenseInput - The input type.
 * - ClassifyRecurringExpenseOutput - The output type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { CATEGORIE } from '@/lib/constants';

const ClassifyRecurringExpenseInputSchema = z.object({
  descriptions: z.array(z.string()).describe('An array of transaction descriptions that are believed to be for the same recurring expense.'),
});
export type ClassifyRecurringExpenseInput = z.infer<typeof ClassifyRecurringExpenseInputSchema>;

const ClassifyRecurringExpenseOutputSchema = z.object({
  commonDescription: z.string().describe('A clean, common description for this recurring expense. E.g., "Pagamento F24", "Rata mutuo BAPR".'),
  category: z.string().describe('The suggested category for the expense.'),
  subcategory: z.string().describe('The suggested subcategory for the expense.'),
});
export type ClassifyRecurringExpenseOutput = z.infer<typeof ClassifyRecurringExpenseOutputSchema>;

export async function classifyRecurringExpense(input: ClassifyRecurringExpenseInput): Promise<ClassifyRecurringExpenseOutput> {
  return classifyRecurringExpenseFlow(input);
}

// Generate a dynamic list of categories and subcategories for the prompt
const categoryPromptList = Object.entries(CATEGORIE)
  .map(([cat, subcats]) => `- ${cat}: ${subcats.join(', ')}`)
  .join('\n');

const prompt = ai.definePrompt({
  name: 'classifyRecurringExpensePrompt',
  input: { schema: ClassifyRecurringExpenseInputSchema },
  output: { schema: ClassifyRecurringExpenseOutputSchema },
  prompt: `You are an expert Italian accountant. Given a list of transaction descriptions for what is believed to be the same recurring expense, your task is to identify a single, clean, common description for it and classify it into the most appropriate category and subcategory.

Transaction Descriptions:
{{#each descriptions}}
- {{{this}}}
{{/each}}

Based on the descriptions, provide a single, normalized description for this recurring payment (e.g., "Pagamento F24", "Rata mutuo BAPR", "Canone TIM").

Then, classify it using ONLY the following category and subcategory structure:
${categoryPromptList}

Respond in the requested JSON format.
`,
});

const classifyRecurringExpenseFlow = ai.defineFlow(
  {
    name: 'classifyRecurringExpenseFlow',
    inputSchema: ClassifyRecurringExpenseInputSchema,
    outputSchema: ClassifyRecurringExpenseOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('AI analysis returned no output.');
      }
      return output;
    } catch (error: any) {
        console.error("Error in classifyRecurringExpenseFlow:", error);
        throw new Error(
          `L'analisi AI per la classificazione non è riuscita. ${error.message || 'Riprova più tardi.'}`
        );
    }
  }
);
