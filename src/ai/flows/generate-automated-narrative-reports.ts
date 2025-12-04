// src/ai/flows/generate-automated-narrative-reports.ts
'use server';

/**
 * @fileOverview Generates automated narrative reports summarizing financial data and insights using AI.
 *
 * - generateNarrativeReport - A function that generates the narrative report.
 * - GenerateNarrativeReportInput - The input type for the generateNarrativeReport function.
 * - GenerateNarrativeReportOutput - The return type for the generateNarrativeReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateNarrativeReportInputSchema = z.object({
  companyName: z.string().describe('The name of the company for which to generate the report.'),
  financialData: z.string().describe('A summary of the financial data for the company.'),
});
export type GenerateNarrativeReportInput = z.infer<typeof GenerateNarrativeReportInputSchema>;

const GenerateNarrativeReportOutputSchema = z.object({
  report: z.string().describe('The generated narrative report.'),
});
export type GenerateNarrativeReportOutput = z.infer<typeof GenerateNarrativeReportOutputSchema>;

export async function generateNarrativeReport(input: GenerateNarrativeReportInput): Promise<GenerateNarrativeReportOutput> {
  return generateNarrativeReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNarrativeReportPrompt',
  input: {schema: GenerateNarrativeReportInputSchema},
  output: {schema: GenerateNarrativeReportOutputSchema},
  prompt: `You are an expert financial analyst. Generate a narrative report based on the following financial data for {{companyName}}:\n\nFinancial Data:\n{{financialData}}\n\nReport:\n`,
});

const generateNarrativeReportFlow = ai.defineFlow(
  {
    name: 'generateNarrativeReportFlow',
    inputSchema: GenerateNarrativeReportInputSchema,
    outputSchema: GenerateNarrativeReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
