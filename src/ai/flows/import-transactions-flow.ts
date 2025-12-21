// src/ai/flows/import-transactions-flow.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for importing transactions from a file.
 *
 * importTransactions - A function that takes a file data URI and returns a list of extracted transactions.
 * ImportTransactionsInput - The input type for the importTransactions function.
 * ImportTransactionsOutput - The return type for the importTransactions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Movimento } from '@/lib/types';
import { format } from 'date-fns';

const ImportTransactionsInputSchema = z.object({
  fileDataUri: z.string().describe(
    "The file content as a data URI. Must include a MIME type and use Base64 encoding. e.g., 'data:<mimetype>;base64,<encoded_data>'."
  ),
  fileType: z.string().describe("The MIME type of the file (e.g., 'image/png', 'application/pdf')."),
  company: z.enum(['LNC', 'STG']).describe("The company to assign to the transactions."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

// We can't use the `Movimento` type directly because it has properties like 'id' that are added after creation.
// Let's define a schema for what the AI should extract.
const ExtractedMovementSchema = z.object({
  data: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
  descrizione: z.string().describe("The description of the transaction."),
  entrata: z.number().default(0).describe("The income amount (lordo)."),
  uscita: z.number().default(0).describe("The expense amount (lordo)."),
  societa: z.enum(['LNC', 'STG']).describe("The company associated with the transaction (LNC or STG)."),
  categoria: z.string().optional().describe("A suggested category for the transaction."),
  sottocategoria: z.string().optional().describe("A suggested subcategory for the transaction."),
  iva: z.number().default(0.22).describe("The VAT percentage (e.g., 0.22 for 22%)."),
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
  prompt: `You are an expert financial assistant specialized in analyzing documents to extract financial transactions for Italian companies.
  Analyze the provided file content and extract all financial movements.
  The current year is ${new Date().getFullYear()}. If the year is not specified in a date, assume it's the current year.
  For each transaction, determine if it is an income (entrata) or an expense (uscita).
  You must assign the company '{{company}}' to every extracted transaction in the 'societa' field.
  The transaction date must be in YYYY-MM-DD format.
  
  Please provide the response in a structured JSON format.

  File content:
  {{media url=fileDataUri}}`,
});

const importTransactionsFlow = ai.defineFlow(
  {
    name: 'importTransactionsFlow',
    inputSchema: ImportTransactionsInputSchema,
    outputSchema: ImportTransactionsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    
    if (!output || !output.movements) {
        return { movements: [] };
    }

    // Post-process to fill in missing details and ensure consistency
    const cleanedMovements = output.movements.map(mov => {
        const today = new Date();
        return {
            ...mov,
            societa: mov.societa || input.company,
            anno: new Date(mov.data).getFullYear(),
            categoria: mov.categoria || 'Da categorizzare',
            sottocategoria: mov.sottocategoria || 'Da categorizzare',
            iva: mov.iva === undefined ? 0.22 : mov.iva,
        };
    });

    return { movements: cleanedMovements };
  }
);
