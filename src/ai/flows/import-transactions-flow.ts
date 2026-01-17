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

// We can't use the `Movimento` type directly because it has properties like 'id' that are added after creation.
// Let's define a schema for what the AI should extract.
const ExtractedMovementSchema = z.object({
  data: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
  descrizione: z.string().describe("The description of the transaction."),
  entrata: z.number().default(0).describe("The income amount (lordo)."),
  uscita: z.number().default(0).describe("The expense amount (lordo)."),
  societa: z.string().describe("The company to assign to the transaction."),
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
  prompt: `You are an expert financial assistant specialized in analyzing documents to extract and categorize financial transactions for Italian companies.
  Analyze the provided file content and extract all financial movements.
  The current year is ${new Date().getFullYear()}. If the year is not specified in a date, assume it's the current year.
  For each transaction, determine if it is an income (entrata) or an expense (uscita).
  You must assign the company '{{company}}' to every extracted transaction in the 'societa' field.
  The transaction date must be in YYYY-MM-DD format.

  For each transaction, also suggest a 'categoria' and 'sottocategoria' based on its description, from the provided lists.
  If you cannot determine a category, use 'Da categorizzare' for both fields.
  Also suggest the correct IVA percentage.

  Categories: Immobiliare, Energia, Fornitori, Gestione Immobili, Gestione Generale, Tasse, Finanziamenti, Movimenti Interni, Da categorizzare
  Subcategories (per Immobiliare): Affitti, Depositi Cauzionali, Recupero Spese, Immobili
  Subcategories (per Energia): Quote CEF, Pratiche Contributo, Incentivi GSE, Vendita Energia
  Subcategories (per Fornitori): Materiali, Lavori/Manutenzione, Impianti, Servizi
  Subcategories (per Gestione Generale): Spese Bancarie, Commercialista, Telefonia, Altre Spese, Gestione
  Subcategories (per Tasse): IVA Trimestrale, IMU, IRES, IRAP, F24 Vari, Bolli, Cartelle Esattoriali
  Subcategories (per Finanziamenti): Rate Mutuo, Rate Prestito, Rimborso
  Subcategories (per Movimenti Interni): Giroconto, Trasferimento
  IVA Percentages: 0.22, 0.10, 0.04, 0.00
  
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
    try {
      const { output } = await prompt(input);
      
      if (!output || !output.movements) {
          return { movements: [] };
      }

      // Post-process to fill in missing details and ensure consistency
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
              sottocategoria: mov.sottocategoria || 'Da categorizzare',
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
