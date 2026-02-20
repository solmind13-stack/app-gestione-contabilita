// src/ai/flows/import-transactions-flow.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for importing transactions from multiple file formats.
 *
 * importTransactions - A function that takes file data or text and returns extracted transactions using AI.
 * ImportTransactionsInput - The input type for the importTransactions function.
 * ImportTransactionsOutput - The return type for the importTransactions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ImportTransactionsInputSchema = z.object({
  fileDataUri: z.string().describe(
    "The file content as a data URI. Must include a MIME type and use Base64 encoding. e.g., 'data:<mimetype>;base64,<encoded_data>'"
  ).optional(),
  textContent: z.string().describe("The text content extracted from a file, like a CSV or JSON string.").optional(),
  fileType: z.string().describe("The MIME type of the file (e.g., 'application/pdf', 'image/png')."),
  company: z.string().describe("The company to assign to the transactions."),
  conto: z.string().optional().describe("The bank account to associate with the transactions."),
  inseritoDa: z.string().describe("The name of the user importing the file."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

const ExtractedMovementSchema = z.object({
    data: z.string().describe("Transaction date in ISO format (YYYY-MM-DD) or similar."),
    descrizione: z.string().describe("Transaction description or reason."),
    entrata: z.number().describe("Income amount. Use 0 if it's an expense."),
    uscita: z.number().describe("Expense amount. Use 0 if it's an income."),
    categoria: z.string().optional().describe("A suggested category from the app's predefined list."),
    sottocategoria: z.string().optional().describe("A suggested subcategory."),
    entita: z.string().optional().describe("The name of the customer or supplier involved."),
});

const ImportTransactionsOutputSchema = z.object({
  movements: z.array(ExtractedMovementSchema),
});
export type ImportTransactionsOutput = z.infer<typeof ImportTransactionsOutputSchema>;

export async function importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsOutput> {
  return importTransactionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'importTransactionsPrompt',
  input: { schema: ImportTransactionsInputSchema },
  output: { schema: ImportTransactionsOutputSchema },
  prompt: `You are an expert financial analyst. Your task is to analyze the provided document content and extract ALL individual transactions or bank movements.

Input Format: {{fileType}}
{{#if textContent}}
Extracted Text Content:
{{{textContent}}}
{{else}}
Document (Image/PDF):
{{media url=fileDataUri}}
{{/if}}

INSTRUCTIONS:
1. Identify every single financial transaction in the content.
2. For each transaction, extract:
   - 'data': The date of the transaction.
   - 'descrizione': A clear description of the movement.
   - 'entrata': The amount if it is an income (positive flow).
   - 'uscita': The amount if it is an expense (negative flow).
   - 'entita': The name of the client, supplier, or bank entity if identifiable.
3. If the document is an invoice, extract the total amount as a single transaction unless detailed line items are requested.
4. If it's a bank statement, extract every row.
5. Respond ONLY with a valid JSON object matching the requested schema. Ensure dates are parsed correctly.

PREDEFINED CATEGORIES (Suggest one if possible):
Immobiliare, Energia, Fornitori, Gestione Immobili, Gestione Generale, Tasse, Finanziamenti, Movimenti Interni.
`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
});

const importTransactionsFlow = ai.defineFlow(
  {
    name: 'importTransactionsFlow',
    inputSchema: ImportTransactionsInputSchema,
    outputSchema: ImportTransactionsOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output || !output.movements) {
          throw new Error("L'AI non è riuscita a identificare movimenti nel file fornito.");
      }
      return output;
    } catch(e: any) {
        console.error("Error in importTransactionsFlow", e);
        throw new Error(
          e.message || 'L\'analisi AI è fallita. Verifica il formato del file o riprova più tardi.'
        );
    }
  }
);
