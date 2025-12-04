'use server';

/**
 * @fileOverview A flow to generate financial insights using Gemini, providing a summary of the current financial situation,
 * highlighting potential issues, and suggesting relevant actions.
 *
 * - generateFinancialInsights - A function that handles the generation of financial insights.
 * - FinancialInsightsInput - The input type for the generateFinancialInsights function.
 * - FinancialInsightsOutput - The return type for the generateFinancialInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialInsightsInputSchema = z.object({
  companyName: z.string().describe('The name of the company (LNC or STG).'),
  financialData: z.string().describe('Aggregated financial data for the company.'),
});
export type FinancialInsightsInput = z.infer<typeof FinancialInsightsInputSchema>;

const FinancialInsightsOutputSchema = z.object({
  summary: z.string().describe('A summary of the current financial situation.'),
  attentionItems: z.array(z.string()).describe('A list of potential issues or alerts.'),
  suggestionItems: z.array(z.string()).describe('A list of suggested actions.'),
});
export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;

export async function generateFinancialInsights(input: FinancialInsightsInput): Promise<FinancialInsightsOutput> {
  return generateFinancialInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialInsightsPrompt',
  input: {schema: FinancialInsightsInputSchema},
  output: {schema: FinancialInsightsOutputSchema},
  prompt: `You are an expert financial advisor providing insights for {{companyName}}. Based on the following financial data:\n\n{{financialData}}\n\nGenerate a summary of the current financial situation, highlight any potential issues that need attention, and suggest relevant actions to improve the financial health of the company.\n\nSummary:\n{{summary}}\n\nAttention Items:\n{{#each attentionItems}}- {{this}}\n{{/each}}\n\nSuggestion Items:\n{{#each suggestionItems}}- {{this}}\n{{/each}}`,
});

const generateFinancialInsightsFlow = ai.defineFlow(
  {
    name: 'generateFinancialInsightsFlow',
    inputSchema: FinancialInsightsInputSchema,
    outputSchema: FinancialInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
