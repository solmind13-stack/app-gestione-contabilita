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
  company: z.string().describe("The company to assign to the transactions."),
  conto: z.string().optional().describe("The bank account to associate with the transactions."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

// Schema for what the AI model should extract. It's simpler to ensure higher reliability.
const AiExtractedMovementSchema = z.object({
  data: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
  descrizione: z.string().describe("The description of the transaction."),
  entrata: z.number().default(0).describe("The income amount (lordo)."),
  uscita: z.number().default(0).describe("The expense amount (lordo)."),
  societa: z.string().describe("The company to assign to the transaction."),
  categoria: z.string().optional().describe("A suggested category for the transaction (e.g., Tasse, Fornitori, Immobiliare)."),
  iva: z.number().default(0.22).describe("The VAT percentage (e.g., 0.22 for 22%)."),
});

// The schema for the AI's direct output.
const AiOutputSchema = z.object({
    movements: z.array(AiExtractedMovementSchema),
});

// Schema for what the final flow will return after post-processing.
// This matches the shape needed by the frontend component.
const FinalMovementSchema = AiExtractedMovementSchema.extend({
    anno: z.number(),
    conto: z.string(),
    sottocategoria: z.string(),
});

const ImportTransactionsOutputSchema = z.object({
  movements: z.array(FinalMovementSchema),
});
export type ImportTransactionsOutput = z.infer<typeof ImportTransactionsOutputSchema>;

export async function importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsOutput> {
  return importTransactionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'importTransactionsPrompt',
  input: { schema: ImportTransactionsInputSchema },
  output: { schema: AiOutputSchema }, // AI is expected to return the simpler schema
  prompt: `You are an expert financial assistant specialized in analyzing documents to extract financial transactions for Italian companies.
  Analyze the provided file and extract all financial movements.
  The current year is ${new Date().getFullYear()}. If the year is not specified in a date, assume it's the current year.
  For each transaction, determine if it is an income (entrata) or an expense (uscita).
  You must assign the company '{{company}}' to every extracted transaction in the 'societa' field.
  The transaction date must be in YYYY-MM-DD format.

  For each transaction, suggest a 'categoria'. If you are unsure, use 'Da categorizzare'.
  For 'iva', suggest a percentage, preferably one of: 0.22, 0.10, 0.04, 0.00.
  
  Do NOT suggest or include a 'sottocategoria' field in your response.

  Please provide the response in a structured JSON format. If no transactions are found, return an empty list of movements.

  File content:
  {{media url=fileDataUri}}`,
});

const importTransactionsFlow = ai.defineFlow(
  {
    name: 'importTransactionsFlow',
    inputSchema: ImportTransactionsInputSchema,
    outputSchema: ImportTransactionsOutputSchema, // The flow returns the extended, final schema
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      
      if (!output || !output.movements) {
          return { movements: [] };
      }

      // Post-process the AI's output to enrich it and fit the final schema.
      const cleanedMovements = output.movements.map(mov => {
          let anno: number;
          try {
              anno = new Date(mov.data).getFullYear();
              if (isNaN(anno)) { // Check if getFullYear returned NaN from an invalid date
                  anno = new Date().getFullYear(); // Fallback to current year
              }
          } catch(e) {
              anno = new Date().getFullYear(); // Fallback on any other date parsing error
          }

          return {
              ...mov,
              societa: mov.societa || input.company,
              conto: input.conto || '',
              anno: anno,
              categoria: mov.categoria || 'Da categorizzare',
              sottocategoria: 'Da categorizzare', // Add default subcategory here
              iva: mov.iva === undefined ? 0.22 : mov.iva,
          };
      });

      return { movements: cleanedMovements };
    } catch(e) {
        console.error("Error in importTransactionsFlow", e);
        throw new Error(
          'L\'analisi AI non è riuscita. Ciò potrebbe essere dovuto a un file di formato non supportato, illeggibile o a un errore temporaneo del servizio. Prova con un file diverso o riprova più tardi.'
        );
    }
  }
);
