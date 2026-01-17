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
import { CATEGORIE } from '@/lib/constants';

// Define a string representation of categories for the prompt
const categoryPromptData = Object.entries(CATEGORIE)
    .map(([category, subcategories]) => `  - Categoria: "${category}", Sottocategorie valide: [${subcategories.map(s => `"${s}"`).join(', ')}]`)
    .join('\n');

const ImportTransactionsInputSchema = z.object({
  fileDataUri: z.string().describe(
    "The file content as a data URI. Must include a MIME type and use Base64 encoding. e.g., 'data:<mimetype>;base64,<encoded_data>'."
  ),
  fileType: z.string().describe("The MIME type of the file (e.g., 'image/png', 'application/pdf')."),
  company: z.string().describe("The company to assign to the transactions."),
  conto: z.string().optional().describe("The bank account to associate with the transactions."),
  inseritoDa: z.string().describe("The name of the user importing the file."),
});
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;

// Schema for what the AI model should extract.
const AiExtractedMovementSchema = z.object({
  data: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
  descrizione: z.string().describe("The description of the transaction."),
  entrata: z.number().default(0).describe("The income amount (lordo)."),
  uscita: z.number().default(0).describe("The expense amount (lordo)."),
  categoria: z.string().optional().describe("The suggested category for the transaction."),
  sottocategoria: z.string().optional().describe("The suggested subcategory for the transaction."),
  iva: z.number().default(0.22).describe("The VAT percentage (e.g., 0.22 for 22%)."),
});

// The schema for the AI's direct output.
const AiOutputSchema = z.object({
    movements: z.array(AiExtractedMovementSchema),
});

// Schema for what the final flow will return. This is the Movimento type without the id.
const FinalMovementSchema = z.object({
    societa: z.string(),
    anno: z.number(),
    data: z.string(),
    descrizione: z.string(),
    categoria: z.string(),
    sottocategoria: z.string(),
    entrata: z.number(),
    uscita: z.number(),
    iva: z.number(),
    conto: z.string().optional(),
    operatore: z.string().optional(),
    metodoPag: z.string().optional(),
    note: z.string().optional(),
    inseritoDa: z.string().optional(),
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
  output: { schema: AiOutputSchema },
  prompt: `Sei un esperto contabile specializzato nell'analizzare documenti (estratti conto, fatture, etc.) per estrarre movimenti finanziari per aziende italiane.

Il tuo compito si svolge in due fasi:
1.  **Estrazione e Normalizzazione**: Analizza il file fornito e estrai tutti i movimenti finanziari. Normalizza i dati nel formato richiesto: 'data', 'descrizione', 'entrata', 'uscita'. La data deve essere in formato YYYY-MM-DD. Se l'anno non è specificato, assumi sia l'anno corrente (${new Date().getFullYear()}). Determina se ogni movimento è un'entrata o un'uscita.
2.  **Categorizzazione**: Per ogni movimento estratto, suggerisci la 'categoria' e 'sottocategoria' più appropriate basandoti sulla 'descrizione'. Devi scegliere OBBLIGATORIAMENTE tra le seguenti opzioni. Se non sei sicuro, usa 'Da categorizzare' per entrambi.

Opzioni di Categoria e Sottocategoria valide:
${categoryPromptData}

Infine, suggerisci una percentuale IVA ('iva'), scegliendo preferibilmente tra: 0.22, 0.10, 0.04, 0.00.

Restituisci il risultato in formato JSON. Se non trovi movimenti, restituisci una lista vuota.

Dati del file:
{{media url=fileDataUri}}`,
});

const importTransactionsFlow = ai.defineFlow(
  {
    name: 'importTransactionsFlow',
    inputSchema: ImportTransactionsInputSchema,
    outputSchema: ImportTransactionsOutputSchema, // The flow returns the final schema
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
                  throw new Error('Invalid date format from AI');
              }
          } catch(e) {
              anno = new Date().getFullYear(); // Fallback to current year
          }

          const category = mov.categoria && Object.keys(CATEGORIE).includes(mov.categoria) ? mov.categoria : 'Da categorizzare';
          const subcategory = category !== 'Da categorizzare' && mov.sottocategoria && CATEGORIE[category as keyof typeof CATEGORIE]?.includes(mov.sottocategoria) ? mov.sottocategoria : 'Da categorizzare';

          return {
              societa: input.company,
              anno: anno,
              data: mov.data,
              descrizione: mov.descrizione,
              categoria: category,
              sottocategoria: subcategory,
              entrata: mov.entrata || 0,
              uscita: mov.uscita || 0,
              iva: mov.iva === undefined ? 0.22 : mov.iva,
              conto: input.conto || '',
              inseritoDa: input.inseritoDa,
          };
      });

      return { movements: cleanedMovements };
    } catch(e) {
        console.error("Error in importTransactionsFlow", e);
        // This makes the error message more useful for debugging and for the user.
        throw new Error(
          'L\'analisi AI non è riuscita. Ciò potrebbe essere dovuto a un file di formato non supportato, illeggibile o a un errore temporaneo del servizio. Prova con un file diverso o riprova più tardi.'
        );
    }
  }
);
